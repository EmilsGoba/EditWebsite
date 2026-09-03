import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard, login, register } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Video montāža" />

            <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
                <header className="mx-auto flex max-w-6xl items-center justify-between">
                    <Link href="/" className="text-lg font-semibold">
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
                                    className="rounded-md px-4 py-2 text-zinc-300 transition hover:text-white"
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

                <section className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center">
                    <p className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
                        Video montāžas mājaslapa
                    </p>
                    <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
                        Tīrs sākums tavam video redaktoram.
                    </h1>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                        Šeit soli pa solim veidosim projektu izveidi, video
                        augšupielādi, laika joslu, priekšskatījumu un montāžas
                        rīkus.
                    </p>
                </section>
            </main>
        </>
    );
}
