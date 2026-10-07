import { Link } from '@inertiajs/react';
import { ArrowLeft, Clapperboard, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/editor-timeline';

type EditorTopBarProps = {
    isAutoSaveEnabled: boolean;
    isSavingTimeline: boolean;
    onSaveTimeline: () => void;
    onToggleAutoSave: () => void;
    project: Project;
    saveError: string | null;
    saveStatus: 'saved' | 'unsaved';
};

export function EditorTopBar({
    isAutoSaveEnabled,
    isSavingTimeline,
    onSaveTimeline,
    onToggleAutoSave,
    project,
    saveError,
    saveStatus,
}: EditorTopBarProps) {
    return (
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
                        {saveStatus === 'saved' ? 'Saved' : 'Unsaved changes'}
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
                    onClick={onToggleAutoSave}
                    role="switch"
                    type="button"
                >
                    Auto save
                    <span
                        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                            isAutoSaveEnabled ? 'bg-cyan-500' : 'bg-zinc-800'
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
                    onClick={onSaveTimeline}
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
                    <Link href={`/projects/${project.id}/export`}>Export</Link>
                </Button>
            </div>
        </header>
    );
}
