import type { ReactNode } from "react";
import { Brain, Heart, ListChecks, LogOut, Menu, PiggyBank, ScrollText, Utensils, Map, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { logout } from "@/lib/auth";
import { useState } from "react";

interface LayoutProps {
    children: ReactNode;
}
export default function Layout({children}: LayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `inline-flex items-center gap-2 font-pompiere text-xl tracking-widest hover:underline underline-offset-5 hover:translate-x-1 transition-transform duration-300 cursor-pointer ${isActive ? "underline" : ""}`;

    const mobileNavItemClass = ({ isActive }: { isActive: boolean }) =>
        `block rounded-md px-3 py-2 text-lg tracking-widest hover:bg-claret hover:text-pink ${isActive ? "bg-claret text-pink" : ""}`;

    const navLinks = (
        <>
            <NavLink to="/owo" className={navItemClass}><PiggyBank className="size-4" />OWO</NavLink>
            <NavLink to="/dopamine-calendar" className={navItemClass}><Brain className="size-4" />DOPAMINE</NavLink>
            <NavLink to="/mementos" className={navItemClass}><ScrollText className="size-4" />MEMENTO</NavLink>
            <NavLink to="/ounje" className={navItemClass}><Utensils className="size-4" />OUNJE</NavLink>
            <NavLink to="/odyssey" className={navItemClass}><Map className="size-4" />ODYSSEY</NavLink>
            <NavLink to="/man-list" className={navItemClass}><ListChecks className="size-4" />THE LIST</NavLink>
        </>
    );

    const mobileNavLinks = (
        <>
            <NavLink to="/owo" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}>OWO</NavLink>
            <NavLink to="/dopamine-calendar" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}>DOPAMINE</NavLink>
            <NavLink to="/mementos" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}>MEMENTO</NavLink>
            <NavLink to="/ounje" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}>OUNJE</NavLink>
            <NavLink to="/odyssey" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}>ODYSSEY</NavLink>
            <NavLink to="/man-list" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}>THE LIST</NavLink>
        </>
    );

    return (
        <div className="min-h-screen bg-claret text-pink font-pompiere tracking-widest flex flex-col">
            <header className="fixed top-0 left-0 w-full h-16 flex justify-between px-4 md:px-10 items-center bg-claret z-20">
                <Link to='/dashboard'>
                    <h1 className="font-modern font-black text-2xl md:text-4xl">heph</h1>
                </Link>
                
                <div className="flex items-center gap-4 text-sm md:text-base">
                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        aria-label="Toggle navigation"
                        title="Toggle navigation"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-pink/50 lg:hidden"
                    >
                        {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                    </button>
                    <button
                        type="button"
                        onClick={logout}
                        aria-label="Logout"
                        title="Logout"
                        className="inline-flex items-center justify-center hover:scale-105 transition-transform duration-300"
                    >
                        <LogOut className="size-5 md:size-6" />
                    </button>
                </div>

                {isMobileMenuOpen && (
                    <div className="absolute left-4 right-4 top-16 rounded-md border border-claret/20 bg-pink p-3 text-claret shadow-xl lg:hidden">
                        <nav className="space-y-1">{mobileNavLinks}</nav>
                    </div>
                )}
            </header>

            <aside className="fixed left-0 top-16 z-10 hidden h-[calc(100vh-4rem)] w-56 border-r border-pink/20 bg-claret px-6 py-8 lg:block">
                <nav className="flex flex-col gap-5">{navLinks}</nav>
            </aside>

            <main className="pt-24 w-full p-4 md:py-24 md:px-20 lg:pl-72 flex-1">
                {children}
            </main>

            <footer className="w-full bg-pink text-claret py-4 px-4 md:px-10 lg:pl-72">
                <div className="flex items-center justify-center gap-2 text-sm md:text-base">
                    <span>made with</span>
                    <Heart className="size-4 fill-claret text-claret" />
                    <span>by Hephzibah Ifeoluwa Folami.</span>
                </div>
            </footer>
            
        </div>
    )
}
