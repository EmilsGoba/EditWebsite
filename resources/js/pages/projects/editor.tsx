import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Clapperboard,
    Film,
    Image,
    MousePointer2,
    Minus,
    Pause,
    Play,
    Plus,
    RotateCcw,
    Redo2,
    Save,
    Scissors,
    Trash2,
    Upload,
    Undo2,
    Volume2,
    WandSparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

type Project = {
    id: number;
    name: string;
    format: string;
    status: string;
    created_at: string;
};

type EditorProps = {
    project: Project;
    media: ProjectMedia[];
    timelineClips: SavedTimelineClip[];
};

type ProjectMedia = {
    id: number;
    type: 'video' | 'image' | 'audio';
    name: string;
    mime_type: string | null;
    size: number;
    url: string;
    created_at: string;
};

type TimelineClip = {
    id: number;
    mediaId: number;
    name: string;
    type: ProjectMedia['type'];
    start: number;
    duration: number;
    sourceStart: number;
    scale: number;
    positionX: number;
    positionY: number;
    rotation: number;
    color: string;
    url: string;
};

type SavedTimelineClip = Omit<
    TimelineClip,
    'color' | 'positionX' | 'positionY' | 'rotation' | 'scale'
> &
    Partial<
        Pick<TimelineClip, 'positionX' | 'positionY' | 'rotation' | 'scale'>
    >;

type ClipTrimState = {
    clipId: number;
    edge: 'left' | 'right';
    linkedClipIds: number[];
    startingClips: TimelineClip[];
    trackLeft: number;
};

type PlayheadDragState = {
    trackLeft: number;
};

type TimelineDropPreview = {
    track: 'video' | 'audio';
    name: string;
    type: ProjectMedia['type'];
    start: number;
    duration: number;
    canPlace: boolean;
};

type TimelineClipMovePreview = {
    clipId: number;
    linkedClipIds: number[];
    originalStart: number;
    previewStart: number;
    offsetPixels: number;
};

const effectItems = ['Fade in', 'Blur', 'Color boost', 'Black and white'];
const uploadLimits =
    'Allowed files: MP4, MOV, JPG, JPEG, PNG, MP3. Videos up to 500 MB, images up to 10 MB, audio up to 50 MB.';
const acceptedMediaTypes = '.mp4,.mov,.jpg,.jpeg,.png,.mp3';
const timelineBaseWidth = 1100;
const defaultTimelineSeconds = 70;
const timelinePaddingSeconds = 10;
const timelineMajorIntervalSeconds = 10;
const timelineFramesPerSecond = 60;
const timelineFrameDurationSeconds = 1 / timelineFramesPerSecond;
const timelinePlaybackIntervalMs = 1000 / timelineFramesPerSecond;
const visibleTimelineIntervalSeconds = 0.1;
const timelineOverlapGapSeconds = timelineFrameDurationSeconds;
const mediaDragType = 'application/x-video-editor-media';
const clipDragType = 'application/x-video-editor-clip';
const defaultClipProperties = {
    scale: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
};

function getTemporaryClipDuration(type: ProjectMedia['type']) {
    if (type === 'image') {
        return 5;
    }

    if (type === 'audio') {
        return 12;
    }

    return 10;
}

function getTimelineColor(type: ProjectMedia['type']) {
    if (type === 'audio') {
        return 'bg-emerald-700/80';
    }

    if (type === 'image') {
        return 'bg-cyan-500';
    }

    return 'bg-orange-500';
}

