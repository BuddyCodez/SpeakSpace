"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { LayoutDashboard, LogOut, Menu, User } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AuthModal } from "../auth/auth-modal"
import { signOut, useSession } from "next-auth/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"

const routes = [
    {
        title: "Home",
        href: "/",
    },
    {
        title: "Features",
        href: "#features",
        children: [
            {
                title: "Group Discussions",
                href: "#gd",
                description: "Practice group discussions with peers and get feedback",
            },
            {
                title: "Mock Interviews",
                href: "#interviews",
                description: "Simulate interview scenarios with role-specific sessions",
            },
            {
                title: "Performance Analytics",
                href: "#analytics",
                description: "Track your progress and identify areas for improvement",
            },
        ],
    },
    {
        title: "How It Works",
        href: "#how-it-works",
    },
    {
        title: "Pricing",
        href: "#pricing",
    },
]

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false)
    const { data: session } = useSession()
    const pathname = usePathname()

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 10) {
                setIsScrolled(true)
            } else {
                setIsScrolled(false)
            }
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <header
            className={cn(
                "fixed top-0 w-full z-50 transition-all duration-300",
                isScrolled ? "bg-background/80 backdrop-blur-md shadow-sm py-2" : "bg-transparent py-4",
            )}
        >
            <div className="container flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-transparent bg-clip-text">
                        SpeakSpace
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6">
                    <NavigationMenu>
                        <NavigationMenuList>
                            {routes.map((route) =>
                                route.children ? (
                                    <NavigationMenuItem key={route.title}>
                                        <NavigationMenuTrigger>{route.title}</NavigationMenuTrigger>
                                        <NavigationMenuContent>
                                            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                                                {route.children.map((child) => (
                                                    <li key={child.title}>
                                                        <NavigationMenuLink asChild className="rounded-xl">
                                                            <a
                                                                href={child.href}
                                                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                                            >
                                                                <div className="text-sm font-medium leading-none">{child.title}</div>
                                                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                                                    {child.description}
                                                                </p>
                                                            </a>
                                                        </NavigationMenuLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        </NavigationMenuContent>
                                    </NavigationMenuItem>
                                ) : (
                                    <NavigationMenuItem key={route.title}>
                                        <Link href={route.href} legacyBehavior passHref className="rounded-lg">
                                            <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), 'rounded-xl')}>{route.title}</NavigationMenuLink>
                                        </Link>
                                    </NavigationMenuItem>
                                ),
                            )}
                        </NavigationMenuList>
                    </NavigationMenu>

                    <div className="flex items-center gap-2">
                        {session ? <UserMenu /> : <AuthModal />}
                    </div>
                </div>

                {/* Mobile Navigation */}
                <div className="flex items-center gap-2 md:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <div className="flex flex-col gap-6 pt-6">
                                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                                    SpeakSpace
                                </Link>
                                <nav className="flex flex-col gap-4">
                                    {routes.map((route) => (
                                        <Link
                                            key={route.title}
                                            href={route.href}
                                            className={cn(
                                                "text-lg font-medium transition-colors hover:text-primary",
                                                pathname === route.href ? "text-primary" : "text-muted-foreground",
                                            )}
                                        >
                                            {route.title}
                                        </Link>
                                    ))}
                                </nav>
                                <div className="flex flex-col gap-2 mt-4">
                                    {session ? <UserMenu /> : <AuthModal />}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}

const UserMenu = () => {
    const { data: session } = useSession()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        {session?.user?.image ? (
                            <AvatarImage src={session.user.image || "/placeholder.svg"} alt={session?.user?.name || "User"} />
                        ) : (
                            <AvatarFallback className="bg-blue-600 text-white font-bold">{session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}</AvatarFallback>
                        )}
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 cursor-pointer" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}