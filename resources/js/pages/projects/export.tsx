import { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Clapperboard,
    Download,
    FileVideo,
    ListVideo,
    Settings2,
    TriangleAlert,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { dashboard } from '@/routes';

type Project = {
    id: number;
    name: string;
    format: string;
    status: string;
    created_at: string;
};

type ProjectMedia = {
    id: number;
    type: 'video' | 'image' | 'audio';
    name: string;
    mime_type: string;
    size: number;
    url: string;
    created_at: string;
};

type TimelineClip = {
    id: number;
    mediaId: number;
    name: string;
    type: 'video' | 'image' | 'audio';
    start: number;
    duration: number;
    sourceStart: number;
    scale: number;
    positionX: number;
    positionY: number;
    rotation: number;
    url: string;
};

type ExportProps = {
    project: Project;
    media: ProjectMedia[];
    timelineClips: TimelineClip[];
};

const exportFormats = ['MP4', 'MOV'];
const exportQualities = ['720p', '1080p', 'Original'];

function formatTimelineTime(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60)
        .toString()
        .padStart(2, '0');
    const remainingSeconds = Math.floor(safeSeconds % 60)
        .toString()
        .padStart(2, '0');

    return `${minutes}:${remainingSeconds}`;
}

function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProjectDimensions(format: string) {
    if (format === '9:16') {
        return '1080 x 1920';
    }

    if (format === '1:1') {
        return '1080 x 1080';
    }

    return '1920 x 1080';
}

