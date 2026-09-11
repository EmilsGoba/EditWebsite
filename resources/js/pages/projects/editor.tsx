import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Clapperboard,
    Film,
    Image,
    MousePointer2,
    Pause,
    Play,
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
    color: string;
    url: string;
};

type SavedTimelineClip = Omit<TimelineClip, 'color'>;

const effectItems = ['Fade in', 'Blur', 'Color boost', 'Black and white'];
const uploadLimits =
    'Videos up to 500 MB, images up to 10 MB, audio up to 50 MB.';
const timelineBaseWidth = 1100;
const timelineSeconds = 80;
const timelineStepSeconds = 0.01;
const timelinePlaybackStepSeconds = 0.02;
const timelinePlaybackIntervalMs = 20;
const visibleTimelineIntervalSeconds = 0.1;

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
                ...clip,
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
    const [selectedTool, setSelectedTool] = useState<'select' | 'cut'>(
        'select',
    );
    const [scale, setScale] = useState(100);
    const [positionX, setPositionX] = useState(0);
    const [positionY, setPositionY] = useState(0);
    const [rotation, setRotation] = useState(0);
    const [timelineZoom, setTimelineZoom] = useState(50);

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

    const timelineWidth = useMemo(
        () => timelineBaseWidth + timelineZoom * 20,
        [timelineZoom],
    );

    const activeClip = useMemo(() => {
        return timelineClips.find(
            (clip) =>
                clip.type !== 'audio' &&
                playhead >= clip.start &&
                playhead < clip.start + clip.duration,
        );
    }, [playhead, timelineClips]);

    const selectedClip = useMemo(() => {
        return timelineClips.find((clip) => clip.id === selectedClipId) ?? null;
    }, [selectedClipId, timelineClips]);

    const timelineMarks = useMemo(
        () => Array.from({ length: 9 }, (_, index) => index * 10),
        [],
    );

    const timelineIntervals = useMemo(
        () =>
            Array.from(
                {
                    length:
                        Math.floor(
                            timelineSeconds / visibleTimelineIntervalSeconds,
                        ) + 1,
                },
                (_, index) =>
                    Number((index * visibleTimelineIntervalSeconds).toFixed(1)),
            ),
        [],
    );

    useEffect(() => {
        if (!isPlaying || activeClip?.type === 'video') {
            return;
        }

        const timer = window.setInterval(() => {
            setPlayhead((currentTime) => {
                if (currentTime >= timelineSeconds) {
                    setIsPlaying(false);
                    return timelineSeconds;
                }

                return snapToTimelineStep(
                    Math.min(
                        timelineSeconds,
                        currentTime + timelinePlaybackStepSeconds,
                    ),
                );
            });
        }, timelinePlaybackIntervalMs);

        return () => window.clearInterval(timer);
    }, [activeClip?.type, isPlaying]);

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
    }, [activeClip, isPlaying]);

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
        const minutes = Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0');
        const remainingSeconds = Math.floor(seconds % 60)
            .toString()
            .padStart(2, '0');
        const milliseconds = Math.round((seconds % 1) * 1000)
            .toString()
            .padStart(3, '0');

        return `${minutes}:${remainingSeconds}.${milliseconds}`;
    }

    function formatShortDuration(seconds: number) {
        if (seconds < 60) {
            return `${seconds.toFixed(2)}s`;
        }

        return formatTimelineTime(seconds);
    }

    function snapToTimelineStep(seconds: number) {
        // The timeline uses 10 millisecond precision, so cuts land on clean 0.01s points.
        return Math.round(seconds / timelineStepSeconds) * timelineStepSeconds;
    }

    function secondsToPixels(seconds: number) {
        return (seconds / timelineSeconds) * timelineWidth;
    }

    function pixelsToSeconds(pixels: number) {
        const seconds = Math.max(
            0,
            Math.min(
                timelineSeconds,
                (pixels / timelineWidth) * timelineSeconds,
            ),
        );

        return snapToTimelineStep(seconds);
    }

    function saveTimelineChange(nextClips: TimelineClip[]) {
        // Every timeline edit is stored in a small local history, which powers undo and redo.
        const nextHistory = history.slice(0, historyIndex + 1);

        nextHistory.push(nextClips);
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
        setTimelineClips(nextClips);
        setSaveStatus('unsaved');
    }

    function saveTimeline() {
        setIsSavingTimeline(true);

        // This saves the current timeline layout to MySQL, so it can load again after refresh.
        router.put(
            `/projects/${project.id}/timeline`,
            {
                clips: timelineClips.map((clip) => ({
                    mediaId: clip.mediaId,
                    name: clip.name,
                    type: clip.type,
                    start: clip.start,
                    duration: clip.duration,
                    sourceStart: clip.sourceStart,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => setSaveStatus('saved'),
                onFinish: () => setIsSavingTimeline(false),
            },
        );
    }

    function getTrackEnd(type: ProjectMedia['type']) {
        return timelineClips
            .filter((clip) =>
                type === 'audio'
                    ? clip.type === 'audio'
                    : clip.type !== 'audio',
            )
            .reduce(
                (latestEnd, clip) =>
                    Math.max(latestEnd, clip.start + clip.duration),
                0,
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

    function addMediaToTimeline(item: ProjectMedia) {
        if (isDeletingMedia) {
            toggleSelectedMedia(item.id);
            return;
        }

        const nextClip: TimelineClip = {
            id: Date.now(),
            mediaId: item.id,
            name: item.name,
            type: item.type,
            start: getTrackEnd(item.type),
            duration:
                mediaDurations[item.id] ?? getTemporaryClipDuration(item.type),
            sourceStart: 0,
            color: getTimelineColor(item.type),
            url: item.url,
        };

        saveTimelineChange([...timelineClips, nextClip]);
        setSelectedClipId(nextClip.id);
        setIsPlaying(false);
        setPlayhead(nextClip.start);
    }

    function selectTimelineClip(clip: TimelineClip) {
        setSelectedClipId(clip.id);
        setIsPlaying(false);
        setPlayhead(clip.start);
    }

    function movePlayhead(event: React.MouseEvent<HTMLDivElement>) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const nextTime = pixelsToSeconds(event.clientX - bounds.left);

        setIsPlaying(false);
        setPlayhead(nextTime);
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
            setIsPlaying(false);
            setPlayhead(snapToTimelineStep(clipEnd));
            return;
        }

        setPlayhead(nextTime);
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

        // This sends the selected media IDs to Laravel, where the files and database rows are deleted.
        router.delete(`/projects/${project.id}/media`, {
            data: {
                media_ids: selectedMediaIds,
            },
            preserveScroll: true,
            onSuccess: () => {
                setIsDeletingMedia(false);
                setSelectedMediaIds([]);
            },
        });
    }

    function togglePlayback() {
        // Temporary playback state for the mock editor. Real video playback can be added later.
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
        // This returns the preview content back to its starting size and position.
        setScale(100);
        setPositionX(0);
        setPositionY(0);
        setRotation(0);
    }

    return (
        <>
            <Head title={`${project.name} editor`} />

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
                            <Button
                                className="gap-2 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                disabled={isSavingTimeline}
                                onClick={saveTimeline}
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
                                        accept="video/*,image/*,audio/*"
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
                                                    className={`group relative overflow-hidden rounded-lg border bg-zinc-950 text-left transition hover:border-cyan-500 ${
                                                        selectedMediaIds.includes(
                                                            item.id,
                                                        )
                                                            ? 'border-cyan-500'
                                                            : 'border-zinc-800'
                                                    }`}
                                                    key={item.id}
                                                    onClick={() =>
                                                        addMediaToTimeline(item)
                                                    }
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
                                                            <MediaIcon className="size-6 text-zinc-400 group-hover:text-cyan-400" />
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
                                            transform: `translate(${positionX}px, ${positionY}px) rotate(${rotation}deg) scale(${scale / 100})`,
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
                                                onEnded={() =>
                                                    setIsPlaying(false)
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
                                        Temporary video controls
                                    </p>
                                </div>
                                <Button
                                    className="h-8 gap-2 border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 hover:bg-zinc-800"
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
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                max="160"
                                                min="40"
                                                onChange={(event) =>
                                                    setScale(
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={scale}
                                            />
                                            <span className="text-zinc-500">
                                                %
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                onClick={() => setScale(100)}
                                                title="Reset scale"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500"
                                        max="160"
                                        min="40"
                                        onChange={(event) =>
                                            setScale(Number(event.target.value))
                                        }
                                        type="range"
                                        value={scale}
                                    />
                                </label>

                                <label className="block text-xs text-zinc-400">
                                    <span className="flex items-center justify-between gap-3">
                                        Position X
                                        <span className="flex items-center gap-1">
                                            <input
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                max="100"
                                                min="-100"
                                                onChange={(event) =>
                                                    setPositionX(
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={positionX}
                                            />
                                            <span className="text-zinc-500">
                                                px
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                onClick={() => setPositionX(0)}
                                                title="Reset position X"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500"
                                        max="100"
                                        min="-100"
                                        onChange={(event) =>
                                            setPositionX(
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={positionX}
                                    />
                                </label>

                                <label className="block text-xs text-zinc-400">
                                    <span className="flex items-center justify-between gap-3">
                                        Position Y
                                        <span className="flex items-center gap-1">
                                            <input
                                                className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                                                max="100"
                                                min="-100"
                                                onChange={(event) =>
                                                    setPositionY(
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={positionY}
                                            />
                                            <span className="text-zinc-500">
                                                px
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                onClick={() => setPositionY(0)}
                                                title="Reset position Y"
                                                type="button"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        className="mt-2 w-full accent-cyan-500"
                                        max="100"
                                        min="-100"
                                        onChange={(event) =>
                                            setPositionY(
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={positionY}
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
                                                    setRotation(
                                                        Number(
                                                            event.target.value,
                                                        ),
                                                    )
                                                }
                                                type="number"
                                                value={rotation}
                                            />
                                            <span className="text-zinc-500">
                                                deg
                                            </span>
                                            <button
                                                className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white"
                                                onClick={() => setRotation(0)}
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
                                            setRotation(
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={rotation}
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
                                </div>

                                <label className="flex items-center gap-3 text-sm text-zinc-400">
                                    <span className="min-w-30">
                                        Timeline zoom {timelineZoom}%
                                    </span>
                                    <input
                                        className="w-56 accent-cyan-500"
                                        max="500"
                                        min="0"
                                        onChange={(event) =>
                                            setTimelineZoom(
                                                Number(event.target.value),
                                            )
                                        }
                                        type="range"
                                        value={timelineZoom}
                                    />
                                </label>
                            </div>

                            <div className="overflow-x-auto">
                                <div
                                    className="min-w-[1100px]"
                                    style={{ width: timelineWidth }}
                                >
                                    <div className="grid grid-cols-[92px_1fr] border-b border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-500">
                                        <div className="border-r border-zinc-800 p-3">
                                            Track
                                        </div>
                                        <div className="grid grid-cols-8 p-3 font-mono">
                                            {timelineMarks
                                                .slice(0, -1)
                                                .map((mark) => (
                                                    <span key={mark}>
                                                        {formatTimelineTime(
                                                            mark,
                                                        )}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr]">
                                        <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            Video 1
                                        </div>
                                        <div
                                            className="relative min-h-24 cursor-crosshair p-3"
                                            onClick={movePlayhead}
                                        >
                                            {timelineIntervals.map(
                                                (interval) => (
                                                    <div
                                                        className={`pointer-events-none absolute top-0 bottom-0 w-px ${
                                                            interval % 1 === 0
                                                                ? 'bg-zinc-700/60'
                                                                : 'bg-zinc-800/35'
                                                        }`}
                                                        key={`video-${interval}`}
                                                        style={{
                                                            left: secondsToPixels(
                                                                interval,
                                                            ),
                                                        }}
                                                    />
                                                ),
                                            )}
                                            <div
                                                className="absolute top-0 bottom-0 z-20 w-px bg-red-500"
                                                style={{
                                                    left: secondsToPixels(
                                                        playhead,
                                                    ),
                                                }}
                                            />
                                            {timelineClips
                                                .filter(
                                                    (clip) =>
                                                        clip.type !== 'audio',
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-14 items-center rounded px-3 text-left text-sm font-medium text-white ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        style={{
                                                            left: secondsToPixels(
                                                                clip.start,
                                                            ),
                                                            width: secondsToPixels(
                                                                clip.duration,
                                                            ),
                                                        }}
                                                        type="button"
                                                    >
                                                        <span className="truncate">
                                                            {clip.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            {timelineClips.filter(
                                                (clip) => clip.type !== 'audio',
                                            ).length === 0 && (
                                                <div className="flex h-14 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Click media to add clips
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr] border-t border-zinc-800">
                                        <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            Audio 1
                                        </div>
                                        <div
                                            className="relative min-h-16 cursor-crosshair p-3"
                                            onClick={movePlayhead}
                                        >
                                            {timelineIntervals.map(
                                                (interval) => (
                                                    <div
                                                        className={`pointer-events-none absolute top-0 bottom-0 w-px ${
                                                            interval % 1 === 0
                                                                ? 'bg-zinc-700/60'
                                                                : 'bg-zinc-800/35'
                                                        }`}
                                                        key={`audio-${interval}`}
                                                        style={{
                                                            left: secondsToPixels(
                                                                interval,
                                                            ),
                                                        }}
                                                    />
                                                ),
                                            )}
                                            <div
                                                className="absolute top-0 bottom-0 z-20 w-px bg-red-500"
                                                style={{
                                                    left: secondsToPixels(
                                                        playhead,
                                                    ),
                                                }}
                                            />
                                            {timelineClips
                                                .filter(
                                                    (clip) =>
                                                        clip.type === 'audio',
                                                )
                                                .map((clip) => (
                                                    <button
                                                        className={`${clip.color} absolute top-3 flex h-9 items-center rounded px-3 text-left text-sm font-medium text-white ${
                                                            selectedClipId ===
                                                            clip.id
                                                                ? 'ring-2 ring-cyan-300'
                                                                : ''
                                                        }`}
                                                        key={clip.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            selectTimelineClip(
                                                                clip,
                                                            );
                                                        }}
                                                        style={{
                                                            left: secondsToPixels(
                                                                clip.start,
                                                            ),
                                                            width: secondsToPixels(
                                                                clip.duration,
                                                            ),
                                                        }}
                                                        type="button"
                                                    >
                                                        <span className="truncate">
                                                            {clip.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            {timelineClips.filter(
                                                (clip) => clip.type === 'audio',
                                            ).length === 0 && (
                                                <div className="flex h-9 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-600">
                                                    Click audio to add it here
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
