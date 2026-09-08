import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Clapperboard,
    Download,
    FileVideo,
    Settings2,
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

type ExportProps = {
    project: Project;
};

const exportFormats = ['MP4', 'MOV', 'WEBM'];
const exportQualities = ['720p', '1080p', '4K'];

export default function Export({ project }: ExportProps) {
    const [format, setFormat] = useState('MP4');
    const [quality, setQuality] = useState('1080p');

    return (
        <>
            <Head title={`${project.name} export`} />

            <main className="min-h-full bg-zinc-950 text-zinc-100">
                <div className="mx-auto flex min-h-[calc(100vh-6.75rem)] w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8">
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
                            className="gap-2 bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                            type="button"
                        >
                            <Download className="size-4" />
                            Start export
                        </Button>
                    </header>

                    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                            <div className="flex aspect-video items-center justify-center rounded-lg bg-black">
                                <div className="text-center">
                                    <FileVideo className="mx-auto mb-4 size-14 text-cyan-400" />
                                    <h2 className="text-lg font-semibold text-white">
                                        Export preview
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        Final video preview will appear here.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                    <CheckCircle2 className="size-4 text-emerald-400" />
                                    Ready to export
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                                    <div className="h-full w-0 rounded-full bg-cyan-500" />
                                </div>
                                <p className="mt-3 text-sm text-zinc-500">
                                    This is a temporary export screen. Real file
                                    rendering will be connected later.
                                </p>
                            </div>
                        </section>

                        <aside className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                            <div className="mb-5 flex items-center gap-2">
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
                                            Export type
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
