import { useMemo, useRef, useState } from 'react';
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

const timelineClips = [
    { id: 1, name: 'Intro shot', width: '22%', color: 'bg-cyan-500' },
    { id: 2, name: 'Main clip', width: '38%', color: 'bg-orange-500' },
    { id: 3, name: 'B-roll', width: '24%', color: 'bg-emerald-500' },
];

const effectItems = ['Fade in', 'Blur', 'Color boost', 'Black and white'];
const uploadLimits =
    'Videos up to 500 MB, images up to 10 MB, audio up to 50 MB.';

export default function Editor({ project, media }: EditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDeletingMedia, setIsDeletingMedia] = useState(false);
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
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
        // Temporary toolbar action until the editor has real edit history.
    }

    function redoTemporaryChange() {
        // Temporary toolbar action until the editor has real edit history.
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

                        <div className="flex justify-end">
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
                                                    onClick={() => {
                                                        if (isDeletingMedia) {
                                                            toggleSelectedMedia(
                                                                item.id,
                                                            );
                                                        }
                                                    }}
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
                                                                {formatFileSize(
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
                                        <div className="flex size-full items-center justify-center bg-zinc-900">
                                            <div>
                                                <Film className="mx-auto mb-4 size-16 text-cyan-400/80" />
                                                <p className="text-lg font-semibold text-white">
                                                    {previewLabel}
                                                </p>
                                                <p className="mt-1 text-sm text-zinc-500">
                                                    Video preview placeholder
                                                </p>
                                            </div>
                                        </div>
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
                                        00:00:00
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
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
                                </div>

                                <label className="flex items-center gap-3 text-sm text-zinc-400">
                                    Timeline zoom
                                    <input
                                        className="w-36 accent-cyan-500"
                                        max="100"
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
                                <div className="min-w-[1100px]">
                                    <div className="grid grid-cols-[92px_1fr] border-b border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-500">
                                        <div className="border-r border-zinc-800 p-3">
                                            Track
                                        </div>
                                        <div className="grid grid-cols-8 p-3 font-mono">
                                            <span>00:00</span>
                                            <span>00:10</span>
                                            <span>00:20</span>
                                            <span>00:30</span>
                                            <span>00:40</span>
                                            <span>00:50</span>
                                            <span>01:00</span>
                                            <span>01:10</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr]">
                                        <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            Video 1
                                        </div>
                                        <div className="relative flex min-h-24 items-center gap-2 p-3">
                                            <div className="absolute top-0 bottom-0 left-[48%] w-px bg-red-500" />
                                            {timelineClips.map((clip) => (
                                                <div
                                                    className={`${clip.color} flex h-14 min-w-28 items-center rounded px-3 text-sm font-medium text-white`}
                                                    key={clip.id}
                                                    style={{
                                                        width: clip.width,
                                                    }}
                                                >
                                                    <span className="truncate">
                                                        {clip.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[92px_1fr] border-t border-zinc-800">
                                        <div className="border-r border-zinc-800 p-3 text-xs text-zinc-500">
                                            Audio 1
                                        </div>
                                        <div className="flex min-h-16 items-center p-3">
                                            <div className="h-9 w-2/3 rounded bg-emerald-700/80" />
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