export default function Export({ project, media, timelineClips }: ExportProps) {
    const [format, setFormat] = useState('MP4');
    const [quality, setQuality] = useState('1080p');
    const timelineEnd = useMemo(
        () =>
            timelineClips.reduce(
                (lastEnd, clip) =>
                    Math.max(lastEnd, clip.start + clip.duration),
                0,
            ),
        [timelineClips],
    );
    const videoClipCount = timelineClips.filter(
        (clip) => clip.type !== 'audio',
    ).length;
    const audioClipCount = timelineClips.filter(
        (clip) => clip.type === 'audio',
    ).length;
    const canExport = timelineClips.length > 0;

    function downloadExportManifest() {
        if (!canExport) {
            return;
        }

        // This creates a lightweight MVP export package that describes the saved edit.
        // Later this data can be sent to a real renderer, for example FFmpeg.
        const exportManifest = {
            project: {
                id: project.id,
                name: project.name,
                format: project.format,
                dimensions: getProjectDimensions(project.format),
            },
            exportSettings: {
                fileType: format,
                quality,
                duration: timelineEnd,
                durationLabel: formatTimelineTime(timelineEnd),
            },
            media: media.map((item) => ({
                id: item.id,
                name: item.name,
                type: item.type,
                mimeType: item.mime_type,
                size: item.size,
                url: item.url,
            })),
            timeline: timelineClips.map((clip) => ({
                mediaId: clip.mediaId,
                name: clip.name,
                type: clip.type,
                start: clip.start,
                duration: clip.duration,
                sourceStart: clip.sourceStart,
                transform: {
                    scale: clip.scale,
                    positionX: clip.positionX,
                    positionY: clip.positionY,
                    rotation: clip.rotation,
                },
            })),
        };
        const blob = new Blob([JSON.stringify(exportManifest, null, 2)], {
            type: 'application/json',
        });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = downloadUrl;
        link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}-export.json`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
    }

    return (
        <>
            <Head title={`${project.name} export`} />

            <main className="min-h-full bg-zinc-950 text-zinc-100">
                <div className="mx-auto flex min-h-[calc(100vh-6.75rem)] w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8">
                    <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                            <Button
                                asChild
                                variant="ghost"
                                className="mb-2 -ml-3 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                            >
                                <Link href={`/projects/${project.id}/edit`}>
                                    <ArrowLeft className="size-4" />
                                    Editor
                                </Link>
                            </Button>

                            <div className="flex items-center gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-zinc-950">
                                    <Clapperboard className="size-5" />
                                </span>
                                <div className="min-w-0">
                                    <h1 className="truncate text-2xl font-semibold text-white">
                                        Export project
                                    </h1>
                                    <p className="text-sm text-zinc-500">
                                        {project.name}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="gap-2 bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:opacity-50"
                            disabled={!canExport}
                            onClick={downloadExportManifest}
                            type="button"
                        >
                            <Download className="size-4" />
                            Download export package
                        </Button>
                    </header>

                    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <section className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                            <div className="flex aspect-video items-center justify-center rounded-lg bg-black">
                                <div className="text-center">
                                    <FileVideo className="mx-auto mb-4 size-14 text-cyan-400" />
                                    <h2 className="text-lg font-semibold text-white">
                                        {canExport
                                            ? 'Export package ready'
                                            : 'Nothing to export yet'}
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {canExport
                                            ? 'This MVP creates a downloadable export package from your saved timeline.'
                                            : 'Add media fragments to the timeline and save before exporting.'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-4">
                                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                                    <p className="text-xs text-zinc-500">
                                        Duration
                                    </p>
                                    <p className="mt-1 font-mono text-lg font-semibold text-white">
                                        {formatTimelineTime(timelineEnd)}
                                    </p>
                                </div>
                                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                                    <p className="text-xs text-zinc-500">
                                        Video/Image
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {videoClipCount}
                                    </p>
                                </div>
                                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                                    <p className="text-xs text-zinc-500">
                                        Audio
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {audioClipCount}
                                    </p>
                                </div>
                                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                                    <p className="text-xs text-zinc-500">
                                        Assets
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {media.length}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                    {canExport ? (
                                        <CheckCircle2 className="size-4 text-emerald-400" />
                                    ) : (
                                        <TriangleAlert className="size-4 text-amber-400" />
                                    )}
                                    Export readiness
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                        className="h-full rounded-full bg-cyan-500"
                                        style={{
                                            width: canExport ? '100%' : '15%',
                                        }}
                                    />
                                </div>
                                <p className="mt-3 text-sm text-zinc-500">
                                    {canExport
                                        ? 'Your saved timeline can be packaged for export. Real video rendering can be connected in the next development step.'
                                        : 'The export package needs at least one saved medija fragments.'}
                                </p>
                            </div>

                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <ListVideo className="size-4 text-cyan-400" />
                                    <h2 className="text-sm font-semibold text-white">
                                        Timeline contents
                                    </h2>
                                </div>

                                {timelineClips.length > 0 ? (
                                    <div className="space-y-2">
                                        {timelineClips.map((clip) => (
                                            <div
                                                className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm sm:grid-cols-[1fr_auto_auto]"
                                                key={clip.id}
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-white">
                                                        {clip.name}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 capitalize">
                                                        {clip.type}
                                                    </p>
                                                </div>
                                                <p className="font-mono text-zinc-400">
                                                    {formatTimelineTime(
                                                        clip.start,
                                                    )}
                                                </p>
                                                <p className="font-mono text-zinc-400">
                                                    {formatTimelineTime(
                                                        clip.duration,
                                                    )}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-zinc-500">
                                        No saved medija fragments found.
                                    </p>
                                )}
                            </div>
                        </section>

                        <aside className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                            <div className="flex items-center gap-2">
                                <Settings2 className="size-4 text-cyan-400" />
                                <h2 className="text-sm font-semibold text-white">
                                    Export settings
                                </h2>
                            </div>

                            <div className="space-y-5">
                                <label className="block text-sm text-zinc-300">
                                    File type
                                    <select
                                        className="mt-2 h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-500"
                                        onChange={(event) =>
                                            setFormat(event.target.value)
                                        }
                                        value={format}
                                    >
                                        {exportFormats.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block text-sm text-zinc-300">
                                    Quality
                                    <select
                                        className="mt-2 h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-500"
                                        onChange={(event) =>
                                            setQuality(event.target.value)
                                        }
                                        value={quality}
                                    >
                                        {exportQualities.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <dl className="grid gap-3 border-t border-zinc-800 pt-5 text-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-zinc-500">
                                            Project format
                                        </dt>
                                        <dd className="font-medium text-zinc-100">
                                            {project.format}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-zinc-500">
                                            Dimensions
                                        </dt>
                                        <dd className="font-medium text-zinc-100">
                                            {getProjectDimensions(
                                                project.format,
                                            )}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-zinc-500">
                                            Output type
                                        </dt>
                                        <dd className="font-medium text-zinc-100">
                                            {format}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-zinc-500">
                                            Quality
                                        </dt>
                                        <dd className="font-medium text-zinc-100">
                                            {quality}
                                        </dd>
                                    </div>
                                </dl>

                                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
                                    <p>
                                        MVP export creates a JSON package with
                                        project settings, medija files, laika
                                        josla positions and transform settings.
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-zinc-800 pt-4">
                                <h3 className="mb-3 text-sm font-semibold text-white">
                                    Project files
                                </h3>
                                <div className="space-y-2">
                                    {media.length > 0 ? (
                                        media.map((item) => (
                                            <div
                                                className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm"
                                                key={item.id}
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-zinc-200">
                                                        {item.name}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 capitalize">
                                                        {item.type}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 text-xs text-zinc-500">
                                                    {formatFileSize(item.size)}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-zinc-500">
                                            No media uploaded.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </aside>
                    </section>

                    <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline">
                            <Link href={dashboard()}>Back to projects</Link>
                        </Button>
                        <Button asChild variant="ghost">
                            <Link href={`/projects/${project.id}/edit`}>
                                Back to editor
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
        </>
    );
}

Export.layout = {
    breadcrumbs: [
        {
            title: 'Projects',
            href: dashboard(),
        },
        {
            title: 'Export',
            href: '#',
        },
    ],
};
