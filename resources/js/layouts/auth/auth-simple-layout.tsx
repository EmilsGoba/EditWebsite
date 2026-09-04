import { Link } from '@inertiajs/react';
import { Clapperboard, Film, Scissors, Upload } from 'lucide-react';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

const features = [
    {
        title: 'Upload media',
        icon: Upload,
    },
    {
        title: 'Trim clips',
        icon: Scissors,
    },
    {
        title: 'Preview edits',
        icon: Film,
    },
];

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <main className="grid min-h-svh bg-zinc-950 text-white lg:grid-cols-[1.1fr_0.9fr]">
            <section className="hidden min-h-svh flex-col justify-between border-r border-white/10 px-10 py-8 lg:flex">
                <Link
                    href={home()}
                    className="flex items-center gap-3 text-lg font-semibold"
                >
                    <span className="flex size-9 items-center justify-center rounded-md bg-cyan-400 text-zinc-950">
                        <Clapperboard className="size-5" />
                    </span>
                    Video Editor
                </Link>

                <div className="max-w-xl">
                    <p className="mb-4 text-sm font-medium uppercase text-cyan-300">
                        Start your editing workspace
                    </p>
                    <h1 className="text-5xl font-semibold leading-tight">
                        Keep your video projects organized from the first step.
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-zinc-300">
                        Create an account, open your dashboard, and begin
                        building simple video projects with a clear timeline.
                    </p>
                </div>

                <div className="grid gap-3">
                    {features.map((feature) => {
                        const Icon = feature.icon;

                        return (
                            <div
                                key={feature.title}
                                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                            >
                                <Icon className="size-5 text-cyan-300" />
                                <span className="text-sm text-zinc-200">
                                    {feature.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="flex min-h-svh items-center justify-center px-6 py-10">
                <div className="w-full max-w-md">
                    <div className="mb-8 flex flex-col items-center gap-4 text-center lg:hidden">
                        <Link
                            href={home()}
                            className="flex items-center gap-3 text-lg font-semibold"
                        >
                            <span className="flex size-9 items-center justify-center rounded-md bg-cyan-400 text-zinc-950">
                                <Clapperboard className="size-5" />
                            </span>
                            Video Editor
                        </Link>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
                        <div className="mb-8 space-y-2">
                            <h1 className="text-2xl font-semibold">{title}</h1>
                            <p className="text-sm leading-6 text-zinc-400">
                                {description}
                            </p>
                        </div>

                        {children}
                    </div>
                </div>
            </section>
        </main>
    );
}
