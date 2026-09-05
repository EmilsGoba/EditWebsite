import { Link, usePage } from '@inertiajs/react';
import { Clapperboard, LayoutGrid, Menu } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from '@/components/ui/navigation-menu';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { UserMenuContent } from '@/components/user-menu-content';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { BreadcrumbItem, NavItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

const mainNavItems: NavItem[] = [
    {
        title: 'Projects',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

const activeItemStyles =
    'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950';

export function AppHeader({ breadcrumbs = [] }: Props) {
    const page = usePage();
    const { auth } = page.props;
    const getInitials = useInitials();
    const { whenCurrentUrl } = useCurrentUrl();

    return (
        <>
            <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
                <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
                    <div className="mr-3 lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9"
                                >
                                    <Menu className="size-5" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="flex h-full w-72 flex-col bg-white p-0 dark:bg-zinc-950"
                            >
                                <SheetHeader className="border-b border-zinc-200 p-5 text-left dark:border-zinc-800">
                                    <SheetTitle className="flex items-center gap-3 text-base">
                                        <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-500 text-zinc-950">
                                            <Clapperboard className="size-5" />
                                        </span>
                                        Video Editor
                                    </SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col gap-2 p-4">
                                    {mainNavItems.map((item) => (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white',
                                                whenCurrentUrl(
                                                    item.href,
                                                    activeItemStyles,
                                                ),
                                            )}
                                        >
                                            {item.icon && (
                                                <item.icon className="size-4" />
                                            )}
                                            {item.title}
                                        </Link>
                                    ))}
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <Link
                        href={dashboard()}
                        prefetch
                        className="flex min-w-0 items-center gap-3"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-zinc-950 shadow-sm">
                            <Clapperboard className="size-5" />
                        </span>
                        <span className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                            Video Editor
                        </span>
                    </Link>

                    <NavigationMenu className="ml-8 hidden lg:flex">
                        <NavigationMenuList className="flex items-center gap-1">
                            {mainNavItems.map((item) => (
                                <NavigationMenuItem key={item.title}>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white',
                                            whenCurrentUrl(
                                                item.href,
                                                activeItemStyles,
                                            ),
                                        )}
                                    >
                                        {item.icon && (
                                            <item.icon className="size-4" />
                                        )}
                                        {item.title}
                                    </Link>
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>

                    <div className="ml-auto flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="h-10 gap-2 rounded-full px-2"
                                >
                                    <Avatar className="size-8 overflow-hidden rounded-full">
                                        <AvatarImage
                                            src={auth.user?.avatar}
                                            alt={auth.user?.name}
                                        />
                                        <AvatarFallback className="bg-zinc-200 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-white">
                                            {getInitials(auth.user?.name ?? '')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="hidden max-w-32 truncate text-sm font-medium text-zinc-700 sm:block dark:text-zinc-200">
                                        {auth.user?.name}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                {auth.user && (
                                    <UserMenuContent user={auth.user} />
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {breadcrumbs.length > 1 && (
                <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mx-auto flex h-11 w-full max-w-7xl items-center px-4 text-sm text-zinc-500 sm:px-6 lg:px-8 dark:text-zinc-400">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </>
    );
}