export default function Editor({
    project,
    media,
    timelineClips: savedTimelineClips,
}: EditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const timelineAudioRef = useRef<HTMLAudioElement>(null);
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const latestTrimClipsRef = useRef<TimelineClip[] | null>(null);
    const autoSaveTimerRef = useRef<number | null>(null);
    const hasAutoSaveMountedRef = useRef(false);
    const activeSaveRequestRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDeletingMedia, setIsDeletingMedia] = useState(false);
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
    const [mediaDurations, setMediaDurations] = useState<
        Record<number, number>
    >({});
    const initialTimelineClips = useMemo(
        () =>
            savedTimelineClips.map((clip) => ({
                ...defaultClipProperties,
                ...clip,
                start: snapToTimelineStep(clip.start),
                duration: snapToTimelineStep(clip.duration),
                sourceStart: snapToTimelineStep(clip.sourceStart),
                color: getTimelineColor(clip.type),
            })),
        [savedTimelineClips],
    );
    const [timelineClips, setTimelineClips] =
        useState<TimelineClip[]>(initialTimelineClips);
    const [history, setHistory] = useState<TimelineClip[][]>([
        initialTimelineClips,
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
    const [playhead, setPlayhead] = useState(0);
    const [isSavingTimeline, setIsSavingTimeline] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved');
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
    const [selectedTool, setSelectedTool] = useState<'select' | 'cut'>(
        'select',
    );
    const [timelineZoom, setTimelineZoom] = useState(50);
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
    const [clipTrimState, setClipTrimState] = useState<ClipTrimState | null>(
        null,
    );
    const [playheadDragState, setPlayheadDragState] =
        useState<PlayheadDragState | null>(null);
    const [draggingMedia, setDraggingMedia] = useState<ProjectMedia | null>(
        null,
    );
    const [timelineDropPreview, setTimelineDropPreview] =
        useState<TimelineDropPreview | null>(null);
    const [timelineClipMovePreview, setTimelineClipMovePreview] =
        useState<TimelineClipMovePreview | null>(null);
    const latestTimelineClipsRef = useRef<TimelineClip[]>(initialTimelineClips);
    const latestTimelineSignatureRef = useRef(
        getTimelineSaveSignature(initialTimelineClips),
    );

    const previewLabel = useMemo(() => {
        if (project.format === '9:16') {
            return 'Portrait preview';
        }

        if (project.format === '1:1') {
            return 'Square preview';
        }

        return 'Landscape preview';
    }, [project.format]);

    const previewFrame = useMemo(() => {
        if (project.format === '9:16') {
            return {
                aspectRatio: '9 / 16',
                className: 'h-[82%] w-auto',
            };
        }

        if (project.format === '1:1') {
            return {
                aspectRatio: '1 / 1',
                className: 'h-[78%] w-auto',
            };
        }

        return {
            aspectRatio: '16 / 9',
            className: 'w-[86%]',
        };
    }, [project.format]);

    const timelineContentEnd = useMemo(() => {
        return timelineClips.reduce(
            (lastEnd, clip) => Math.max(lastEnd, clip.start + clip.duration),
            0,
        );
    }, [timelineClips]);

    const timelineDuration = useMemo(() => {
        // The timeline starts at 1:10, then grows after the last clip with a small empty work area.
        return Math.max(
            defaultTimelineSeconds,
            snapToTimelineStep(timelineContentEnd + timelinePaddingSeconds),
        );
    }, [timelineContentEnd]);

    const timelinePixelsPerSecond = useMemo(
        () =>
            Math.max(
                14 + timelineZoom * 0.25,
                timelineViewportWidth / timelineDuration,
            ),
        [timelineDuration, timelineViewportWidth, timelineZoom],
    );

    const timelineWidth = useMemo(
        () =>
            Math.max(
                timelineBaseWidth,
                timelineViewportWidth,
                timelineDuration * timelinePixelsPerSecond,
            ),
        [timelineDuration, timelinePixelsPerSecond, timelineViewportWidth],
    );

    const activeClip = useMemo(() => {
        return timelineClips.find(
            (clip) =>
                clip.type !== 'audio' &&
                playhead >= clip.start &&
                playhead < clip.start + clip.duration,
        );
    }, [playhead, timelineClips]);

    const activeAudioClip = useMemo(() => {
        return timelineClips.find(
            (clip) =>
                clip.type === 'audio' &&
                playhead >= clip.start &&
                playhead < clip.start + clip.duration,
        );
    }, [playhead, timelineClips]);

    const selectedClip = useMemo(() => {
        return timelineClips.find((clip) => clip.id === selectedClipId) ?? null;
    }, [selectedClipId, timelineClips]);
    const selectedVisualClip =
        selectedClip && selectedClip.type !== 'audio' ? selectedClip : null;
    const selectedClipScale =
        selectedVisualClip?.scale ?? defaultClipProperties.scale;
    const selectedClipPositionX =
        selectedVisualClip?.positionX ?? defaultClipProperties.positionX;
    const selectedClipPositionY =
        selectedVisualClip?.positionY ?? defaultClipProperties.positionY;
    const selectedClipRotation =
        selectedVisualClip?.rotation ?? defaultClipProperties.rotation;

    const timelineMarks = useMemo(
        () =>
            Array.from(
                {
                    length:
                        Math.floor(
                            timelineDuration / timelineMajorIntervalSeconds,
                        ) + 1,
                },
                (_, index) => index * timelineMajorIntervalSeconds,
            ),
        [timelineDuration],
    );

    const timelineIntervals = useMemo(
        () =>
            Array.from(
                {
                    length:
                        Math.floor(
                            timelineDuration / visibleTimelineIntervalSeconds,
                        ) + 1,
                },
                (_, index) =>
                    Number((index * visibleTimelineIntervalSeconds).toFixed(1)),
            ),
        [timelineDuration],
    );

    const timelineSignature = useMemo(
        () => getTimelineSaveSignature(timelineClips),
        [timelineClips],
    );

    useEffect(() => {
        latestTimelineClipsRef.current = timelineClips;
        latestTimelineSignatureRef.current = timelineSignature;
    }, [timelineClips, timelineSignature]);

    useEffect(() => {
        if (!isPlaying || activeClip?.type === 'video' || activeAudioClip) {
            return;
        }

        const timer = window.setInterval(() => {
            setPlayhead((currentTime) => {
                if (currentTime >= timelineContentEnd) {
                    setIsPlaying(false);
                    return snapToTimelineStep(timelineContentEnd);
                }

                return snapToTimelineStep(
                    Math.min(
                        timelineContentEnd,
                        currentTime + timelineFrameDurationSeconds,
                    ),
                );
            });
        }, timelinePlaybackIntervalMs);

        return () => window.clearInterval(timer);
    }, [activeAudioClip, activeClip?.type, isPlaying, timelineContentEnd]);

    useEffect(() => {
        const timelineScroll = timelineScrollRef.current;

        if (!timelineScroll) {
            return;
        }

        function updateTimelineViewportWidth() {
            setTimelineViewportWidth(timelineScroll?.clientWidth ?? 0);
        }

        updateTimelineViewportWidth();

        const observer = new ResizeObserver(updateTimelineViewportWidth);
        observer.observe(timelineScroll);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (playhead <= timelineDuration) {
            return;
        }

        // When clips are deleted, the timeline can shrink. Keep the playhead inside the visible project length.
        setIsPlaying(false);
        setPlayhead(timelineDuration);
    }, [playhead, timelineDuration]);

    useEffect(() => {
        const timelineScroll = timelineScrollRef.current;

        if (!timelineScroll) {
            return;
        }

        const maxScrollLeft = Math.max(
            0,
            timelineScroll.scrollWidth - timelineScroll.clientWidth,
        );

        if (timelineScroll.scrollLeft > maxScrollLeft) {
            timelineScroll.scrollLeft = maxScrollLeft;
        }
    }, [timelineWidth]);

    useEffect(() => {
        const previewVideo = previewVideoRef.current;

        if (!previewVideo || activeClip?.type !== 'video') {
            return;
        }

        const clipTime = Math.max(
            0,
            activeClip.sourceStart + playhead - activeClip.start,
        );

        if (
            !isPlaying &&
            Math.abs(previewVideo.currentTime - clipTime) > 0.08
        ) {
            previewVideo.currentTime = clipTime;
        }

        if (isPlaying) {
            // Browsers allow muted video playback, so this connects our timeline play button to the preview.
            if (previewVideo.paused) {
                previewVideo.currentTime = clipTime;
                void previewVideo.play();
            }
        } else {
            previewVideo.pause();
        }
    }, [activeClip, isPlaying, playhead]);

    useEffect(() => {
        if (!isPlaying || activeClip?.type !== 'video') {
            return;
        }

        const timer = window.setInterval(
            updatePlayheadFromPreviewVideo,
            timelinePlaybackIntervalMs,
        );

        return () => window.clearInterval(timer);
    }, [activeClip, isPlaying, timelineContentEnd]);

    useEffect(() => {
        const timelineAudio = timelineAudioRef.current;

        if (!timelineAudio || !activeAudioClip) {
            return;
        }

        const clipTime = Math.max(
            0,
            activeAudioClip.sourceStart + playhead - activeAudioClip.start,
        );

        if (!isPlaying) {
            timelineAudio.pause();

            if (Math.abs(timelineAudio.currentTime - clipTime) > 0.08) {
                timelineAudio.currentTime = clipTime;
            }

            return;
        }

        // Audio clips use this hidden player so both uploaded audio and video sound can follow the timeline.
        if (timelineAudio.paused) {
            timelineAudio.currentTime = clipTime;
            void timelineAudio.play().catch(() => {
                setIsPlaying(false);
            });
        }
    }, [activeAudioClip, isPlaying, playhead]);

    useEffect(() => {
        if (!isPlaying || !activeAudioClip || activeClip?.type === 'video') {
            return;
        }

        const timer = window.setInterval(
            updatePlayheadFromTimelineAudio,
            timelinePlaybackIntervalMs,
        );

        return () => window.clearInterval(timer);
    }, [activeAudioClip, activeClip?.type, isPlaying, timelineContentEnd]);

    useEffect(() => {
        if (!hasAutoSaveMountedRef.current) {
            hasAutoSaveMountedRef.current = true;
            return;
        }

        if (
            !isAutoSaveEnabled ||
            saveStatus !== 'unsaved' ||
            isSavingTimeline
        ) {
            return;
        }

        if (autoSaveTimerRef.current) {
            window.clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = window.setTimeout(() => {
            saveTimeline(latestTimelineClipsRef.current, true);
        }, 1200);

        return () => {
            if (autoSaveTimerRef.current) {
                window.clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [isAutoSaveEnabled, isSavingTimeline, saveStatus, timelineSignature]);

    useEffect(() => {
        function handleTimelineKeyboard(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;

            if (
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.isContentEditable
            ) {
                return;
            }

            if (event.code === 'Space') {
                event.preventDefault();
                togglePlayback();
                return;
            }

            if (event.key === 'Backspace') {
                event.preventDefault();
                deleteSelectedTimelineClip();
            }
        }

        window.addEventListener('keydown', handleTimelineKeyboard);

        return () =>
            window.removeEventListener('keydown', handleTimelineKeyboard);
    }, [selectedClipId, timelineClips]);

    useEffect(() => {
        if (!clipTrimState) {
            return;
        }

        const currentTrimState = clipTrimState;

        function handleClipTrim(event: MouseEvent) {
            const nextClips = trimTimelineClips(
                currentTrimState,
                event.clientX,
            );

            latestTrimClipsRef.current = nextClips;
            setTimelineClips(nextClips);
            setSaveStatus('unsaved');
        }

        function finishClipTrim() {
            if (latestTrimClipsRef.current) {
                saveTimelineChange(latestTrimClipsRef.current);
            }

            latestTrimClipsRef.current = null;
            setClipTrimState(null);
        }

        window.addEventListener('mousemove', handleClipTrim);
        window.addEventListener('mouseup', finishClipTrim);

        return () => {
            window.removeEventListener('mousemove', handleClipTrim);
            window.removeEventListener('mouseup', finishClipTrim);
        };
    }, [clipTrimState, history, historyIndex]);

    useEffect(() => {
        if (!playheadDragState) {
            return;
        }

        const currentDragState = playheadDragState;

        function dragPlayhead(event: MouseEvent) {
            setIsPlaying(false);
            setPlayhead(
                getSnappedPlayheadTime(currentDragState, event.clientX),
            );
        }

        function stopDraggingPlayhead() {
            setPlayheadDragState(null);
        }

        window.addEventListener('mousemove', dragPlayhead);
        window.addEventListener('mouseup', stopDraggingPlayhead);

        return () => {
            window.removeEventListener('mousemove', dragPlayhead);
            window.removeEventListener('mouseup', stopDraggingPlayhead);
        };
    }, [playheadDragState]);

    function getMediaIcon(type: ProjectMedia['type']) {
        if (type === 'image') {
            return Image;
        }

        if (type === 'audio') {
            return Volume2;
        }

        return Film;
    }

    function getMediaType(file: File): ProjectMedia['type'] | null {
        // The browser gives us the file MIME type, so we can send Laravel the correct upload category.
        if (file.type.startsWith('video/')) {
            return 'video';
        }

        if (file.type.startsWith('image/')) {
            return 'image';
        }

        if (file.type.startsWith('audio/')) {
            return 'audio';
        }

        return null;
    }

    function formatFileSize(size: number) {
        if (size >= 1024 * 1024) {
            return `${(size / 1024 / 1024).toFixed(1)} MB`;
        }

        return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    function formatTimelineTime(seconds: number) {
        const totalFrames = Math.max(
            0,
            Math.round(seconds * timelineFramesPerSecond),
        );
        const wholeSeconds = Math.floor(totalFrames / timelineFramesPerSecond);
        const frame = (totalFrames % timelineFramesPerSecond)
            .toString()
            .padStart(2, '0');
        const minutes = Math.floor(wholeSeconds / 60)
            .toString()
            .padStart(2, '0');
        const remainingSeconds = Math.floor(wholeSeconds % 60)
            .toString()
            .padStart(2, '0');

        return `${minutes}:${remainingSeconds}:${frame}`;
    }

    function formatShortDuration(seconds: number) {
        if (seconds < 60) {
            return `${seconds.toFixed(2)}s`;
        }

        return formatTimelineTime(seconds);
    }

    function snapToTimelineStep(seconds: number) {
        // The editor timeline snaps to 60 FPS, so clips and the playhead always land on real frame boundaries.
        const frame = Math.round(seconds * timelineFramesPerSecond);

        return Number((frame / timelineFramesPerSecond).toFixed(6));
    }

    function secondsToPixels(seconds: number) {
        return snapToTimelineStep(seconds) * timelinePixelsPerSecond;
    }

    function pixelsToSeconds(pixels: number) {
        const seconds = Math.max(
            0,
            Math.min(timelineDuration, pixels / timelinePixelsPerSecond),
        );

        return snapToTimelineStep(seconds);
    }

    function saveTimelineChange(nextClips: TimelineClip[]) {
        // Every timeline edit is stored in a small local history, which powers undo and redo.
        const snappedClips = nextClips.map((clip) => ({
            ...clip,
            start: snapToTimelineStep(clip.start),
            duration: snapToTimelineStep(clip.duration),
            sourceStart: snapToTimelineStep(clip.sourceStart),
        }));
        const nextHistory = history.slice(0, historyIndex + 1);

        nextHistory.push(snappedClips);
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
        setTimelineClips(snappedClips);
        setSaveStatus('unsaved');
    }

    function getTimelineSavePayload(clips: TimelineClip[], autoSave = false) {
        return {
            autoSave,
            clips: clips.map((clip) => ({
                mediaId: clip.mediaId,
                name: clip.name,
                type: clip.type,
                start: clip.start,
                duration: clip.duration,
                sourceStart: clip.sourceStart,
                scale: clip.scale,
                positionX: clip.positionX,
                positionY: clip.positionY,
                rotation: clip.rotation,
            })),
        };
    }

    function getTimelineSaveSignature(clips: TimelineClip[]) {
        return JSON.stringify(getTimelineSavePayload(clips).clips);
    }

    function saveTimeline(clipsToSave = timelineClips, autoSave = false) {
        if (isSavingTimeline) {
            return;
        }

        const saveRequestId = activeSaveRequestRef.current + 1;
        const savedTimelineSignature = getTimelineSaveSignature(clipsToSave);

        activeSaveRequestRef.current = saveRequestId;
        setIsSavingTimeline(true);

        // This saves the current timeline layout to MySQL, so it can load again after refresh.
        router.put(
            `/projects/${project.id}/timeline`,
            getTimelineSavePayload(clipsToSave, autoSave),
            {
                preserveScroll: true,
                onError: () => setSaveStatus('unsaved'),
                onSuccess: () => {
                    setSaveStatus(
                        savedTimelineSignature ===
                            latestTimelineSignatureRef.current
                            ? 'saved'
                            : 'unsaved',
                    );
                },
                onFinish: () => {
                    if (activeSaveRequestRef.current === saveRequestId) {
                        setIsSavingTimeline(false);
                    }
                },
            },
        );
    }

    function rememberMediaDuration(mediaId: number, duration: number) {
        if (!Number.isFinite(duration) || duration <= 0) {
            return;
        }

        setMediaDurations((currentDurations) => ({
            ...currentDurations,
            [mediaId]: snapToTimelineStep(duration),
        }));
    }

    function createTimelineClipsFromMedia(item: ProjectMedia, start: number) {
        const duration = getMediaTimelineDuration(item);
        const nextClip: TimelineClip = {
            id: Date.now(),
            mediaId: item.id,
            name: item.name,
            type: item.type,
            start,
            duration,
            sourceStart: 0,
            ...defaultClipProperties,
            color: getTimelineColor(item.type),
            url: item.url,
        };
        const nextClips = [nextClip];

        if (item.type === 'video') {
            // For now this creates a timeline audio clip from the uploaded video, so the audio track is visible.
            nextClips.push({
                id: Date.now() + 1,
                mediaId: item.id,
                name: `${item.name} audio`,
                type: 'audio',
                start,
                duration,
                sourceStart: 0,
                ...defaultClipProperties,
                color: getTimelineColor('audio'),
                url: item.url,
            });
        }

        return nextClips;
    }

    function getMediaTimelineDuration(item: ProjectMedia) {
        return mediaDurations[item.id] ?? getTemporaryClipDuration(item.type);
    }

    function getClipTrack(clip: Pick<TimelineClip, 'type'>) {
        return clip.type === 'audio' ? 'audio' : 'video';
    }

    function timelineClipOverlaps(
        clip: Pick<TimelineClip, 'start' | 'duration' | 'type'>,
        otherClip: Pick<TimelineClip, 'start' | 'duration' | 'type'>,
    ) {
        if (getClipTrack(clip) !== getClipTrack(otherClip)) {
            return false;
        }

        const clipStart = snapToTimelineStep(clip.start);
        const clipEnd = snapToTimelineStep(clip.start + clip.duration);
        const otherStart = snapToTimelineStep(otherClip.start);
        const otherEnd = snapToTimelineStep(
            otherClip.start + otherClip.duration,
        );

        return clipStart < otherEnd && clipEnd > otherStart;
    }

    function canPlaceTimelineClips(
        nextClips: TimelineClip[],
        existingClips = timelineClips,
        ignoredClipIds: number[] = [],
    ) {
        const checkedClips = existingClips.filter(
            (clip) => !ignoredClipIds.includes(clip.id),
        );

        return nextClips.every(
            (nextClip) =>
                !checkedClips.some((clip) =>
                    timelineClipOverlaps(nextClip, clip),
                ),
        );
    }

    function getPreviousClipEnd(
        clip: TimelineClip,
        existingClips: TimelineClip[],
        ignoredClipIds: number[],
    ) {
        return existingClips
            .filter(
                (otherClip) =>
                    !ignoredClipIds.includes(otherClip.id) &&
                    getClipTrack(otherClip) === getClipTrack(clip) &&
                    otherClip.start + otherClip.duration <=
                        clip.start + timelineOverlapGapSeconds,
            )
            .reduce(
                (previousEnd, otherClip) =>
                    Math.max(previousEnd, otherClip.start + otherClip.duration),
                0,
            );
    }

    function getNextClipStart(
        clip: TimelineClip,
        existingClips: TimelineClip[],
        ignoredClipIds: number[],
    ) {
        return existingClips
            .filter(
                (otherClip) =>
                    !ignoredClipIds.includes(otherClip.id) &&
                    getClipTrack(otherClip) === getClipTrack(clip) &&
                    otherClip.start >=
                        clip.start + clip.duration - timelineOverlapGapSeconds,
            )
            .reduce(
                (nextStart, otherClip) => Math.min(nextStart, otherClip.start),
                Number.POSITIVE_INFINITY,
            );
    }

    function getTimelineMoveBounds(
        movingClips: TimelineClip[],
        existingClips: TimelineClip[],
        ignoredClipIds: number[],
    ) {
        return movingClips.reduce(
            (bounds, clip) => {
                const previousEnd = getPreviousClipEnd(
                    clip,
                    existingClips,
                    ignoredClipIds,
                );
                const nextStart = getNextClipStart(
                    clip,
                    existingClips,
                    ignoredClipIds,
                );

                return {
                    minMove: Math.max(bounds.minMove, previousEnd - clip.start),
                    maxMove: Math.min(
                        bounds.maxMove,
                        Number.isFinite(nextStart)
                            ? nextStart - (clip.start + clip.duration)
                            : Number.POSITIVE_INFINITY,
                    ),
                };
            },
            {
                minMove: Number.NEGATIVE_INFINITY,
                maxMove: Number.POSITIVE_INFINITY,
            },
        );
    }

    function getLinkedTimelineClips(clipToMatch: TimelineClip) {
        const linkedClipIds = getLinkedClipIds(clipToMatch);

        return timelineClips.filter((clip) => linkedClipIds.includes(clip.id));
    }

    function getConstrainedTimelineMoveStart(clipId: number, start: number) {
        const movingClip = timelineClips.find((clip) => clip.id === clipId);

        if (!movingClip) {
            return snapToTimelineStep(Math.max(0, start));
        }

        const movingClips = getLinkedTimelineClips(movingClip);
        const ignoredClipIds = movingClips.map((clip) => clip.id);
        const desiredMove =
            snapToTimelineStep(Math.max(0, start)) - movingClip.start;
        const moveBounds = getTimelineMoveBounds(
            movingClips,
            timelineClips,
            ignoredClipIds,
        );
        const minMove = Math.max(moveBounds.minMove, -movingClip.start);
        const constrainedMove = Math.min(
            Math.max(desiredMove, minMove),
            moveBounds.maxMove,
        );

        return snapToTimelineStep(
            Math.max(0, movingClip.start + constrainedMove),
        );
    }

    function addMediaToTimelineAt(item: ProjectMedia, start: number) {
        const nextStart = snapToTimelineStep(Math.max(0, start));
        const nextClips = createTimelineClipsFromMedia(item, nextStart);
        const primaryClip = nextClips[0];

        if (!canPlaceTimelineClips(nextClips)) {
            return;
        }

        saveTimelineChange([...timelineClips, ...nextClips]);
        setSelectedClipId(primaryClip.id);
        setIsPlaying(false);
    }

    function moveTimelineClipTo(clipId: number, start: number) {
        const movingClip = timelineClips.find((clip) => clip.id === clipId);

        if (!movingClip) {
            return;
        }

        const nextStart = getConstrainedTimelineMoveStart(clipId, start);
        const moveDistance = nextStart - movingClip.start;

        if (moveDistance === 0) {
            setSelectedClipId(movingClip.id);
            return;
        }

        // If a video clip still lines up with its extracted audio, move both together.
        const linkedClipIds = getLinkedClipIds(movingClip);

        saveTimelineChange(
            timelineClips.map((clip) =>
                linkedClipIds.includes(clip.id)
                    ? {
                          ...clip,
                          start: snapToTimelineStep(
                              Math.max(0, clip.start + moveDistance),
                          ),
                      }
                    : clip,
            ),
        );
        setSelectedClipId(movingClip.id);
        setIsPlaying(false);
    }

    function getOriginalClipDuration(clip: TimelineClip) {
        // Metadata gives the true source duration after the browser has loaded it. Existing saved clips use their current source span as a safe fallback.
        return Math.max(
            mediaDurations[clip.mediaId] ?? getTemporaryClipDuration(clip.type),
            clip.sourceStart + clip.duration,
        );
    }

    function getLinkedClipIds(clipToMatch: TimelineClip) {
        return timelineClips
            .filter(
                (clip) =>
                    clip.mediaId === clipToMatch.mediaId &&
                    Math.abs(clip.start - clipToMatch.start) < 0.001 &&
                    Math.abs(clip.duration - clipToMatch.duration) < 0.001 &&
                    Math.abs(clip.sourceStart - clipToMatch.sourceStart) <
                        0.001,
            )
            .map((clip) => clip.id);
    }

    function getTimelineClipPreviewStart(clip: TimelineClip) {
        if (!timelineClipMovePreview?.linkedClipIds.includes(clip.id)) {
            return clip.start;
        }

        const moveDistance =
            timelineClipMovePreview.previewStart -
            timelineClipMovePreview.originalStart;

        return snapToTimelineStep(Math.max(0, clip.start + moveDistance));
    }

    function getTimelineDragMarkerStart() {
        return (
            timelineDropPreview?.start ??
            timelineClipMovePreview?.previewStart ??
            null
        );
    }

    function startClipTrim(
        event: React.MouseEvent<HTMLSpanElement>,
        clip: TimelineClip,
        edge: ClipTrimState['edge'],
    ) {
        const track = event.currentTarget.closest('[data-timeline-track]');

        if (!(track instanceof HTMLDivElement)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setSelectedClipId(clip.id);
        setIsPlaying(false);
        latestTrimClipsRef.current = null;
        setClipTrimState({
            clipId: clip.id,
            edge,
            linkedClipIds: getLinkedClipIds(clip),
            startingClips: timelineClips,
            trackLeft: track.getBoundingClientRect().left,
        });
    }

    function trimTimelineClips(
        trimState: ClipTrimState,
        pointerClientX: number,
    ) {
        const baseClip = trimState.startingClips.find(
            (clip) => clip.id === trimState.clipId,
        );

        if (!baseClip) {
            return trimState.startingClips;
        }

        const pointerTime = pixelsToSeconds(
            pointerClientX - trimState.trackLeft,
        );
        const minimumDuration = timelineFrameDurationSeconds;
        const linkedClips = trimState.startingClips.filter((clip) =>
            trimState.linkedClipIds.includes(clip.id),
        );
        let nextStart = baseClip.start;
        let nextDuration = baseClip.duration;
        let nextSourceStart = baseClip.sourceStart;

        if (trimState.edge === 'right') {
            const maxEnd = linkedClips.reduce((endLimit, clip) => {
                const sourceMaxEnd =
                    clip.start +
                    getOriginalClipDuration(clip) -
                    clip.sourceStart;
                const nextClipStart = getNextClipStart(
                    clip,
                    trimState.startingClips,
                    trimState.linkedClipIds,
                );

                return Math.min(endLimit, sourceMaxEnd, nextClipStart);
            }, Number.POSITIVE_INFINITY);
            const nextEnd = snapToTimelineStep(
                Math.min(
                    Math.max(pointerTime, baseClip.start + minimumDuration),
                    maxEnd,
                ),
            );

            nextDuration = snapToTimelineStep(nextEnd - baseClip.start);
        } else {
            const clipEnd = baseClip.start + baseClip.duration;
            const earliestStart = linkedClips.reduce((startLimit, clip) => {
                const currentClipEnd = clip.start + clip.duration;
                const sourceMinStart = clip.start - clip.sourceStart;
                const sourceMaxStart =
                    currentClipEnd - getOriginalClipDuration(clip);
                const previousClipEnd = getPreviousClipEnd(
                    clip,
                    trimState.startingClips,
                    trimState.linkedClipIds,
                );

                return Math.max(
                    startLimit,
                    sourceMinStart,
                    sourceMaxStart,
                    previousClipEnd,
                );
            }, 0);

            nextStart = snapToTimelineStep(
                Math.min(
                    Math.max(pointerTime, earliestStart),
                    clipEnd - minimumDuration,
                ),
            );
            nextDuration = snapToTimelineStep(clipEnd - nextStart);
            nextSourceStart = snapToTimelineStep(
                baseClip.sourceStart + nextStart - baseClip.start,
            );
        }

        return trimState.startingClips.map((clip) =>
            trimState.linkedClipIds.includes(clip.id)
                ? {
                      ...clip,
                      start: nextStart,
                      duration: nextDuration,
                      sourceStart: nextSourceStart,
                  }
                : clip,
        );
    }

    function selectTimelineClip(clip: TimelineClip) {
        setSelectedClipId(clip.id);
        setIsPlaying(false);
    }

    function getSnappedPlayheadTime(
        dragState: PlayheadDragState,
        pointerClientX: number,
    ) {
        return pixelsToSeconds(pointerClientX - dragState.trackLeft);
    }

    function startPlayheadDrag(event: React.MouseEvent<HTMLDivElement>) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const nextDragState = {
            trackLeft: bounds.left,
        };

        event.preventDefault();
        setIsPlaying(false);
        setPlayhead(getSnappedPlayheadTime(nextDragState, event.clientX));
        setPlayheadDragState(nextDragState);
    }

    function getTimelineDropStart(
        event: React.DragEvent<HTMLDivElement>,
        offsetPixels = 0,
    ) {
        const bounds = event.currentTarget.getBoundingClientRect();

        return pixelsToSeconds(event.clientX - bounds.left - offsetPixels);
    }

    function canPlaceOnTrack(
        type: ProjectMedia['type'],
        track: 'video' | 'audio',
    ) {
        if (track === 'audio') {
            return type === 'audio';
        }

        return type !== 'audio';
    }

    function startMediaDrag(
        event: React.DragEvent<HTMLButtonElement>,
        item: ProjectMedia,
    ) {
        if (isDeletingMedia) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(mediaDragType, String(item.id));
        setDraggingMedia(item);
        setTimelineDropPreview(null);

        hideBrowserDragImage(event);
    }

    function hideBrowserDragImage(event: React.DragEvent<HTMLElement>) {
        // The editor draws its own snapped timeline preview, so the browser drag ghost would only add visual noise.
        const dragImage = document.createElement('div');
        dragImage.style.height = '1px';
        dragImage.style.opacity = '0';
        dragImage.style.position = 'absolute';
        dragImage.style.width = '1px';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        window.setTimeout(() => dragImage.remove(), 0);
    }

    function stopMediaDrag() {
        setDraggingMedia(null);
        setTimelineDropPreview(null);
    }

    function stopTimelineClipDrag() {
        setTimelineClipMovePreview(null);
    }

    function startTimelineClipDrag(
        event: React.DragEvent<HTMLButtonElement>,
        clip: TimelineClip,
    ) {
        if ((event.target as HTMLElement).closest('[data-resize-handle]')) {
            event.preventDefault();
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const offsetPixels = event.clientX - bounds.left;

        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(
            clipDragType,
            JSON.stringify({
                clipId: clip.id,
                offsetPixels,
            }),
        );
        setSelectedClipId(clip.id);
        setTimelineDropPreview(null);
        setTimelineClipMovePreview({
            clipId: clip.id,
            linkedClipIds: getLinkedClipIds(clip),
            originalStart: clip.start,
            previewStart: clip.start,
            offsetPixels,
        });
        hideBrowserDragImage(event);
    }

    function allowTimelineDrop(
        event: React.DragEvent<HTMLDivElement>,
        track: 'video' | 'audio',
    ) {
        if (event.dataTransfer.types.includes(mediaDragType)) {
            if (!draggingMedia || !canPlaceOnTrack(draggingMedia.type, track)) {
                setTimelineDropPreview(null);
                return;
            }

            const previewStart = snapToTimelineStep(
                getTimelineDropStart(event),
            );
            const previewClips = createTimelineClipsFromMedia(
                draggingMedia,
                previewStart,
            );

            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setTimelineDropPreview({
                track,
                name: draggingMedia.name,
                type: draggingMedia.type,
                start: previewStart,
                duration: getMediaTimelineDuration(draggingMedia),
                canPlace: canPlaceTimelineClips(previewClips),
            });
            return;
        }

        if (event.dataTransfer.types.includes(clipDragType)) {
            if (timelineClipMovePreview) {
                const draggedClip = timelineClips.find(
                    (clip) => clip.id === timelineClipMovePreview.clipId,
                );

                if (!draggedClip || !canPlaceOnTrack(draggedClip.type, track)) {
                    return;
                }

                setTimelineClipMovePreview({
                    ...timelineClipMovePreview,
                    previewStart: getConstrainedTimelineMoveStart(
                        draggedClip.id,
                        getTimelineDropStart(
                            event,
                            timelineClipMovePreview.offsetPixels,
                        ),
                    ),
                });
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        }
    }

    function leaveTimelineDrop(event: React.DragEvent<HTMLDivElement>) {
        if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
        ) {
            return;
        }

        setTimelineDropPreview(null);
    }

    function dropOnTimeline(
        event: React.DragEvent<HTMLDivElement>,
        track: 'video' | 'audio',
    ) {
        event.preventDefault();

        const draggedMediaId = Number(
            event.dataTransfer.getData(mediaDragType),
        );

        if (draggedMediaId) {
            const draggedMedia = media.find(
                (item) => item.id === draggedMediaId,
            );

            if (!draggedMedia || !canPlaceOnTrack(draggedMedia.type, track)) {
                stopMediaDrag();
                return;
            }

            addMediaToTimelineAt(draggedMedia, getTimelineDropStart(event));
            stopMediaDrag();
            return;
        }

        const draggedClipData = event.dataTransfer.getData(clipDragType);

        if (!draggedClipData) {
            stopTimelineClipDrag();
            return;
        }

        let draggedClipPayload: { clipId: number; offsetPixels: number };

        try {
            draggedClipPayload = JSON.parse(draggedClipData) as {
                clipId: number;
                offsetPixels: number;
            };
        } catch {
            stopTimelineClipDrag();
            return;
        }

        const { clipId, offsetPixels } = draggedClipPayload;
        const draggedClip = timelineClips.find((clip) => clip.id === clipId);

        if (!draggedClip || !canPlaceOnTrack(draggedClip.type, track)) {
            stopTimelineClipDrag();
            return;
        }

        moveTimelineClipTo(clipId, getTimelineDropStart(event, offsetPixels));
        stopTimelineClipDrag();
    }

    function updatePlayheadFromPreviewVideo() {
        const previewVideo = previewVideoRef.current;

        if (!previewVideo || activeClip?.type !== 'video') {
            return;
        }

        const nextTime = snapToTimelineStep(
            activeClip.start +
                previewVideo.currentTime -
                activeClip.sourceStart,
        );
        const clipEnd = activeClip.start + activeClip.duration;

        if (nextTime >= clipEnd) {
            previewVideo.pause();
            setPlayhead(snapToTimelineStep(clipEnd));

            if (clipEnd >= timelineContentEnd) {
                setIsPlaying(false);
            }

            return;
        }

        setPlayhead(nextTime);
    }

    function updatePlayheadFromTimelineAudio() {
        const timelineAudio = timelineAudioRef.current;

        if (!timelineAudio || !activeAudioClip) {
            return;
        }

        const nextTime = snapToTimelineStep(
            activeAudioClip.start +
                timelineAudio.currentTime -
                activeAudioClip.sourceStart,
        );
        const clipEnd = activeAudioClip.start + activeAudioClip.duration;

        if (nextTime >= clipEnd) {
            timelineAudio.pause();
            setPlayhead(snapToTimelineStep(clipEnd));

            if (clipEnd >= timelineContentEnd) {
                setIsPlaying(false);
            }

            return;
        }

        setPlayhead(nextTime);
    }

    function finishCurrentPreviewVideo() {
        if (!activeClip || activeClip.type !== 'video') {
            return;
        }

        const clipEnd = snapToTimelineStep(
            activeClip.start + activeClip.duration,
        );

        setPlayhead(clipEnd);

        if (clipEnd >= timelineContentEnd) {
            setIsPlaying(false);
        }
    }

    function finishCurrentTimelineAudio() {
        if (!activeAudioClip) {
            return;
        }

        const clipEnd = snapToTimelineStep(
            activeAudioClip.start + activeAudioClip.duration,
        );

        setPlayhead(clipEnd);

        if (clipEnd >= timelineContentEnd) {
            setIsPlaying(false);
        }
    }

    function cutSelectedClip() {
        const clip = selectedClip;

        if (!clip) {
            return;
        }

        const cutOffset = playhead - clip.start;

        if (cutOffset <= 0.25 || cutOffset >= clip.duration - 0.25) {
            return;
        }

        const firstPart: TimelineClip = {
            ...clip,
            duration: cutOffset,
        };
        const secondPart: TimelineClip = {
            ...clip,
            id: Date.now(),
            name: `${clip.name} cut`,
            start: playhead,
            duration: clip.duration - cutOffset,
            sourceStart: clip.sourceStart + cutOffset,
        };

        saveTimelineChange(
            timelineClips
                .map((currentClip) =>
                    currentClip.id === clip.id ? firstPart : currentClip,
                )
                .concat(secondPart)
                .sort((first, second) => first.start - second.start),
        );
        setSelectedClipId(secondPart.id);
    }

    function deleteSelectedTimelineClip() {
        if (!selectedClipId) {
            return;
        }

        // This removes the selected clip from the timeline only. The uploaded media file stays in the Media Pool.
        saveTimelineChange(
            timelineClips.filter((clip) => clip.id !== selectedClipId),
        );
        setSelectedClipId(null);
        setIsPlaying(false);
    }

    function updateSelectedClipProperty(
        property: keyof typeof defaultClipProperties,
        value: number,
    ) {
        if (!selectedVisualClip) {
            return;
        }

        // Resize controls belong to the selected timeline clip, so each clip can keep different settings.
        saveTimelineChange(
            timelineClips.map((clip) =>
                clip.id === selectedVisualClip.id
                    ? {
                          ...clip,
                          [property]: value,
                      }
                    : clip,
            ),
        );
    }

    function openMediaPicker() {
        fileInputRef.current?.click();
    }

    function uploadMedia(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        const type = getMediaType(file);

        if (!type) {
            setUploadError('Please upload a video, image, or audio file.');
            event.target.value = '';
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        // This sends the selected file to Laravel, where it is validated, stored, and saved in MySQL.
        router.post(
            `/projects/${project.id}/media`,
            { file, type },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: (errors) => {
                    setUploadError(
                        errors.file ??
                            'Upload failed. Check the file type and size.',
                    );
                },
                onFinish: () => {
                    setIsUploading(false);
                    event.target.value = '';
                },
            },
        );
    }

    function toggleDeleteMediaMode() {
        // Delete mode shows checkboxes, then lets the user confirm before files are removed.
        setIsDeletingMedia((currentValue) => !currentValue);
        setSelectedMediaIds([]);
    }

    function toggleSelectedMedia(mediaId: number) {
        setSelectedMediaIds((currentIds) => {
            if (currentIds.includes(mediaId)) {
                return currentIds.filter((id) => id !== mediaId);
            }

            return [...currentIds, mediaId];
        });
    }

    function deleteSelectedMedia() {
        if (selectedMediaIds.length === 0) {
            return;
        }

        if (!confirm('Are you sure you want to delete the selected media?')) {
            return;
        }

        const mediaIdsToDelete = [...selectedMediaIds];

        // This sends the selected media IDs to Laravel, where the files and database rows are deleted.
        router.delete(`/projects/${project.id}/media`, {
            data: {
                media_ids: mediaIdsToDelete,
            },
            preserveScroll: true,
            onSuccess: () => {
                // Keep the temporary editor state in sync after media deletion removes its timeline clips.
                saveTimelineChange(
                    timelineClips.filter(
                        (clip) => !mediaIdsToDelete.includes(clip.mediaId),
                    ),
                );
                setIsDeletingMedia(false);
                setSelectedMediaIds([]);
            },
        });
    }

    function togglePlayback() {
        // This controls the shared play/pause state for the preview video, audio track, and timeline playhead.
        if (
            !isPlaying &&
            timelineContentEnd > 0 &&
            playhead >= timelineContentEnd
        ) {
            setPlayhead(0);
        }

        setIsPlaying((currentValue) => !currentValue);
    }

    function selectTool(tool: 'select' | 'cut') {
        // This remembers which timeline tool is selected.
        setSelectedTool(tool);
    }

    function undoTemporaryChange() {
        // Move one step back through local timeline edits.
        const nextIndex = historyIndex - 1;

        if (nextIndex < 0) {
            return;
        }

        setHistoryIndex(nextIndex);
        setTimelineClips(history[nextIndex]);
        setSelectedClipId(null);
        setSaveStatus('unsaved');
    }

    function redoTemporaryChange() {
        // Move one step forward through local timeline edits.
        const nextIndex = historyIndex + 1;

        if (nextIndex >= history.length) {
            return;
        }

        setHistoryIndex(nextIndex);
        setTimelineClips(history[nextIndex]);
        setSelectedClipId(null);
        setSaveStatus('unsaved');
    }

    function resetResizeControls() {
        if (!selectedVisualClip) {
            return;
        }

        // Reset only the selected clip, leaving the other timeline clips unchanged.
        saveTimelineChange(
            timelineClips.map((clip) =>
                clip.id === selectedVisualClip.id
                    ? {
                          ...clip,
                          ...defaultClipProperties,
                      }
                    : clip,
            ),
        );
    }

    function changeTimelineZoom(amount: number) {
        setTimelineZoom((currentZoom) =>
            Math.min(1000, Math.max(0, currentZoom + amount)),
        );
    }

    return (
        <>
            <Head title={`${project.name} editor`} />

            {activeAudioClip && (
                <audio
                    key={activeAudioClip.id}
                    ref={timelineAudioRef}
                    onEnded={finishCurrentTimelineAudio}
                    preload="metadata"
                    src={activeAudioClip.url}
                />
            )}

            <main className="min-h-full bg-zinc-950 text-zinc-100">
                <div className="flex min-h-[calc(100vh-6.75rem)] flex-col">
                    <header className="grid min-h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-800 bg-zinc-950 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <Button
                                asChild
                                variant="ghost"
                                className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
                            >
                                <Link href="/dashboard">
                                    <ArrowLeft className="size-4" />
                                    Projects
                                </Link>
                            </Button>
                            <div className="hidden items-center gap-2 text-sm font-medium text-zinc-400 sm:flex">
                                <Clapperboard className="size-4 text-cyan-400" />
                                Editor
                            </div>
                        </div>

                        <div className="min-w-0 text-center">
                            <h1 className="truncate text-sm font-semibold text-white">
                                {project.name}
                            </h1>
                            <p className="text-xs text-zinc-500">
                                {project.format} · {project.status}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <span className="hidden text-xs text-zinc-500 sm:inline">
                                {saveStatus === 'saved'
                                    ? 'Saved'
                                    : 'Unsaved changes'}
                            </span>
                            <button
                                aria-checked={isAutoSaveEnabled}
                                className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                                onClick={() =>
                                    setIsAutoSaveEnabled(
                                        (currentValue) => !currentValue,
                                    )
                                }
                                role="switch"
                                type="button"
                            >
                                Auto save
                                <span
                                    className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                                        isAutoSaveEnabled
                                            ? 'bg-cyan-500'
                                            : 'bg-zinc-800'
                                    }`}
                                >
                                    <span
                                        className={`h-4 w-4 rounded-full bg-white transition ${
                                            isAutoSaveEnabled
                                                ? 'translate-x-4'
                                                : 'translate-x-0'
                                        }`}
                                    />
                                </span>
                            </button>
                            <Button
                                className="gap-2 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                disabled={isSavingTimeline}
                                onClick={() => saveTimeline()}
                                type="button"
                                variant="outline"
                            >
                                <Save className="size-4" />
                                {isSavingTimeline ? 'Saving' : 'Save'}
                            </Button>
                            <Button
                                asChild
                                className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                            >
                                <Link href={`/projects/${project.id}/export`}>
                                    Export
                                </Link>
                            </Button>
                        </div>
                    </header>

                    <section className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(420px,1fr)_auto]">
                        <aside className="grid border-b border-zinc-800 bg-zinc-900/70 lg:row-span-2 lg:grid-rows-[minmax(0,1fr)_auto] lg:border-r lg:border-b-0">
                            <section className="min-h-0 p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-sm font-semibold text-white">
                                            Media Pool
                                        </h2>
                                        <p className="text-xs text-zinc-500">
                                            Project files
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isDeletingMedia && (
                                            <Button
                                                className="h-9 border-red-500/40 bg-red-500/10 px-3 text-xs text-red-100 hover:bg-red-500/20"
                                                disabled={
                                                    selectedMediaIds.length ===
                                                    0
                                                }
                                                onClick={deleteSelectedMedia}
                                                type="button"
                                                variant="outline"
                                            >
                                                Delete
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                            disabled={media.length === 0}
                                            onClick={toggleDeleteMediaMode}
                                            title="Select media to delete"
                                            type="button"
                                        >
                                            <Trash2 className="size-4" />
                                            <span className="sr-only">
                                                Select media to delete
                                            </span>
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                            disabled={isUploading}
                                            onClick={openMediaPicker}
                                            title={uploadLimits}
                                            type="button"
                                        >
                                            <Upload className="size-4" />
                                            <span className="sr-only">
                                                Upload media
                                            </span>
                                        </Button>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        accept={acceptedMediaTypes}
                                        className="hidden"
                                        onChange={uploadMedia}
                                        type="file"
                                    />
                                </div>

                                {uploadError && (
                                    <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                        {uploadError}
                                    </p>
                                )}

                                {media.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {media.map((item) => {
                                            const MediaIcon = getMediaIcon(
                                                item.type,
                                            );

                                            return (
                                                <button
                                                    className={`group relative cursor-grab overflow-hidden rounded-lg border bg-zinc-950 text-left transition hover:border-cyan-500 active:cursor-grabbing ${
                                                        selectedMediaIds.includes(
                                                            item.id,
                                                        )
                                                            ? 'border-cyan-500'
                                                            : 'border-zinc-800'
                                                    }`}
                                                    draggable={!isDeletingMedia}
                                                    key={item.id}
                                                    onClick={() => {
                                                        if (isDeletingMedia) {
                                                            toggleSelectedMedia(
                                                                item.id,
                                                            );
                                                        }
                                                    }}
                                                    onDragStart={(event) =>
                                                        startMediaDrag(
                                                            event,
                                                            item,
                                                        )
                                                    }
                                                    onDragEnd={stopMediaDrag}
                                                    title="Drag to the timeline"
                                                    type="button"
                                                >
                                                    {isDeletingMedia && (
                                                        <span className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded border border-zinc-600 bg-zinc-950/90">
                                                            <input
                                                                checked={selectedMediaIds.includes(
                                                                    item.id,
                                                                )}
                                                                className="size-3.5 accent-cyan-500"
                                                                onChange={() =>
                                                                    toggleSelectedMedia(
                                                                        item.id,
                                                                    )
                                                                }
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                                type="checkbox"
                                                            />
                                                        </span>
                                                    )}
                                                    <span className="flex aspect-video items-center justify-center overflow-hidden bg-zinc-800">
                                                        {item.type ===
                                                        'image' ? (
                                                            <img
                                                                alt={item.name}
                                                                className="size-full object-cover transition group-hover:scale-105"
                                                                src={item.url}
                                                            />
                                                        ) : item.type ===
                                                          'video' ? (
                                                            <video
                                                                className="size-full object-cover transition group-hover:scale-105"
                                                                muted
                                                                onLoadedMetadata={(
                                                                    event,
                                                                ) =>
                                                                    rememberMediaDuration(
                                                                        item.id,
                                                                        event
                                                                            .currentTarget
                                                                            .duration,
                                                                    )
                                                                }
                                                                playsInline
                                                                preload="metadata"
                                                                src={item.url}
                                                            >
                                                                <track kind="captions" />
                                                            </video>
                                                        ) : (
                                                            <>
                                                                <MediaIcon className="size-6 text-zinc-400 group-hover:text-cyan-400" />
                                                                <audio
                                                                    className="hidden"
                                                                    onLoadedMetadata={(
                                                                        event,
                                                                    ) =>
                                                                        rememberMediaDuration(
                                                                            item.id,
                                                                            event
                                                                                .currentTarget
                                                                                .duration,
                                                                        )
                                                                    }
                                                                    preload="metadata"
                                                                    src={
                                                                        item.url
                                                                    }
                                                                />
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="block min-w-0 p-2">
                                                        <span className="block truncate text-xs font-medium text-zinc-200">
                                                            {item.name}
                                                        </span>
                                                        <span className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                                                            <span className="capitalize">
                                                                {item.type}
                                                            </span>
                                                            <span>
                                                                {mediaDurations[
                                                                    item.id
                                                                ]
                                                                    ? formatShortDuration(
                                                                          mediaDurations[
                                                                              item
                                                                                  .id
                                                                          ],
                                                                      )
                                                                    : formatFileSize(
                                                                          item.size,
                                                                      )}
                                                            </span>
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 px-4 py-8 text-center">
                                        <Upload className="mx-auto mb-3 size-6 text-zinc-500" />
                                        <p className="text-sm font-medium text-zinc-300">
                                            No media uploaded yet
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                                            {uploadLimits}
                                        </p>
                                    </div>
                                )}
                            </section>

                            <section className="border-t border-zinc-800 p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <WandSparkles className="size-4 text-cyan-400" />
                                    <div>
                                        <h2 className="text-sm font-semibold text-white">
                                            Effects Pool
                                        </h2>
                                        <p className="text-xs text-zinc-500">
                                            Temporary effects
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {effectItems.map((effect) => (
                                        <button
                                            className="flex w-full items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-cyan-500 hover:text-white"
                                            key={effect}
                                            type="button"
                                        >
                                            <span>{effect}</span>
                                            <span className="text-xs text-zinc-600">
                                                FX
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </aside>

                        <section className="flex items-center justify-center border-b border-zinc-800 bg-zinc-950 p-5 lg:border-r">
                            <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black shadow-2xl">
                                <div
                                    className={`${previewFrame.className} relative max-h-[92%] max-w-[92%] overflow-hidden rounded-sm border border-cyan-400/30 bg-zinc-900/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]`}
                                    style={{
                                        aspectRatio: previewFrame.aspectRatio,
                                    }}
                                >
                                    <div className="pointer-events-none absolute inset-0 border border-white/10" />
                                    <div className="pointer-events-none absolute top-2 right-2 rounded bg-black/35 px-2 py-1 font-mono text-[11px] text-zinc-400">
                                        {project.format}
                                    </div>

                                    <div
                                        className="absolute inset-0 flex items-center justify-center text-center transition"
                                        style={{
                                            transform: activeClip
                                                ? `translate(${activeClip.positionX}px, ${activeClip.positionY}px) rotate(${activeClip.rotation}deg) scale(${activeClip.scale / 100})`
                                                : undefined,
                                        }}
                                    >
                                        {activeClip?.type === 'image' ? (
                                            <img
                                                alt={activeClip.name}
                                                className="size-full object-cover"
                                                src={activeClip.url}
                                            />
                                        ) : activeClip?.type === 'video' ? (
                                            <video
                                                ref={previewVideoRef}
                                                className="size-full object-cover"
                                                muted
                                                onEnded={
                                                    finishCurrentPreviewVideo
                                                }
                                                onTimeUpdate={
                                                    updatePlayheadFromPreviewVideo
                                                }
                                                playsInline
                                                preload="metadata"
                                                src={activeClip.url}
                                            >
                                                <track kind="captions" />
                                            </video>
                                        ) : (
                                            <div className="flex size-full items-center justify-center bg-zinc-900">
                                                <div>
                                                    <Film className="mx-auto mb-4 size-16 text-cyan-400/80" />
                                                    <p className="text-lg font-semibold text-white">
                                                        {activeClip
                                                            ? activeClip.name
                                                            : previewLabel}
                                                    </p>
                                                    <p className="mt-1 text-sm text-zinc-500">
                                                        {activeClip
                                                            ? 'Current timeline clip'
                                                            : 'Add media to the timeline'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <aside className="border-b border-zinc-800 bg-zinc-900/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-white">
                                        Resize
                                    </h2>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {selectedVisualClip
                                            ? selectedVisualClip.name
                                            : 'Select a video or image clip'}
                                    </p>
                                </div>
                                <Button
                                    className="h-8 gap-2 border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                                    disabled={!selectedVisualClip}
                                    onClick={resetResizeControls}
                                    type="button"
                                    variant="outline"
                                >
                                    <RotateCcw className="size-3.5" />
                                    Reset
                                </Button>
                            </div>

                            <div className="mt-4 space-y-4">
                                <label className="block text-xs text-zinc-400">
                                    <span className="flex items-center justify-between gap-3">
                                        Scale
                                        <span className="flex items-center gap-1">
                                            <input
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                max="160"
                                                min="40"
                                                onChange={(event) =>
                                                    updateSelectedClipProperty(
                                                        'scale',
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={selectedClipScale}
                                            />
                                            <span className="text-zinc-500">
                                                %
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                onClick={() =>
                                                    updateSelectedClipProperty(
                                                        'scale',
                                                        100,
                                                    )
                                                }
                                                title="Reset scale"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500 disabled:opacity-50"
                                        disabled={!selectedVisualClip}
                                        max="160"
                                        min="40"
                                        onChange={(event) =>
                                            updateSelectedClipProperty(
                                                'scale',
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={selectedClipScale}
                                    />
                                </label>

                                <label className="block text-xs text-zinc-400">
                                    <span className="flex items-center justify-between gap-3">
                                        Position X
                                        <span className="flex items-center gap-1">
                                            <input
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                max="100"
                                                min="-100"
                                                onChange={(event) =>
                                                    updateSelectedClipProperty(
                                                        'positionX',
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={selectedClipPositionX}
                                            />
                                            <span className="text-zinc-500">
                                                px
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                onClick={() =>
                                                    updateSelectedClipProperty(
                                                        'positionX',
                                                        0,
                                                    )
                                                }
                                                title="Reset position X"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500 disabled:opacity-50"
                                        disabled={!selectedVisualClip}
                                        max="100"
                                        min="-100"
                                        onChange={(event) =>
                                            updateSelectedClipProperty(
                                                'positionX',
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={selectedClipPositionX}
                                    />
                                </label>

                                <label className="block text-xs text-zinc-400">
                                    <span className="flex items-center justify-between gap-3">
                                        Position Y
                                        <span className="flex items-center gap-1">
                                            <input
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                max="100"
                                                min="-100"
                                                onChange={(event) =>
                                                    updateSelectedClipProperty(
                                                        'positionY',
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={selectedClipPositionY}
                                            />
                                            <span className="text-zinc-500">
                                                px
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                onClick={() =>
                                                    updateSelectedClipProperty(
                                                        'positionY',
                                                        0,
                                                    )
                                                }
                                                title="Reset position Y"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500 disabled:opacity-50"
                                        disabled={!selectedVisualClip}
                                        max="100"
                                        min="-100"
                                        onChange={(event) =>
                                            updateSelectedClipProperty(
                                                'positionY',
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={selectedClipPositionY}
                                    />
                                </label>

                                <label className="block text-xs text-zinc-400">
                                    <span className="flex items-center justify-between gap-3">
                                        Rotation
                                        <span className="flex items-center gap-1">
                                            <input
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                max="180"
                                                min="-180"
                                                onChange={(event) =>
                                                    updateSelectedClipProperty(
                                                        'rotation',
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={selectedClipRotation}
                                            />
                                            <span className="text-zinc-500">
                                                deg
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                                                disabled={!selectedVisualClip}
                                                onClick={() =>
                                                    updateSelectedClipProperty(
                                                        'rotation',
                                                        0,
                                                    )
                                                }
                                                title="Reset rotation"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500 disabled:opacity-50"
                                        disabled={!selectedVisualClip}
                                        max="180"
                                        min="-180"
                                        onChange={(event) =>
                                            updateSelectedClipProperty(
                                                'rotation',
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={selectedClipRotation}
                                    />
                                </label>
                            </div>
                        </aside>

                        <section className="bg-zinc-900 lg:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="icon"
                                        onClick={togglePlayback}
                                        type="button"
                                    >
                                        {isPlaying ? (
                                            <Pause className="size-4" />
                                        ) : (
                                            <Play className="size-4" />
                                        )}
                                        <span className="sr-only">
                                            Toggle playback
                                        </span>
                                    </Button>
                                    <span className="font-mono text-sm text-zinc-400">
                                        {formatTimelineTime(playhead)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                        disabled={historyIndex === 0}
                                        onClick={undoTemporaryChange}
                                        title="Undo"
                                        type="button"
                                    >
                                        <Undo2 className="size-4" />
                                        <span className="sr-only">Undo</span>
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                        disabled={
                                            historyIndex >= history.length - 1
                                        }
                                        onClick={redoTemporaryChange}
                                        title="Redo"
                                        type="button"
                                    >
                                        <Redo2 className="size-4" />
                                        <span className="sr-only">Redo</span>
                                    </Button>
                                    <Button
                                        variant={
                                            selectedTool === 'select'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() => selectTool('select')}
                                    >
                                        <MousePointer2 className="size-4" />
                                        Select
                                    </Button>
                                    <Button
                                        variant={
                                            selectedTool === 'cut'
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() => {
                                            selectTool('cut');
                                            cutSelectedClip();
                                        }}
                                    >
                                        <Scissors className="size-4" />
                                        Cut
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                        disabled={!selectedClipId}
                                        onClick={deleteSelectedTimelineClip}
                                        title="Delete selected timeline clip"
                                        type="button"
                                    >
                                        <Trash2 className="size-4" />
                                        Delete
                                    </Button>
                                </div>

                                <label className="flex items-center gap-2">
                                    <span className="sr-only">
                                        Timeline zoom
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="size-8 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                        onClick={() => changeTimelineZoom(-50)}
                                        title="Zoom out"
                                        type="button"
                                    >
                                        <Minus className="size-4" />
                                        <span className="sr-only">
                                            Zoom out
                                        </span>
                                    </Button>
                                    <input
                                        className="w-32 accent-cyan-500"
                                        max="1000"
                                        min="0"
                                        onChange={(event) =>
                                            setTimelineZoom(
                                                Number(event.target.value),
                                            )
                                        }
                                        step="10"
                                        type="range"
                                        value={timelineZoom}
                                    />
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="size-8 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                        onClick={() => changeTimelineZoom(50)}
                                        title="Zoom in"
                                        type="button"
                                    >
                                        <Plus className="size-4" />
                                        <span className="sr-only">Zoom in</span>
                                    </Button>
                                </label>
                            </div>

                            <div
                                ref={timelineScrollRef}
                                className="overflow-x-auto"
                            >
                                <div
                                    className="min-w-[1100px]"
                                    style={{ width: timelineWidth }}
                                >
                                    <div className="grid grid-cols-[92px_1fr] border-b border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-500">
                                        <div className="border-r border-zinc-800 p-3 font-mono text-lg font-semibold text-zinc-300">
                                            {formatTimelineTime(playhead)}
                                        </div>
                                        <div
                                            className="relative min-h-10 cursor-ew-resize border-t border-red-500/70 bg-zinc-900/80 p-3 font-mono"
                                            onMouseDown={startPlayheadDrag}
                                        >
                                            {timelineMarks.map((mark) => (
                                                <span
                                                    className={`absolute top-3 ${
                                                        mark === 0
                                                            ? ''
                                                            : '-translate-x-1/2'
                                                    }`}
                                                    key={mark}
                                                    style={{
                                                        left: secondsToPixels(
                                                            mark,
                                                        ),
                                                    }}
                                                >
                                                    {formatTimelineTime(mark)}
                                                </span>
                                            ))}
                                            {timelineIntervals.map(
                                                (interval) => (
                                                    <span
                                                        className={`pointer-events-none absolute top-0 h-2 w-px ${
                                                            interval % 1 === 0
                                                                ? 'bg-zinc-500/70'
                                                                : 'bg-zinc-700/60'
                                                        }`}
                                                        key={`ruler-${interval}`}
                                                        style={{
                                                            left: secondsToPixels(
                                                                interval,
                                                            ),
                                                        }}
                                                    />
                                                ),
                                            )}
                                            <span
                                                className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500"
                                                style={{
                                                    left: secondsToPixels(
                                                        playhead,
                                                    ),
                                                }}
                                            />
                                            <span
                                                className="pointer-events-none absolute top-0 z-40 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-red-500"
                                                style={{
                                                    left: secondsToPixels(
                                                        playhead,
                                                    ),
                                                }}
                                            />
                                            {getTimelineDragMarkerStart() !==
                                                null && (
                                                <>
                                                    <span
                                                        className="pointer-events-none absolute top-0 bottom-0 z-40 w-px bg-red-400"
                                                        style={{
                                                            left: secondsToPixels(
                                                                getTimelineDragMarkerStart() ??
                                                                    0,
                                                            ),
                                                        }}
                                                    />
                                                    <span
                                                        className="pointer-events-none absolute top-0 z-50 h-4 w-4 -translate-x-1/2 rotate-45 rounded-[3px] border border-red-200/70 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]"
                                                        style={{
                                                            left: secondsToPixels(
                                                                getTimelineDragMarkerStart() ??
                                                                    0,
                                                            ),
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr]">
                                        <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            Video 1
                                        </div>
                                        <div
                                            data-timeline-track
                                            className="relative min-h-24 p-3"
                                            onDragLeave={leaveTimelineDrop}
                                            onDragOver={(event) =>
                                                allowTimelineDrop(
                                                    event,
                                                    'video',
                                                )
                                            }
                                            onDrop={(event) =>
                                                dropOnTimeline(event, 'video')
                                            }
                                        >
                                            <div
                                                className="absolute top-0 bottom-0 z-20 w-px bg-red-500"
                                                style={{
                                                    left: secondsToPixels(
                                                        playhead,
                                                    ),
                                                }}
                                            />
                                            {getTimelineDragMarkerStart() !==
                                                null && (
                                                <div
                                                    className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-400"
                                                    style={{
                                                        left: secondsToPixels(
                                                            getTimelineDragMarkerStart() ??
                                                                0,
                                                        ),
                                                    }}
                                                />
                                            )}
                                            {timelineClips
                                                .filter(
                                                    (clip) =>
                                                        clip.type !== 'audio',
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-14 cursor-grab items-center overflow-hidden rounded px-3 text-left text-sm font-medium text-white active:cursor-grabbing ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        draggable
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        onDragStart={(event) =>
                                                            startTimelineClipDrag(
                                                                event,
                                                                clip,
                                                            )
                                                        }
                                                        onDragEnd={
                                                            stopTimelineClipDrag
                                                        }
                                                        style={{
                                                            left: secondsToPixels(
                                                                getTimelineClipPreviewStart(
                                                                    clip,
                                                                ),
                                                            ),
                                                            width: Math.max(
                                                                secondsToPixels(
                                                                    clip.duration,
                                                                ),
                                                                24,
                                                            ),
                                                        }}
                                                        type="button"
                                                    >
                                                        <span
                                                            data-resize-handle
                                                            className="absolute top-0 bottom-0 left-0 z-10 w-2 cursor-ew-resize bg-white/10 transition hover:bg-white/35"
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                startClipTrim(
                                                                    event,
                                                                    clip,
                                                                    'left',
                                                                )
                                                            }
                                                        />
                                                        <span className="truncate">
                                                            {clip.name}
                                                        </span>
                                                        <span
                                                            data-resize-handle
                                                            className="absolute top-0 right-0 bottom-0 z-10 w-2 cursor-ew-resize bg-white/10 transition hover:bg-white/35"
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                startClipTrim(
                                                                    event,
                                                                    clip,
                                                                    'right',
                                                                )
                                                            }
                                                        />
                                                    </button>
                                                ))}
                                            {timelineDropPreview?.track ===
                                                'video' && (
                                                <div
                                                    className={`${timelineDropPreview.canPlace ? getTimelineColor(timelineDropPreview.type) : 'bg-red-500/80'} pointer-events-none absolute top-3 z-10 flex h-14 items-center overflow-hidden rounded border px-3 text-left text-sm font-medium text-white opacity-45 ${
                                                        timelineDropPreview.canPlace
                                                            ? 'border-white/35'
                                                            : 'border-red-200'
                                                    }`}
                                                    style={{
                                                        left: secondsToPixels(
                                                            timelineDropPreview.start,
                                                        ),
                                                        width: Math.max(
                                                            secondsToPixels(
                                                                timelineDropPreview.duration,
                                                            ),
                                                            24,
                                                        ),
                                                    }}
                                                >
                                                    <span className="truncate">
                                                        {
                                                            timelineDropPreview.name
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            {timelineClips.filter(
                                                (clip) => clip.type !== 'audio',
                                            ).length === 0 && (
                                                <div className="flex h-14 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Drag video or images here
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr] border-t border-zinc-800">
                                        <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            Audio 1
                                        </div>
                                        <div
                                            data-timeline-track
                                            className="relative min-h-16 p-3"
                                            onDragLeave={leaveTimelineDrop}
                                            onDragOver={(event) =>
                                                allowTimelineDrop(
                                                    event,
                                                    'audio',
                                                )
                                            }
                                            onDrop={(event) =>
                                                dropOnTimeline(event, 'audio')
                                            }
                                        >
                                            <div
                                                className="absolute top-0 bottom-0 z-20 w-px bg-red-500"
                                                style={{
                                                    left: secondsToPixels(
                                                        playhead,
                                                    ),
                                                }}
                                            />
                                            {getTimelineDragMarkerStart() !==
                                                null && (
                                                <div
                                                    className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-400"
                                                    style={{
                                                        left: secondsToPixels(
                                                            getTimelineDragMarkerStart() ??
                                                                0,
                                                        ),
                                                    }}
                                                />
                                            )}
                                            {timelineClips
                                                .filter(
                                                    (clip) =>
                                                        clip.type === 'audio',
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-9 cursor-grab items-center overflow-hidden rounded px-3 text-left text-sm font-medium text-white active:cursor-grabbing ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        draggable
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        onDragStart={(event) =>
                                                            startTimelineClipDrag(
                                                                event,
                                                                clip,
                                                            )
                                                        }
                                                        onDragEnd={
                                                            stopTimelineClipDrag
                                                        }
                                                        style={{
                                                            left: secondsToPixels(
                                                                getTimelineClipPreviewStart(
                                                                    clip,
                                                                ),
                                                            ),
                                                            width: Math.max(
                                                                secondsToPixels(
                                                                    clip.duration,
                                                                ),
                                                                24,
                                                            ),
                                                        }}
                                                        type="button"
                                                    >
                                                        <span
                                                            data-resize-handle
                                                            className="absolute top-0 bottom-0 left-0 z-10 w-2 cursor-ew-resize bg-white/10 transition hover:bg-white/35"
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                startClipTrim(
                                                                    event,
                                                                    clip,
                                                                    'left',
                                                                )
                                                            }
                                                        />
                                                        <span className="truncate">
                                                            {clip.name}
                                                        </span>
                                                        <span
                                                            data-resize-handle
                                                            className="absolute top-0 right-0 bottom-0 z-10 w-2 cursor-ew-resize bg-white/10 transition hover:bg-white/35"
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                startClipTrim(
                                                                    event,
                                                                    clip,
                                                                    'right',
                                                                )
                                                            }
                                                        />
                                                    </button>
                                                ))}
                                            {timelineDropPreview?.track ===
                                                'audio' && (
                                                <div
                                                    className={`pointer-events-none absolute top-3 z-10 flex h-9 items-center overflow-hidden rounded border px-3 text-left text-sm font-medium text-white opacity-45 ${
                                                        timelineDropPreview.canPlace
                                                            ? 'border-white/35 bg-emerald-700/80'
                                                            : 'border-red-200 bg-red-500/80'
                                                    }`}
                                                    style={{
                                                        left: secondsToPixels(
                                                            timelineDropPreview.start,
                                                        ),
                                                        width: Math.max(
                                                            secondsToPixels(
                                                                timelineDropPreview.duration,
                                                            ),
                                                            24,
                                                        ),
                                                    }}
                                                >
                                                    <span className="truncate">
                                                        {
                                                            timelineDropPreview.name
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            {timelineClips.filter(
                                                (clip) => clip.type === 'audio',
                                            ).length === 0 && (
                                                <div className="flex h-9 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Drag audio here
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </section>
                </div>
            </main>
        </>
    );
}

Editor.layout = {
    breadcrumbs: [],
};
