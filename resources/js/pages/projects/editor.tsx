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
    Type,
    Trash2,
    Upload,
    Undo2,
    Volume2,
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

type TimelineClipType = ProjectMedia['type'] | 'text';

type TimelineClip = {
    id: number;
    mediaId: number | null;
    name: string;
    type: TimelineClipType;
    trackIndex: number;
    start: number;
    duration: number;
    sourceStart: number;
    scale: number;
    positionX: number;
    positionY: number;
    rotation: number;
    previewWidth?: number | null;
    previewHeight?: number | null;
    color: string;
    url: string | null;
};

type MediaDimensions = {
    width: number;
    height: number;
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
    track: TimelineTrack;
    name: string;
    type: TimelineClipType;
    trackIndex: number;
    start: number;
    duration: number;
    canPlace: boolean;
};

type TimelineTrack = 'video' | 'audio' | 'text';

type TimelineClipMovePreview = {
    clipId: number;
    linkedClipIds: number[];
    originalStart: number;
    previewStart: number;
    offsetPixels: number;
};

type CutPreview = {
    clipId: number;
    time: number;
};

type TextPreviewDragState = {
    clipId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    startingClips: TimelineClip[];
};

type VisualPreviewDragState = {
    action: 'move' | 'scale';
    clipId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    startScale: number;
    startRotation: number;
    mediaBounds: PreviewMediaBounds | null;
    startingClips: TimelineClip[];
};

type PreviewMediaBounds = {
    width: number;
    height: number;
    left: number;
    top: number;
};

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
const maxClipScale = 1000;
const mediaDragType = 'application/x-video-editor-media';
const clipDragType = 'application/x-video-editor-clip';
const textDragType = 'application/x-video-editor-text';

function getTextClipContent(name: string) {
    return name.replace(/(?: cut)+$/i, '');
}

function getClipTrack(clip: Pick<TimelineClip, 'type'>): TimelineTrack {
    if (clip.type === 'audio') {
        return 'audio';
    }

    if (clip.type === 'text') {
        return 'text';
    }

    return 'video';
}

const defaultClipProperties = {
    scale: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
};

function getTemporaryClipDuration(type: TimelineClipType) {
    if (type === 'text') {
        return 5;
    }

    if (type === 'image') {
        return 5;
    }

    if (type === 'audio') {
        return 12;
    }

    return 10;
}

