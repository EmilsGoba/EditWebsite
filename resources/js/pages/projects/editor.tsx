import { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
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
};

const timelineClips = [
    { id: 1, name: 'Intro shot', width: '22%', color: 'bg-cyan-500' },
    { id: 2, name: 'Main clip', width: '38%', color: 'bg-orange-500' },
    { id: 3, name: 'B-roll', width: '24%', color: 'bg-emerald-500' },
];

const mediaItems = [
    { id: 1, name: 'sample-video.mp4', type: 'Video', icon: Film },
    { id: 2, name: 'cover-image.jpg', type: 'Image', icon: Image },
    { id: 3, name: 'background-audio.mp3', type: 'Audio', icon: Volume2 },
];

const effectItems = ['Fade in', 'Blur', 'Color boost', 'Black and white'];

export default function Editor({ project }: EditorProps) {
    const [isPlaying, setIsPlaying] = useState(false);
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
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                                    >
                                        <Upload className="size-4" />
                                        <span className="sr-only">
                                            Upload media
                                        </span>
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {mediaItems.map((item) => (
                                        <button
                                            className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-left transition hover:border-cyan-500"
                                            key={item.id}
                                            type="button"
                                        >
                                            <span className="flex aspect-video items-center justify-center bg-zinc-800">
                                                <item.icon className="size-6 text-zinc-400 group-hover:text-cyan-400" />
                                            </span>
                                            <span className="block min-w-0 p-2">
                                                <span className="block truncate text-xs font-medium text-zinc-200">
                                                    {item.name}
                                                </span>
                                                <span className="text-xs text-zinc-500">
                                                    {item.type}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
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
