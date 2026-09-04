import { Head, Link, usePage } from '@inertiajs/react';
import { Clapperboard, FolderPlus, Play, Scissors, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';

const editingSteps = [
    {
        title: 'Upload your video',
        description: 'Add a video or audio file to your project.',
        icon: Upload,
    },
    {
        title: 'Build the timeline',
        description: 'Trim clips and prepare a simple video preview.',
        icon: Scissors,
    },
    {
        title: 'Save your project',
        description: 'Continue later without losing your changes.',
        icon: FolderPlus,
    },
];

export default function Welcome() {
    const { auth } = usePage().props;
    const startUrl = auth.user ? dashboard() : register();

    return (
        <>
            <Head title="Video Editing" />

            <main className="min-h-screen bg-zinc-950 text-white">
                <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-lg font-semibold"
                    >
                        <span className="flex size-9 items-center justify-center rounded-md bg-cyan-400 text-zinc-950">
                            <Clapperboard className="size-5" />
                        </span>
                        Video Editor
                    </Link>

                    <nav className="flex items-center gap-3 text-sm">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="rounded-md border border-white/15 px-4 py-2 text-zinc-100 transition hover:border-white/35"
                            >
                            Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="rounded-md px-3 py-2 text-zinc-300 transition hover:text-white"
                                >
                            Log in
                                </Link>
                                <Link
                                    href={register()}
                                    className="rounded-md bg-white px-4 py-2 font-medium text-zinc-950 transition hover:bg-zinc-200"
                                >
                            Register
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <section className="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[1fr_430px] lg:items-center lg:py-24">
                    <div>
                        <p className="mb-4 text-sm font-medium uppercase text-cyan-300">
                            Video editing for beginners
                        </p>
                        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
                            Create your video project in a simple way.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                            This website helps you upload video, build your
                            first timeline and save your editing project in the
                            browser.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button
                                asChild
                                size="lg"
                                className="bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                            >
                                <Link href={startUrl}>
                                    <Play className="size-4" />
                                    Start editing
                                </Link>
                            </Button>

                            <Button
                                asChild
                                size="lg"
                                variant="outline"
                                className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                            >
                                <Link href={auth.user ? dashboard() : login()}>
                                    Open project dashboard
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* This block is only a visual preview for the homepage, not the real video editor yet. */}
                    <div className="rounded-lg border border-white/10 bg-zinc-900 p-4 shadow-2xl shadow-cyan-950/30">
                        <div className="aspect-video overflow-hidden rounded-md bg-zinc-950">
                            <div className="flex h-full items-center justify-center">
                                <div className="flex size-16 items-center justify-center rounded-full bg-cyan-400 text-zinc-950">
                                    <Play className="ml-1 size-7 fill-current" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 space-y-3">
                            <div className="h-3 w-3/4 rounded-full bg-cyan-400" />
                            <div className="h-3 w-1/2 rounded-full bg-emerald-400" />
                            <div className="h-3 w-5/6 rounded-full bg-rose-400" />
                        </div>
                    </div>
                </section>

                <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-14 md:grid-cols-3">
                    {editingSteps.map((step) => {
                        const Icon = step.icon;

                        return (
                            <article
                                key={step.title}
                                className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
                            >
                                <Icon className="mb-4 size-6 text-cyan-300" />
                                <h2 className="text-lg font-semibold">
                                    {step.title}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                    {step.description}
                                </p>
                            </article>
                        );
                    })}
                </section>
            </main>
        </>
    );
}