function getTimelineColor(type: TimelineClipType) {
    if (type === 'text') {
        return 'bg-violet-600';
    }

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
    const previewFrameRef = useRef<HTMLDivElement>(null);
    const visualPreviewClipRef = useRef<HTMLDivElement>(null);
    const visualPreviewBoxRef = useRef<HTMLDivElement>(null);
    const visualPreviewBoxInnerRef = useRef<HTMLDivElement>(null);
    const timelineAudioRef = useRef<HTMLAudioElement>(null);
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef(0);
    const latestTrimClipsRef = useRef<TimelineClip[] | null>(null);
    const latestTextPreviewDragClipsRef = useRef<TimelineClip[] | null>(null);
    const latestVisualPreviewDragClipsRef = useRef<TimelineClip[] | null>(null);
    const pendingSaveRef = useRef<{
        clips: TimelineClip[];
        autoSave: boolean;
    } | null>(null);
    const isSavingTimelineRef = useRef(false);
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
    const [mediaDimensions, setMediaDimensions] = useState<
        Record<number, MediaDimensions>
    >({});
    const initialTimelineClips = useMemo(
        () =>
            savedTimelineClips.map((clip) => ({
                ...defaultClipProperties,
                ...clip,
                name:
                    clip.type === 'text'
                        ? getTextClipContent(clip.name)
                        : clip.name,
                trackIndex: clip.trackIndex ?? 1,
                start: snapToTimelineStep(clip.start),
                duration: snapToTimelineStep(clip.duration),
                sourceStart: snapToTimelineStep(clip.sourceStart),
                color: getTimelineColor(clip.type),
            })),
        [savedTimelineClips],
    );
    const [timelineClips, setTimelineClips] =
        useState<TimelineClip[]>(initialTimelineClips);
    const [timelineTrackCounts, setTimelineTrackCounts] = useState<
        Record<TimelineTrack, number>
    >(() =>
        initialTimelineClips.reduce(
            (counts, clip) => ({
                ...counts,
                [getClipTrack(clip)]: Math.max(
                    counts[getClipTrack(clip)],
                    clip.trackIndex,
                ),
            }),
            { video: 1, text: 1, audio: 1 },
        ),
    );
    const [history, setHistory] = useState<TimelineClip[][]>([
        initialTimelineClips,
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
    const [playhead, setPlayhead] = useState(0);
    const [isSavingTimeline, setIsSavingTimeline] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved');
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
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
    const [cutPreview, setCutPreview] = useState<CutPreview | null>(null);
    const [textPreviewDragState, setTextPreviewDragState] =
        useState<TextPreviewDragState | null>(null);
    const [visualPreviewDragState, setVisualPreviewDragState] =
        useState<VisualPreviewDragState | null>(null);
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
        return (
            timelineClips
                .filter(
                    (clip) =>
                        (clip.type === 'video' || clip.type === 'image') &&
                        playhead >= clip.start &&
                        playhead < clip.start + clip.duration,
                )
                .sort(
                    (first, second) =>
                        second.trackIndex - first.trackIndex ||
                        second.start - first.start,
                )[0] ?? null
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
    const activeTextClips = useMemo(() => {
        return timelineClips.filter(
            (clip) =>
                clip.type === 'text' &&
                playhead >= clip.start &&
                playhead < clip.start + clip.duration,
        );
    }, [playhead, timelineClips]);

    const selectedClip = useMemo(() => {
        return timelineClips.find((clip) => clip.id === selectedClipId) ?? null;
    }, [selectedClipId, timelineClips]);
    const selectedVisualClip =
        selectedClip &&
        (selectedClip.type === 'video' || selectedClip.type === 'image')
            ? selectedClip
            : null;
    const selectedTextClip =
        selectedClip && selectedClip.type === 'text' ? selectedClip : null;
    const selectedClipScale =
        selectedVisualClip?.scale ?? defaultClipProperties.scale;
    const selectedClipPositionX =
        selectedVisualClip?.positionX ?? defaultClipProperties.positionX;
    const selectedClipPositionY =
        selectedVisualClip?.positionY ?? defaultClipProperties.positionY;
    const selectedClipRotation =
        selectedVisualClip?.rotation ?? defaultClipProperties.rotation;
    const activeClipMediaBounds = getContainedMediaBounds(activeClip);
    const activeClipBoxBounds =
        activeClipMediaBounds && activeClip
            ? getScaledMediaBounds(activeClipMediaBounds, activeClip.scale)
            : null;

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
        playheadRef.current = playhead;
    }, [playhead]);

    useEffect(() => {
        if (selectedTool !== 'cut') {
            setCutPreview(null);
        }
    }, [selectedTool]);

    useEffect(() => {
        if (!isPlaying) {
            return;
        }

        let lastTick = performance.now();

        const timer = window.setInterval(() => {
            const now = performance.now();
            const elapsedSeconds = (now - lastTick) / 1000;
            lastTick = now;

            setPlayhead((currentTime) => {
                if (currentTime >= timelineContentEnd) {
                    setIsPlaying(false);
                    return snapToTimelineStep(timelineContentEnd);
                }

                return snapToTimelineStep(
                    Math.min(timelineContentEnd, currentTime + elapsedSeconds),
                );
            });
        }, timelinePlaybackIntervalMs);

        return () => window.clearInterval(timer);
    }, [isPlaying, timelineContentEnd]);

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
            activeClip.sourceStart + playheadRef.current - activeClip.start,
        );

        if (!isPlaying) {
            previewVideo.pause();
            previewVideo.currentTime = clipTime;
            return;
        }

        // On play start or clip switch, seek once. After that the browser plays the media normally.
        previewVideo.currentTime = clipTime;
        void previewVideo.play();
    }, [activeClip?.id, isPlaying]);

    useEffect(() => {
        const previewVideo = previewVideoRef.current;

        if (isPlaying || !previewVideo || activeClip?.type !== 'video') {
            return;
        }

        const clipTime = Math.max(
            0,
            activeClip.sourceStart + playhead - activeClip.start,
        );

        if (Math.abs(previewVideo.currentTime - clipTime) > 0.08) {
            previewVideo.currentTime = clipTime;
        }
    }, [activeClip, isPlaying]);

    useEffect(() => {
        if (!isPlaying || activeClip?.type !== 'video') {
            return;
        }

        const timer = window.setInterval(() => {
            const previewVideo = previewVideoRef.current;

            if (!previewVideo) {
                return;
            }

            const expectedClipTime = Math.max(
                0,
                activeClip.sourceStart + playheadRef.current - activeClip.start,
            );

            if (Math.abs(previewVideo.currentTime - expectedClipTime) > 0.35) {
                previewVideo.currentTime = expectedClipTime;
            }
        }, 250);

        return () => window.clearInterval(timer);
    }, [activeClip, isPlaying, playhead]);

    useEffect(() => {
        const timelineAudio = timelineAudioRef.current;

        if (!timelineAudio) {
            return;
        }

        if (!activeAudioClip) {
            timelineAudio.pause();
            return;
        }

        const clipTime = Math.max(
            0,
            activeAudioClip.sourceStart +
                playheadRef.current -
                activeAudioClip.start,
        );

        if (!isPlaying) {
            timelineAudio.pause();
            timelineAudio.currentTime = clipTime;
            return;
        }

        // Start audio once for the current clip. Constant play calls can make browsers drop audio.
        timelineAudio.currentTime = clipTime;
        void timelineAudio.play().catch(() => {
            setIsPlaying(false);
        });
    }, [activeAudioClip?.id, isPlaying]);

    useEffect(() => {
        const timelineAudio = timelineAudioRef.current;

        if (isPlaying || !timelineAudio || !activeAudioClip) {
            return;
        }

        const clipTime = Math.max(
            0,
            activeAudioClip.sourceStart + playhead - activeAudioClip.start,
        );

        if (Math.abs(timelineAudio.currentTime - clipTime) > 0.08) {
            timelineAudio.currentTime = clipTime;
        }
    }, [activeAudioClip, isPlaying, playhead]);

    useEffect(() => {
        if (!isPlaying || !activeAudioClip) {
            return;
        }

        const timer = window.setInterval(() => {
            const timelineAudio = timelineAudioRef.current;

            if (!timelineAudio) {
                return;
            }

            const expectedClipTime = Math.max(
                0,
                activeAudioClip.sourceStart +
                    playheadRef.current -
                    activeAudioClip.start,
            );

            if (Math.abs(timelineAudio.currentTime - expectedClipTime) > 0.35) {
                timelineAudio.currentTime = expectedClipTime;
            }
        }, 250);

        return () => window.clearInterval(timer);
    }, [activeAudioClip, isPlaying]);

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

    useEffect(() => {
        if (!textPreviewDragState) {
            return;
        }

        const currentDragState = textPreviewDragState;

        function dragTextPreview(event: MouseEvent) {
            const nextPositionX =
                currentDragState.startPositionX +
                event.clientX -
                currentDragState.startClientX;
            const nextPositionY =
                currentDragState.startPositionY +
                event.clientY -
                currentDragState.startClientY;
            const nextClips = currentDragState.startingClips.map((clip) =>
                clip.id === currentDragState.clipId
                    ? {
                          ...clip,
                          positionX: Math.round(nextPositionX),
                          positionY: Math.round(nextPositionY),
                      }
                    : clip,
            );

            latestTextPreviewDragClipsRef.current = nextClips;
            setTimelineClips(nextClips);
            setSaveStatus('unsaved');
        }

        function stopDraggingTextPreview() {
            if (latestTextPreviewDragClipsRef.current) {
                saveTimelineChange(latestTextPreviewDragClipsRef.current);
            }

            latestTextPreviewDragClipsRef.current = null;
            setTextPreviewDragState(null);
        }

        window.addEventListener('mousemove', dragTextPreview);
        window.addEventListener('mouseup', stopDraggingTextPreview);

        return () => {
            window.removeEventListener('mousemove', dragTextPreview);
            window.removeEventListener('mouseup', stopDraggingTextPreview);
        };
    }, [textPreviewDragState, history, historyIndex]);

    useEffect(() => {
        if (!visualPreviewDragState) {
            return;
        }

        const currentDragState = visualPreviewDragState;

        function dragVisualPreview(event: MouseEvent) {
            let nextPositionX = currentDragState.startPositionX;
            let nextPositionY = currentDragState.startPositionY;
            let nextScale = currentDragState.startScale;

            if (currentDragState.action === 'scale') {
                const dragDistance =
                    event.clientX -
                    currentDragState.startClientX +
                    (event.clientY - currentDragState.startClientY);

                nextScale = Math.min(
                    maxClipScale,
                    Math.max(
                        40,
                        Math.round(
                            currentDragState.startScale + dragDistance * 0.35,
                        ),
                    ),
                );
            } else {
                nextPositionX = Math.round(
                    currentDragState.startPositionX +
                        event.clientX -
                        currentDragState.startClientX,
                );
                nextPositionY = Math.round(
                    currentDragState.startPositionY +
                        event.clientY -
                        currentDragState.startClientY,
                );
            }

            const nextClips = currentDragState.startingClips.map((clip) => {
                if (clip.id !== currentDragState.clipId) {
                    return clip;
                }

                if (currentDragState.action === 'scale') {
                    return {
                        ...clip,
                        scale: nextScale,
                    };
                }

                return {
                    ...clip,
                    positionX: nextPositionX,
                    positionY: nextPositionY,
                };
            });

            if (visualPreviewClipRef.current) {
                visualPreviewClipRef.current.style.transform = `translate(${nextPositionX}px, ${nextPositionY}px) rotate(${currentDragState.startRotation}deg) scale(${nextScale / 100})`;
            }

            if (visualPreviewBoxRef.current) {
                visualPreviewBoxRef.current.style.transform = `translate(${nextPositionX}px, ${nextPositionY}px) rotate(${currentDragState.startRotation}deg)`;
            }

            if (
                visualPreviewBoxInnerRef.current &&
                currentDragState.mediaBounds
            ) {
                const nextBounds = getScaledMediaBounds(
                    currentDragState.mediaBounds,
                    nextScale,
                );

                visualPreviewBoxInnerRef.current.style.left = `${nextBounds.left}px`;
                visualPreviewBoxInnerRef.current.style.top = `${nextBounds.top}px`;
                visualPreviewBoxInnerRef.current.style.width = `${nextBounds.width}px`;
                visualPreviewBoxInnerRef.current.style.height = `${nextBounds.height}px`;
            }

            latestVisualPreviewDragClipsRef.current = nextClips;
        }

        function stopDraggingVisualPreview() {
            if (latestVisualPreviewDragClipsRef.current) {
                saveTimelineChange(latestVisualPreviewDragClipsRef.current);
            }

            latestVisualPreviewDragClipsRef.current = null;
            setVisualPreviewDragState(null);
        }

        window.addEventListener('mousemove', dragVisualPreview);
        window.addEventListener('mouseup', stopDraggingVisualPreview);

        return () => {
            window.removeEventListener('mousemove', dragVisualPreview);
            window.removeEventListener('mouseup', stopDraggingVisualPreview);
        };
    }, [visualPreviewDragState, history, historyIndex]);

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
        setSaveError(null);
    }

    function getTimelineSavePayload(clips: TimelineClip[], autoSave = false) {
        const previewBounds = previewFrameRef.current?.getBoundingClientRect();
        const previewWidth = previewBounds
            ? Math.round(previewBounds.width)
            : null;
        const previewHeight = previewBounds
            ? Math.round(previewBounds.height)
            : null;

        return {
            autoSave,
            clips: clips.map((clip) => ({
                mediaId: clip.mediaId,
                name:
                    clip.type === 'text'
                        ? getTextClipContent(clip.name)
                        : clip.name,
                type: clip.type,
                trackIndex: clip.trackIndex,
                start: clip.start,
                duration: clip.duration,
                sourceStart: clip.sourceStart,
                scale: clip.scale,
                positionX: clip.positionX,
                positionY: clip.positionY,
                rotation: clip.rotation,
                previewWidth:
                    clip.type === 'text' ||
                    clip.type === 'video' ||
                    clip.type === 'image'
                        ? (previewWidth ?? clip.previewWidth ?? null)
                        : clip.previewWidth,
                previewHeight:
                    clip.type === 'text' ||
                    clip.type === 'video' ||
                    clip.type === 'image'
                        ? (previewHeight ?? clip.previewHeight ?? null)
                        : clip.previewHeight,
            })),
        };
    }

    function getTimelineSaveSignature(clips: TimelineClip[]) {
        return JSON.stringify(getTimelineSavePayload(clips).clips);
    }

    function saveTimeline(clipsToSave = timelineClips, autoSave = false) {
        if (isSavingTimelineRef.current) {
            pendingSaveRef.current = {
                clips: clipsToSave,
                autoSave,
            };
            return;
        }

        const saveRequestId = activeSaveRequestRef.current + 1;
        const savedTimelineSignature = getTimelineSaveSignature(clipsToSave);

        activeSaveRequestRef.current = saveRequestId;
        isSavingTimelineRef.current = true;
        setIsSavingTimeline(true);
        setSaveError(null);

        // This saves the current timeline layout to MySQL, so it can load again after refresh.
        router.put(
            `/projects/${project.id}/timeline`,
            getTimelineSavePayload(clipsToSave, autoSave),
            {
                preserveScroll: true,
                onError: (errors) => {
                    setSaveStatus('unsaved');
                    setSaveError(
                        Object.values(errors)[0] ??
                            'Timeline could not be saved.',
                    );
                },
                onSuccess: () => {
                    setSaveError(null);
                    setSaveStatus(
                        savedTimelineSignature ===
                            latestTimelineSignatureRef.current
                            ? 'saved'
                            : 'unsaved',
                    );
                },
                onFinish: () => {
                    if (activeSaveRequestRef.current === saveRequestId) {
                        isSavingTimelineRef.current = false;
                        setIsSavingTimeline(false);

                        const pendingSave = pendingSaveRef.current;

                        if (pendingSave) {
                            pendingSaveRef.current = null;
                            window.setTimeout(() => {
                                saveTimeline(
                                    pendingSave.clips,
                                    pendingSave.autoSave,
                                );
                            }, 0);
                        }
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

    function rememberMediaDimensions(
        mediaId: number | null,
        width: number,
        height: number,
    ) {
        if (
            !mediaId ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return;
        }

        setMediaDimensions((currentDimensions) => ({
            ...currentDimensions,
            [mediaId]: {
                width,
                height,
            },
        }));
    }

    function getContainedMediaBounds(clip: TimelineClip | null | undefined) {
        if (!clip?.mediaId) {
            return null;
        }

        const dimensions = mediaDimensions[clip.mediaId];
        const previewBounds = previewFrameRef.current?.getBoundingClientRect();

        if (!dimensions || !previewBounds) {
            return null;
        }

        const scale = Math.min(
            previewBounds.width / dimensions.width,
            previewBounds.height / dimensions.height,
        );
        const width = dimensions.width * scale;
        const height = dimensions.height * scale;

        return {
            width,
            height,
            left: (previewBounds.width - width) / 2,
            top: (previewBounds.height - height) / 2,
        };
    }

    function getScaledMediaBounds(
        bounds: PreviewMediaBounds,
        scalePercent: number,
    ) {
        const scale = scalePercent / 100;
        const width = bounds.width * scale;
        const height = bounds.height * scale;

        return {
            width,
            height,
            left: bounds.left + (bounds.width - width) / 2,
            top: bounds.top + (bounds.height - height) / 2,
        };
    }

    function createTimelineClipsFromMedia(
        item: ProjectMedia,
        start: number,
        trackIndex = 1,
    ) {
        const duration = getMediaTimelineDuration(item);
        const nextClip: TimelineClip = {
            id: Date.now(),
            mediaId: item.id,
            name: item.name,
            type: item.type,
            trackIndex,
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
                trackIndex: 1,
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

    function createTextClip(start: number, trackIndex = 1): TimelineClip {
        return {
            id: Date.now(),
            mediaId: null,
            name: 'Text',
            type: 'text',
            trackIndex,
            start,
            duration: getTemporaryClipDuration('text'),
            sourceStart: 0,
            ...defaultClipProperties,
            color: getTimelineColor('text'),
            url: null,
        };
    }

    function getMediaTimelineDuration(item: ProjectMedia) {
        return mediaDurations[item.id] ?? getTemporaryClipDuration(item.type);
    }

    function addTextToTimelineAt(start: number, trackIndex = 1) {
        const nextClip = createTextClip(
            snapToTimelineStep(Math.max(0, start)),
            trackIndex,
        );

        if (!canPlaceTimelineClips([nextClip])) {
            return;
        }

        saveTimelineChange([...timelineClips, nextClip]);
        setSelectedClipId(nextClip.id);
        setIsPlaying(false);
    }

    function timelineClipOverlaps(
        clip: Pick<TimelineClip, 'start' | 'duration' | 'type' | 'trackIndex'>,
        otherClip: Pick<
            TimelineClip,
            'start' | 'duration' | 'type' | 'trackIndex'
        >,
    ) {
        if (
            getClipTrack(clip) !== getClipTrack(otherClip) ||
            clip.trackIndex !== otherClip.trackIndex
        ) {
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
                    otherClip.trackIndex === clip.trackIndex &&
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
                    otherClip.trackIndex === clip.trackIndex &&
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

    function addMediaToTimelineAt(
        item: ProjectMedia,
        start: number,
        trackIndex = 1,
    ) {
        const nextStart = snapToTimelineStep(Math.max(0, start));
        const nextClips = createTimelineClipsFromMedia(
            item,
            nextStart,
            trackIndex,
        );
        const primaryClip = nextClips[0];

        if (!canPlaceTimelineClips(nextClips)) {
            return;
        }

        saveTimelineChange([...timelineClips, ...nextClips]);
        setSelectedClipId(primaryClip.id);
        setIsPlaying(false);
    }

    function moveTimelineClipTo(
        clipId: number,
        start: number,
        trackIndex?: number,
    ) {
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
                          trackIndex:
                              clip.id === movingClip.id
                                  ? (trackIndex ?? clip.trackIndex)
                                  : clip.trackIndex,
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
        if (clip.type === 'text') {
            return Number.POSITIVE_INFINITY;
        }

        // Metadata gives the true source duration after the browser has loaded it. Existing saved clips use their current source span as a safe fallback.
        return Math.max(
            clip.mediaId
                ? (mediaDurations[clip.mediaId] ??
                      getTemporaryClipDuration(clip.type))
                : getTemporaryClipDuration(clip.type),
            clip.sourceStart + clip.duration,
        );
    }

    function getLinkedClipIds(clipToMatch: TimelineClip) {
        if (clipToMatch.type === 'text') {
            return [clipToMatch.id];
        }

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

    function canPlaceOnTrack(type: TimelineClipType, track: TimelineTrack) {
        if (track === 'text') {
            return type === 'text';
        }

        if (track === 'audio') {
            return type === 'audio';
        }

        return type === 'video' || type === 'image';
    }

    function addTimelineTrack(track: TimelineTrack) {
        setTimelineTrackCounts((counts) => ({
            ...counts,
            [track]: counts[track] + 1,
        }));
    }

    function startTextDrag(event: React.DragEvent<HTMLButtonElement>) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(textDragType, 'text');
        setTimelineDropPreview(null);

        hideBrowserDragImage(event);
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
        track: TimelineTrack,
        trackIndex = 1,
    ) {
        if (event.dataTransfer.types.includes(textDragType)) {
            if (!canPlaceOnTrack('text', track)) {
                setTimelineDropPreview(null);
                return;
            }

            const previewStart = snapToTimelineStep(
                getTimelineDropStart(event),
            );
            const previewClip = createTextClip(previewStart, trackIndex);

            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setTimelineDropPreview({
                track,
                name: previewClip.name,
                type: previewClip.type,
                trackIndex,
                start: previewStart,
                duration: previewClip.duration,
                canPlace: canPlaceTimelineClips([previewClip]),
            });
            return;
        }

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
                trackIndex,
            );

            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setTimelineDropPreview({
                track,
                name: draggingMedia.name,
                type: draggingMedia.type,
                trackIndex,
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
        track: TimelineTrack,
        trackIndex = 1,
    ) {
        event.preventDefault();

        if (event.dataTransfer.getData(textDragType)) {
            if (canPlaceOnTrack('text', track)) {
                addTextToTimelineAt(getTimelineDropStart(event), trackIndex);
            }

            setTimelineDropPreview(null);
            return;
        }

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

            addMediaToTimelineAt(
                draggedMedia,
                getTimelineDropStart(event),
                trackIndex,
            );
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

        moveTimelineClipTo(
            clipId,
            getTimelineDropStart(event, offsetPixels),
            trackIndex,
        );
        stopTimelineClipDrag();
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

    function cutTimelineClipAt(clip: TimelineClip, cutTime: number) {
        const snappedCutTime = snapToTimelineStep(cutTime);
        const cutOffset = snapToTimelineStep(snappedCutTime - clip.start);

        if (
            cutOffset <= timelineFrameDurationSeconds ||
            cutOffset >= clip.duration - timelineFrameDurationSeconds
        ) {
            return;
        }

        const clipName =
            clip.type === 'text' ? getTextClipContent(clip.name) : clip.name;
        const firstPart: TimelineClip = {
            ...clip,
            name: clipName,
            duration: cutOffset,
        };
        const secondPart: TimelineClip = {
            ...clip,
            id: Date.now(),
            name: clipName,
            start: snappedCutTime,
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

    function getTimelineClipPointerTime(
        event: React.MouseEvent<HTMLButtonElement>,
        clip: TimelineClip,
    ) {
        const clipBounds = event.currentTarget.getBoundingClientRect();
        const clickRatio =
            clipBounds.width > 0
                ? Math.min(
                      1,
                      Math.max(
                          0,
                          (event.clientX - clipBounds.left) / clipBounds.width,
                      ),
                  )
                : 0;

        return snapToTimelineStep(clip.start + clip.duration * clickRatio);
    }

    function updateCutPreviewFromPointer(
        event: React.MouseEvent<HTMLButtonElement>,
        clip: TimelineClip,
    ) {
        if (selectedTool !== 'cut') {
            return;
        }

        const target = event.target as HTMLElement | null;

        if (target?.closest('[data-resize-handle]')) {
            return;
        }

        setCutPreview({
            clipId: clip.id,
            time: getTimelineClipPointerTime(event, clip),
        });
    }

    function clearCutPreview(clipId?: number) {
        setCutPreview((currentPreview) =>
            clipId === undefined || currentPreview?.clipId === clipId
                ? null
                : currentPreview,
        );
    }

    function renderCutPreviewMarker(clip: TimelineClip) {
        if (selectedTool !== 'cut' || cutPreview?.clipId !== clip.id) {
            return null;
        }

        const markerPosition = Math.max(
            0,
            Math.min(
                secondsToPixels(clip.duration),
                secondsToPixels(cutPreview.time - clip.start),
            ),
        );

        return (
            <span
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                style={{ left: markerPosition }}
            />
        );
    }

    function cutTimelineClipFromClick(
        event: React.MouseEvent<HTMLButtonElement>,
        clip: TimelineClip,
    ) {
        const target = event.target as HTMLElement | null;

        if (target?.closest('[data-resize-handle]')) {
            return;
        }

        cutTimelineClipAt(clip, getTimelineClipPointerTime(event, clip));
        clearCutPreview(clip.id);
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

    function updateSelectedTextClipName(name: string) {
        if (!selectedTextClip) {
            return;
        }

        // Text clips store their visible text in the clip name, so saving the timeline also saves this text.
        saveTimelineChange(
            timelineClips.map((clip) =>
                clip.id === selectedTextClip.id
                    ? {
                          ...clip,
                          name: getTextClipContent(name),
                      }
                    : clip,
            ),
        );
    }

    function updateSelectedTextClipProperty(
        property: keyof typeof defaultClipProperties,
        value: number,
    ) {
        if (!selectedTextClip) {
            return;
        }

        // Text clips reuse the same transform fields as video clips, which keeps saving simple.
        saveTimelineChange(
            timelineClips.map((clip) =>
                clip.id === selectedTextClip.id
                    ? {
                          ...clip,
                          [property]: value,
                      }
                    : clip,
            ),
        );
    }

    function resetTextControls() {
        if (!selectedTextClip) {
            return;
        }

        saveTimelineChange(
            timelineClips.map((clip) =>
                clip.id === selectedTextClip.id
                    ? {
                          ...clip,
                          ...defaultClipProperties,
                      }
                    : clip,
            ),
        );
    }

    function startTextPreviewDrag(
        event: React.MouseEvent<HTMLButtonElement>,
        clip: TimelineClip,
    ) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedClipId(clip.id);
        setIsPlaying(false);

        // Dragging text in the preview changes that text clip's saved position.
        setTextPreviewDragState({
            clipId: clip.id,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPositionX: clip.positionX,
            startPositionY: clip.positionY,
            startingClips: timelineClips,
        });
    }

    function startVisualPreviewDrag(
        event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>,
        clip: TimelineClip,
        action: 'move' | 'scale',
    ) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedClipId(clip.id);
        setIsPlaying(false);

        // Dragging visual clips in the preview updates the same transform values used by the resize panel.
        setVisualPreviewDragState({
            action,
            clipId: clip.id,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPositionX: clip.positionX,
            startPositionY: clip.positionY,
            startScale: clip.scale,
            startRotation: clip.rotation,
            mediaBounds: getContainedMediaBounds(clip),
            startingClips: timelineClips,
        });
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
                        (clip) =>
                            !clip.mediaId ||
                            !mediaIdsToDelete.includes(clip.mediaId),
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

    function renderTimelineLane(track: TimelineTrack, trackIndex: number) {
        const isVideoTrack = track === 'video';
        const trackClips = timelineClips.filter(
            (clip) =>
                getClipTrack(clip) === track && clip.trackIndex === trackIndex,
        );
        const clipHeightClass = isVideoTrack ? 'h-14' : 'h-9';
        const minHeightClass = isVideoTrack ? 'min-h-24' : 'min-h-16';
        const emptyText =
            track === 'video'
                ? 'Drag video or images here'
                : track === 'text'
                  ? 'Drag text here'
                  : 'Drag audio here';

        return (
            <div
                className="grid grid-cols-[92px_1fr] border-t border-zinc-800"
                key={`${track}-${trackIndex}`}
            >
                <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                    {track === 'video'
                        ? `Video ${trackIndex}`
                        : track === 'audio'
                          ? `Audio ${trackIndex}`
                          : `Text ${trackIndex}`}
                </div>
                <div
                    data-timeline-track
                    className={`relative ${minHeightClass} p-3`}
                    onDragLeave={leaveTimelineDrop}
                    onDragOver={(event) =>
                        allowTimelineDrop(event, track, trackIndex)
                    }
                    onDrop={(event) => dropOnTimeline(event, track, trackIndex)}
                >
                    <div
                        className="absolute top-0 bottom-0 z-20 w-px bg-red-500"
                        style={{ left: secondsToPixels(playhead) }}
                    />
                    {getTimelineDragMarkerStart() !== null && (
                        <div
                            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-400"
                            style={{
                                left: secondsToPixels(
                                    getTimelineDragMarkerStart() ?? 0,
                                ),
                            }}
                        />
                    )}
                    {trackClips.map((clip) => (
                        <button
                            className={`${clip.color} absolute top-3 flex ${clipHeightClass} items-center overflow-hidden rounded px-3 text-left text-sm font-medium text-white ${
                                selectedTool === 'cut'
                                    ? 'cursor-crosshair'
                                    : 'cursor-grab active:cursor-grabbing'
                            } ${
                                selectedClipId === clip.id
                                    ? 'ring-2 ring-cyan-300'
                                    : ''
                            }`}
                            draggable={selectedTool !== 'cut'}
                            key={clip.id}
                            onClick={(event) => {
                                event.stopPropagation();

                                if (selectedTool === 'cut') {
                                    cutTimelineClipFromClick(event, clip);
                                    return;
                                }

                                selectTimelineClip(clip);
                            }}
                            onDragEnd={stopTimelineClipDrag}
                            onDragStart={(event) =>
                                startTimelineClipDrag(event, clip)
                            }
                            onMouseLeave={() => clearCutPreview(clip.id)}
                            onMouseMove={(event) =>
                                updateCutPreviewFromPointer(event, clip)
                            }
                            style={{
                                left: secondsToPixels(
                                    getTimelineClipPreviewStart(clip),
                                ),
                                width: Math.max(
                                    secondsToPixels(clip.duration),
                                    24,
                                ),
                            }}
                            type="button"
                        >
                            <span
                                data-resize-handle
                                className="absolute top-0 bottom-0 left-0 z-10 w-2 cursor-ew-resize bg-white/10 transition hover:bg-white/35"
                                onMouseDown={(event) =>
                                    startClipTrim(event, clip, 'left')
                                }
                            />
                            {renderCutPreviewMarker(clip)}
                            <span className="truncate">{clip.name}</span>
                            <span
                                data-resize-handle
                                className="absolute top-0 right-0 bottom-0 z-10 w-2 cursor-ew-resize bg-white/10 transition hover:bg-white/35"
                                onMouseDown={(event) =>
                                    startClipTrim(event, clip, 'right')
                                }
                            />
                        </button>
                    ))}
                    {timelineDropPreview?.track === track &&
                        timelineDropPreview.trackIndex === trackIndex && (
                            <div
                                className={`${timelineDropPreview.canPlace ? getTimelineColor(timelineDropPreview.type) : 'bg-red-500/80'} pointer-events-none absolute top-3 z-10 flex ${clipHeightClass} items-center overflow-hidden rounded border px-3 text-left text-sm font-medium text-white opacity-45 ${
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
                                    {timelineDropPreview.name}
                                </span>
                            </div>
                        )}
                    {trackClips.length === 0 && (
                        <div
                            className={`flex ${clipHeightClass} items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600`}
                        >
                            {emptyText}
                        </div>
                    )}
                </div>
            </div>
        );
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
                    src={activeAudioClip.url ?? ''}
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
                            <div className="hidden text-right text-xs sm:block">
                                <p className="text-zinc-500">
                                    {saveStatus === 'saved'
                                        ? 'Saved'
                                        : 'Unsaved changes'}
                                </p>
                                {saveError && (
                                    <p className="max-w-60 truncate text-red-400">
                                        {saveError}
                                    </p>
                                )}
                            </div>
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
                                    <Type className="size-4 text-cyan-400" />
                                    <div>
                                        <h2 className="text-sm font-semibold text-white">
                                            Text
                                        </h2>
                                        <p className="text-xs text-zinc-500">
                                            Temporary text tools
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <button
                                        className="flex w-full items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-cyan-500 hover:text-white"
                                        draggable
                                        onDragEnd={() =>
                                            setTimelineDropPreview(null)
                                        }
                                        onDragStart={startTextDrag}
                                        type="button"
                                    >
                                        <span>Text</span>
                                        <span className="text-xs text-zinc-600">
                                            TXT
                                        </span>
                                    </button>
                                </div>
                            </section>
                        </aside>

                        <section className="flex items-center justify-center border-b border-zinc-800 bg-zinc-950 p-5 lg:border-r">
                            <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black shadow-2xl">
                                <div
                                    ref={previewFrameRef}
                                    className={`${previewFrame.className} relative max-h-[92%] max-w-[92%] overflow-visible rounded-sm border border-cyan-400/30 bg-zinc-900/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]`}
                                    onMouseDownCapture={(event) => {
                                        const target =
                                            event.target as HTMLElement | null;

                                        if (
                                            target?.closest(
                                                '[data-text-preview], [data-preview-resize-handle]',
                                            )
                                        ) {
                                            return;
                                        }

                                        if (activeClip) {
                                            setSelectedClipId(activeClip.id);
                                        }
                                    }}
                                    style={{
                                        aspectRatio: previewFrame.aspectRatio,
                                    }}
                                >
                                    <div className="pointer-events-none absolute inset-0 border border-white/10" />
                                    <div className="pointer-events-none absolute top-2 right-2 rounded bg-black/35 px-2 py-1 font-mono text-[11px] text-zinc-400">
                                        {project.format}
                                    </div>

                                    <div className="absolute inset-0 overflow-hidden">
                                        <div
                                            ref={visualPreviewClipRef}
                                            className="absolute inset-0 flex items-center justify-center text-center"
                                            onMouseDown={(event) => {
                                                if (activeClip) {
                                                    event.stopPropagation();
                                                    setSelectedClipId(
                                                        activeClip.id,
                                                    );
                                                }
                                            }}
                                            style={{
                                                transform: activeClip
                                                    ? `translate(${activeClip.positionX}px, ${activeClip.positionY}px) rotate(${activeClip.rotation}deg) scale(${activeClip.scale / 100})`
                                                    : undefined,
                                            }}
                                        >
                                            {activeClip?.type === 'image' ? (
                                                <img
                                                    alt={activeClip.name}
                                                    className="size-full object-contain"
                                                    onLoad={(event) =>
                                                        rememberMediaDimensions(
                                                            activeClip.mediaId,
                                                            event.currentTarget
                                                                .naturalWidth,
                                                            event.currentTarget
                                                                .naturalHeight,
                                                        )
                                                    }
                                                    src={activeClip.url ?? ''}
                                                />
                                            ) : activeClip?.type === 'video' ? (
                                                <video
                                                    ref={previewVideoRef}
                                                    className="size-full object-contain"
                                                    muted
                                                    onEnded={
                                                        finishCurrentPreviewVideo
                                                    }
                                                    onLoadedMetadata={(
                                                        event,
                                                    ) => {
                                                        rememberMediaDimensions(
                                                            activeClip.mediaId,
                                                            event.currentTarget
                                                                .videoWidth,
                                                            event.currentTarget
                                                                .videoHeight,
                                                        );
                                                    }}
                                                    playsInline
                                                    preload="metadata"
                                                    src={activeClip.url ?? ''}
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
                                    {activeClip &&
                                        selectedClipId === activeClip.id &&
                                        activeClipBoxBounds && (
                                            <div
                                                ref={visualPreviewBoxRef}
                                                className="pointer-events-none absolute inset-0"
                                                style={{
                                                    transform: `translate(${activeClip.positionX}px, ${activeClip.positionY}px) rotate(${activeClip.rotation}deg)`,
                                                }}
                                            >
                                                <div
                                                    ref={
                                                        visualPreviewBoxInnerRef
                                                    }
                                                    className="absolute border border-cyan-300/90 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                                                    style={{
                                                        left: activeClipBoxBounds.left,
                                                        top: activeClipBoxBounds.top,
                                                        width: activeClipBoxBounds.width,
                                                        height: activeClipBoxBounds.height,
                                                    }}
                                                >
                                                    {[
                                                        {
                                                            className:
                                                                'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
                                                            label: 'top left',
                                                        },
                                                        {
                                                            className:
                                                                'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
                                                            label: 'top right',
                                                        },
                                                        {
                                                            className:
                                                                'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
                                                            label: 'bottom right',
                                                        },
                                                        {
                                                            className:
                                                                'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
                                                            label: 'bottom left',
                                                        },
                                                    ].map((handle) => (
                                                        <button
                                                            className={`pointer-events-auto absolute size-3 rounded-sm border border-cyan-200 bg-zinc-950 shadow ${handle.className}`}
                                                            data-preview-resize-handle
                                                            key={handle.label}
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                startVisualPreviewDrag(
                                                                    event,
                                                                    activeClip,
                                                                    'scale',
                                                                )
                                                            }
                                                            title={`Resize clip from ${handle.label}`}
                                                            type="button"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    {activeTextClips.map((clip, index) => (
                                        <button
                                            className={`absolute left-1/2 cursor-move text-center text-lg font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] ${
                                                selectedClipId === clip.id
                                                    ? 'rounded outline outline-1 outline-cyan-300/70'
                                                    : ''
                                            }`}
                                            data-text-preview
                                            key={clip.id}
                                            onMouseDown={(event) =>
                                                startTextPreviewDrag(
                                                    event,
                                                    clip,
                                                )
                                            }
                                            style={{
                                                top: `${50 + index * 12}%`,
                                                transform: `translate(-50%, -50%) translate(${clip.positionX}px, ${clip.positionY}px) rotate(${clip.rotation}deg) scale(${clip.scale / 100})`,
                                            }}
                                            type="button"
                                        >
                                            {clip.name || 'Text'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <aside className="border-b border-zinc-800 bg-zinc-900/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-white">
                                        {selectedTextClip ? 'Text' : 'Resize'}
                                    </h2>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {selectedTextClip
                                            ? 'Text clip settings'
                                            : selectedVisualClip
                                              ? selectedVisualClip.name
                                              : 'Select a video, image, or text clip'}
                                    </p>
                                </div>
                                {selectedTextClip ? (
                                    <Button
                                        className="h-8 gap-2 border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 hover:bg-zinc-800"
                                        onClick={resetTextControls}
                                        type="button"
                                        variant="outline"
                                    >
                                        <RotateCcw className="size-3.5" />
                                        Reset
                                    </Button>
                                ) : (
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
                                )}
                            </div>

                            {selectedTextClip ? (
                                <div className="mt-4 space-y-4">
                                    <label className="block text-xs text-zinc-400">
                                        Text content
                                        <textarea
                                            className="mt-2 min-h-28 w-full resize-none rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 transition outline-none focus:border-cyan-500"
                                            onChange={(event) =>
                                                updateSelectedTextClipName(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Write your text..."
                                            value={selectedTextClip.name}
                                        />
                                    </label>

                                    <label className="block text-xs text-zinc-400">
                                        <span className="flex items-center justify-between gap-3">
                                            Size
                                            <span className="flex items-center gap-1">
                                                <input
                                                    className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                    max={maxClipScale}
                                                    min="40"
                                                    onChange={(event) =>
                                                        updateSelectedTextClipProperty(
                                                            'scale',
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    type="number"
                                                    value={
                                                        selectedTextClip.scale
                                                    }
                                                />
                                                <span className="text-zinc-500">
                                                    %
                                                </span>
                                                <button
                                                    className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                    onClick={() =>
                                                        updateSelectedTextClipProperty(
                                                            'scale',
                                                            100,
                                                        )
                                                    }
                                                    title="Reset size"
                                                    type="button"
                                                >
                                                    <RotateCcw className="size-3.5" />
                                                </button>
                                            </span>
                                        </span>
                                        <input
                                            className="mt-2 w-full accent-cyan-500"
                                            max={maxClipScale}
                                            min="40"
                                            onChange={(event) =>
                                                updateSelectedTextClipProperty(
                                                    'scale',
                                                    Number(event.target.value),
                                                )
                                            }
                                            type="range"
                                            value={selectedTextClip.scale}
                                        />
                                    </label>

                                    <label className="block text-xs text-zinc-400">
                                        <span className="flex items-center justify-between gap-3">
                                            Position X
                                            <span className="flex items-center gap-1">
                                                <input
                                                    className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                    max="1000"
                                                    min="-1000"
                                                    onChange={(event) =>
                                                        updateSelectedTextClipProperty(
                                                            'positionX',
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    type="number"
                                                    value={
                                                        selectedTextClip.positionX
                                                    }
                                                />
                                                <span className="text-zinc-500">
                                                    px
                                                </span>
                                                <button
                                                    className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                    onClick={() =>
                                                        updateSelectedTextClipProperty(
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
                                            className="mt-2 w-full accent-cyan-500"
                                            max="1000"
                                            min="-1000"
                                            onChange={(event) =>
                                                updateSelectedTextClipProperty(
                                                    'positionX',
                                                    Number(event.target.value),
                                                )
                                            }
                                            type="range"
                                            value={selectedTextClip.positionX}
                                        />
                                    </label>

                                    <label className="block text-xs text-zinc-400">
                                        <span className="flex items-center justify-between gap-3">
                                            Position Y
                                            <span className="flex items-center gap-1">
                                                <input
                                                    className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                    max="1000"
                                                    min="-1000"
                                                    onChange={(event) =>
                                                        updateSelectedTextClipProperty(
                                                            'positionY',
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    type="number"
                                                    value={
                                                        selectedTextClip.positionY
                                                    }
                                                />
                                                <span className="text-zinc-500">
                                                    px
                                                </span>
                                                <button
                                                    className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                    onClick={() =>
                                                        updateSelectedTextClipProperty(
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
                                            className="mt-2 w-full accent-cyan-500"
                                            max="1000"
                                            min="-1000"
                                            onChange={(event) =>
                                                updateSelectedTextClipProperty(
                                                    'positionY',
                                                    Number(event.target.value),
                                                )
                                            }
                                            type="range"
                                            value={selectedTextClip.positionY}
                                        />
                                    </label>

                                    <label className="block text-xs text-zinc-400">
                                        <span className="flex items-center justify-between gap-3">
                                            Rotation
                                            <span className="flex items-center gap-1">
                                                <input
                                                    className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                    max="180"
                                                    min="-180"
                                                    onChange={(event) =>
                                                        updateSelectedTextClipProperty(
                                                            'rotation',
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    type="number"
                                                    value={
                                                        selectedTextClip.rotation
                                                    }
                                                />
                                                <span className="text-zinc-500">
                                                    deg
                                                </span>
                                                <button
                                                    className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                    onClick={() =>
                                                        updateSelectedTextClipProperty(
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
                                            className="mt-2 w-full accent-cyan-500"
                                            max="180"
                                            min="-180"
                                            onChange={(event) =>
                                                updateSelectedTextClipProperty(
                                                    'rotation',
                                                    Number(event.target.value),
                                                )
                                            }
                                            type="range"
                                            value={selectedTextClip.rotation}
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="mt-4 space-y-4">
                                    <label className="block text-xs text-zinc-400">
                                        <span className="flex items-center justify-between gap-3">
                                            Scale
                                            <span className="flex items-center gap-1">
                                                <input
                                                    className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-50"
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
                                                    max="160"
                                                    min="40"
                                                    onChange={(event) =>
                                                        updateSelectedClipProperty(
                                                            'scale',
                                                            Number(
                                                                event.target
                                                                    .value,
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
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
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
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
                                                    max="100"
                                                    min="-100"
                                                    onChange={(event) =>
                                                        updateSelectedClipProperty(
                                                            'positionX',
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    type="number"
                                                    value={
                                                        selectedClipPositionX
                                                    }
                                                />
                                                <span className="text-zinc-500">
                                                    px
                                                </span>
                                                <button
                                                    className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
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
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
                                                    max="100"
                                                    min="-100"
                                                    onChange={(event) =>
                                                        updateSelectedClipProperty(
                                                            'positionY',
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    type="number"
                                                    value={
                                                        selectedClipPositionY
                                                    }
                                                />
                                                <span className="text-zinc-500">
                                                    px
                                                </span>
                                                <button
                                                    className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
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
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
                                                    max="180"
                                                    min="-180"
                                                    onChange={(event) =>
                                                        updateSelectedClipProperty(
                                                            'rotation',
                                                            Number(
                                                                event.target
                                                                    .value,
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
                                                    disabled={
                                                        !selectedVisualClip
                                                    }
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
                            )}
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
                                        onClick={() => selectTool('cut')}
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

                                    {Array.from({
                                        length: Math.max(
                                            0,
                                            timelineTrackCounts.video - 1,
                                        ),
                                    }).map((_, index) =>
                                        renderTimelineLane(
                                            'video',
                                            timelineTrackCounts.video - index,
                                        ),
                                    )}

                                    <div className="grid grid-cols-[92px_1fr] border-t border-zinc-800">
                                        <div className="flex items-center justify-between gap-2 border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            <span>Video 1</span>
                                            <button
                                                className="grid size-5 place-items-center rounded border border-zinc-700 text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-300"
                                                onClick={() =>
                                                    addTimelineTrack('video')
                                                }
                                                title="Add video track"
                                                type="button"
                                            >
                                                <Plus className="size-3" />
                                            </button>
                                        </div>
                                        <div
                                            data-timeline-track
                                            className="relative min-h-24 p-3"
                                            onDragLeave={leaveTimelineDrop}
                                            onDragOver={(event) =>
                                                allowTimelineDrop(
                                                    event,
                                                    'video',
                                                    1,
                                                )
                                            }
                                            onDrop={(event) =>
                                                dropOnTimeline(
                                                    event,
                                                    'video',
                                                    1,
                                                )
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
                                                        (clip.type ===
                                                            'video' ||
                                                            clip.type ===
                                                                'image') &&
                                                        clip.trackIndex === 1,
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-14 items-center overflow-hidden rounded px-3 text-left text-sm font-medium text-white ${
                                                            selectedTool ===
                                                            'cut'
                                                                ? 'cursor-crosshair'
                                                                : 'cursor-grab active:cursor-grabbing'
                                                        } ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        draggable={
                                                            selectedTool !==
                                                            'cut'
                                                        }
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();

                                                            if (
                                                                selectedTool ===
                                                                'cut'
                                                            ) {
                                                                cutTimelineClipFromClick(
                                                                    event,
                                                                    clip,
                                                                );
                                                                return;
                                                            }

                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        onMouseMove={(event) =>
                                                            updateCutPreviewFromPointer(
                                                                event,
                                                                clip,
                                                            )
                                                        }
                                                        onMouseLeave={() =>
                                                            clearCutPreview(
                                                                clip.id,
                                                            )
                                                        }
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
                                                        {renderCutPreviewMarker(
                                                            clip,
                                                        )}
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
                                                'video' &&
                                                timelineDropPreview.trackIndex ===
                                                    1 && (
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
                                                (clip) =>
                                                    (clip.type === 'video' ||
                                                        clip.type ===
                                                            'image') &&
                                                    clip.trackIndex === 1,
                                            ).length === 0 && (
                                                <div className="flex h-14 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Drag video or images here
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr] border-t border-zinc-800">
                                        <div className="flex items-center justify-between gap-2 border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            <span>Text 1</span>
                                            <button
                                                className="grid size-5 place-items-center rounded border border-zinc-700 text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-300"
                                                onClick={() =>
                                                    addTimelineTrack('text')
                                                }
                                                title="Add text track"
                                                type="button"
                                            >
                                                <Plus className="size-3" />
                                            </button>
                                        </div>
                                        <div
                                            data-timeline-track
                                            className="relative min-h-16 p-3"
                                            onDragLeave={leaveTimelineDrop}
                                            onDragOver={(event) =>
                                                allowTimelineDrop(
                                                    event,
                                                    'text',
                                                    1,
                                                )
                                            }
                                            onDrop={(event) =>
                                                dropOnTimeline(event, 'text', 1)
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
                                                        clip.type === 'text' &&
                                                        clip.trackIndex === 1,
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-9 items-center overflow-hidden rounded px-3 text-left text-sm font-medium text-white ${
                                                            selectedTool ===
                                                            'cut'
                                                                ? 'cursor-crosshair'
                                                                : 'cursor-grab active:cursor-grabbing'
                                                        } ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        draggable={
                                                            selectedTool !==
                                                            'cut'
                                                        }
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();

                                                            if (
                                                                selectedTool ===
                                                                'cut'
                                                            ) {
                                                                cutTimelineClipFromClick(
                                                                    event,
                                                                    clip,
                                                                );
                                                                return;
                                                            }

                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        onMouseMove={(event) =>
                                                            updateCutPreviewFromPointer(
                                                                event,
                                                                clip,
                                                            )
                                                        }
                                                        onMouseLeave={() =>
                                                            clearCutPreview(
                                                                clip.id,
                                                            )
                                                        }
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
                                                        {renderCutPreviewMarker(
                                                            clip,
                                                        )}
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
                                                'text' &&
                                                timelineDropPreview.trackIndex ===
                                                    1 && (
                                                    <div
                                                        className={`pointer-events-none absolute top-3 z-10 flex h-9 items-center overflow-hidden rounded border px-3 text-left text-sm font-medium text-white opacity-45 ${
                                                            timelineDropPreview.canPlace
                                                                ? 'border-white/35 bg-violet-600'
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
                                                (clip) =>
                                                    clip.type === 'text' &&
                                                    clip.trackIndex === 1,
                                            ).length === 0 && (
                                                <div className="flex h-9 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Drag text here
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {Array.from({
                                        length: Math.max(
                                            0,
                                            timelineTrackCounts.text - 1,
                                        ),
                                    }).map((_, index) =>
                                        renderTimelineLane('text', index + 2),
                                    )}

                                    <div className="grid grid-cols-[92px_1fr] border-t border-zinc-800">
                                        <div className="flex items-center justify-between gap-2 border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            <span>Audio 1</span>
                                            <button
                                                className="grid size-5 place-items-center rounded border border-zinc-700 text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-300"
                                                onClick={() =>
                                                    addTimelineTrack('audio')
                                                }
                                                title="Add audio track"
                                                type="button"
                                            >
                                                <Plus className="size-3" />
                                            </button>
                                        </div>
                                        <div
                                            data-timeline-track
                                            className="relative min-h-16 p-3"
                                            onDragLeave={leaveTimelineDrop}
                                            onDragOver={(event) =>
                                                allowTimelineDrop(
                                                    event,
                                                    'audio',
                                                    1,
                                                )
                                            }
                                            onDrop={(event) =>
                                                dropOnTimeline(
                                                    event,
                                                    'audio',
                                                    1,
                                                )
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
                                                        clip.type === 'audio' &&
                                                        clip.trackIndex === 1,
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-9 items-center overflow-hidden rounded px-3 text-left text-sm font-medium text-white ${
                                                            selectedTool ===
                                                            'cut'
                                                                ? 'cursor-crosshair'
                                                                : 'cursor-grab active:cursor-grabbing'
                                                        } ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        draggable={
                                                            selectedTool !==
                                                            'cut'
                                                        }
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();

                                                            if (
                                                                selectedTool ===
                                                                'cut'
                                                            ) {
                                                                cutTimelineClipFromClick(
                                                                    event,
                                                                    clip,
                                                                );
                                                                return;
                                                            }

                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        onMouseMove={(event) =>
                                                            updateCutPreviewFromPointer(
                                                                event,
                                                                clip,
                                                            )
                                                        }
                                                        onMouseLeave={() =>
                                                            clearCutPreview(
                                                                clip.id,
                                                            )
                                                        }
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
                                                        {renderCutPreviewMarker(
                                                            clip,
                                                        )}
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
                                                'audio' &&
                                                timelineDropPreview.trackIndex ===
                                                    1 && (
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
                                                (clip) =>
                                                    clip.type === 'audio' &&
                                                    clip.trackIndex === 1,
                                            ).length === 0 && (
                                                <div className="flex h-9 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Drag audio here
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {Array.from({
                                        length: Math.max(
                                            0,
                                            timelineTrackCounts.audio - 1,
                                        ),
                                    }).map((_, index) =>
                                        renderTimelineLane('audio', index + 2),
                                    )}
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
