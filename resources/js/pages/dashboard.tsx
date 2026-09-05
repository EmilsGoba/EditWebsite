import { useMemo, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import {
    Clapperboard,
    Film,
    FolderOpen,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';

type Project = {
    id: number;
    name: string;
    format: string;
    status: string;
    created_at: string;
};

type DashboardProps = {
    projects: Project[];
};

export default function Dashboard({ projects }: DashboardProps) {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'recent' | 'name'>('recent');
    const [creating, setCreating] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(
        null,
    );
    const createForm = useForm({
        name: '',
        format: '16:9',
    });
    const updateForm = useForm({
        name: '',
        format: '16:9',
    });
    const deleteForm = useForm({});

    const visibleProjects = useMemo(() => {
        const searchText = search.trim().toLowerCase();
        const filteredProjects = projects.filter((project) =>
            project.name.toLowerCase().includes(searchText),
        );

        return [...filteredProjects].sort((first, second) => {
            if (sort === 'name') {
                return first.name.localeCompare(second.name);
            }

            return (
                new Date(second.created_at).getTime() -
                new Date(first.created_at).getTime()
            );
        });
    }, [projects, search, sort]);

    function createProject(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!createForm.data.name.trim()) {
            return;
        }

        // This sends the form to Laravel, where ProjectController stores it in MySQL.
        createForm.post('/projects', {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setSearch('');
                setSort('recent');
                setCreating(false);
            },
        });
    }

    function openProjectSettings(project: Project) {
        setSelectedProject(project);
        updateForm.setData({
            name: project.name,
            format: project.format,
        });
        updateForm.clearErrors();
    }

    function updateProject(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!selectedProject || !updateForm.data.name.trim()) {
            return;
        }

        // This sends edited project settings to Laravel, where they are saved in MySQL.
        updateForm.put(`/projects/${selectedProject.id}`, {
            preserveScroll: true,
            onSuccess: () => setSelectedProject(null),
        });
    }

    function deleteProject() {
        if (!selectedProject) {
            return;
        }

        if (!confirm(`Delete "${selectedProject.name}"?`)) {
            return;
        }

        // This asks Laravel to delete the selected project from MySQL.
        deleteForm.delete(`/projects/${selectedProject.id}`, {
            preserveScroll: true,
            onSuccess: () => setSelectedProject(null),
        });
    }

    return (
        <>
            <Head title="Projects" />

            <main className="min-h-full bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-white">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
                    <header className="flex flex-col gap-5 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between dark:border-zinc-800">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                <Clapperboard className="size-4 text-cyan-500" />
                                <span>Video Editor</span>
                            </div>
                            <h1 className="text-3xl font-semibold tracking-normal text-zinc-950 dark:text-white">
                                Your projects
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                                A place for your next story.
                            </p>
                        </div>

                        <Button
                            className="w-full gap-2 bg-cyan-500 text-zinc-950 hover:bg-cyan-400 md:w-auto"
                            onClick={() => setCreating(true)}
                        >
                            <Plus className="size-4" />
                            New project
                        </Button>
                    </header>

                    <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
                                All projects
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                {projects.length} projects total
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    aria-label="Search projects"
                                    className="w-full pl-9 sm:w-64"
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search projects"
                                    value={search}
                                />
                            </div>

                            <select
                                aria-label="Sort projects"
                                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-800 shadow-xs transition outline-none focus:border-cyan-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                                onChange={(event) =>
                                    setSort(
                                        event.target.value as 'recent' | 'name',
                                    )
                                }
                                value={sort}
                            >
                                <option value="recent">Newest first</option>
                                <option value="name">Name</option>
                            </select>
                        </div>
                    </section>

                    {visibleProjects.length > 0 ? (
                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {visibleProjects.map((project) => (
                                <button
                                    className="group overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-xs transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-zinc-800 dark:bg-zinc-900"
                                    key={project.id}
                                    onClick={() => openProjectSettings(project)}
                                    type="button"
                                >
                                    <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                                        <div className="flex size-full items-center justify-center">
                                            <Film className="size-12 text-zinc-400" />
                                        </div>
                                        <span className="absolute right-3 bottom-3 rounded bg-zinc-950/80 px-2 py-1 text-xs font-medium text-white">
                                            {project.format}
                                        </span>
                                    </div>

                                    <div className="flex min-h-36 flex-col justify-between gap-5 p-4">
                                        <div>
                                            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">
                                                <FolderOpen className="size-4" />
                                                <span>Saved project</span>
                                            </div>
                                            <h3 className="text-lg leading-6 font-semibold break-words text-zinc-950 dark:text-white">
                                                {project.name}
                                            </h3>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                            <span className="size-2 rounded-full bg-emerald-500" />
                                            {project.status}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </section>
                    ) : (
                        <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                            <Film className="mb-4 size-10 text-zinc-400" />
                            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
                                No projects found
                            </h2>
                            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                                Try a different search or create a new video
                                project.
                            </p>
                            <Button
                                className="mt-5"
                                variant="outline"
                                onClick={() => setSearch('')}
                            >
                                Clear search
                            </Button>
                        </section>
                    )}
                </div>
            </main>

            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New project</DialogTitle>
                        <DialogDescription>
                            Give your next video a name.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-5" onSubmit={createProject}>
                        <div className="space-y-2">
                            <Label htmlFor="project-name">Project name</Label>
                            <Input
                                autoFocus
                                id="project-name"
                                maxLength={100}
                                onChange={(event) =>
                                    createForm.setData(
                                        'name',
                                        event.target.value,
                                    )
                                }
                                placeholder="Travel recap"
                                value={createForm.data.name}
                            />
                            {createForm.errors.name && (
                                <p className="text-sm text-red-500">
                                    {createForm.errors.name}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="project-format">Format</Label>
                            <select
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-800 shadow-xs transition outline-none focus:border-cyan-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                                id="project-format"
                                onChange={(event) =>
                                    createForm.setData(
                                        'format',
                                        event.target.value,
                                    )
                                }
                                value={createForm.data.format}
                            >
                                <option value="16:9">Landscape 16:9</option>
                                <option value="9:16">Portrait 9:16</option>
                                <option value="1:1">Square 1:1</option>
                            </select>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreating(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={
                                    createForm.processing ||
                                    !createForm.data.name.trim()
                                }
                                type="submit"
                            >
                                Create
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={selectedProject !== null}
                onOpenChange={(open) => !open && setSelectedProject(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="break-words">
                            {selectedProject?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Edit project settings or remove it from your
                            dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProject && (
                        <div className="space-y-6">
                            <form
                                className="space-y-5"
                                onSubmit={updateProject}
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="edit-project-name">
                                        Project name
                                    </Label>
                                    <Input
                                        id="edit-project-name"
                                        maxLength={100}
                                        onChange={(event) =>
                                            updateForm.setData(
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                        value={updateForm.data.name}
                                    />
                                    {updateForm.errors.name && (
                                        <p className="text-sm text-red-500">
                                            {updateForm.errors.name}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-project-format">
                                        Format
                                    </Label>
                                    <select
                                        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-800 shadow-xs transition outline-none focus:border-cyan-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                                        id="edit-project-format"
                                        onChange={(event) =>
                                            updateForm.setData(
                                                'format',
                                                event.target.value,
                                            )
                                        }
                                        value={updateForm.data.format}
                                    >
                                        <option value="16:9">
                                            Landscape 16:9
                                        </option>
                                        <option value="9:16">
                                            Portrait 9:16
                                        </option>
                                        <option value="1:1">Square 1:1</option>
                                    </select>
                                </div>

                                <dl className="grid gap-3 text-sm">
                                    <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                                        <dt className="text-zinc-500 dark:text-zinc-400">
                                            Status
                                        </dt>
                                        <dd className="font-medium text-zinc-950 dark:text-white">
                                            {selectedProject.status}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-zinc-500 dark:text-zinc-400">
                                            Media files
                                        </dt>
                                        <dd className="font-medium text-zinc-950 dark:text-white">
                                            0
                                        </dd>
                                    </div>
                                </dl>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setSelectedProject(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        disabled={
                                            updateForm.processing ||
                                            !updateForm.data.name.trim()
                                        }
                                        type="submit"
                                    >
                                        Save changes
                                    </Button>
                                </DialogFooter>
                            </form>

                            <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                                <Button
                                    className="gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    disabled={deleteForm.processing}
                                    onClick={deleteProject}
                                    type="button"
                                    variant="outline"
                                >
                                    <Trash2 className="size-4" />
                                    Delete project
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Projects',
            href: dashboard(),
        },
    ],
};
