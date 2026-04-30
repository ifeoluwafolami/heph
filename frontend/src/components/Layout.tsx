import type { ReactNode } from "react";
import { Heart } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

interface LayoutProps {
    children: ReactNode;
}
export default function Layout({children}: LayoutProps) {
    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `inline-block font-pompiere md:text-xl tracking-widest hover:underline underline-offset-5 hover:scale-105 transition-transform duration-300 cursor-pointer ${isActive ? "underline" : ""}`;

    return (
        <div className="min-h-screen bg-claret text-pink font-pompiere tracking-widest flex flex-col">
            <header className="fixed top-0 left-0 w-full h-16 flex justify-between px-4 md:px-10 items-center bg-claret">
                <Link to='/dashboard'>
                    <h1 className="font-modern font-black text-2xl md:text-4xl">heph</h1>
                </Link>
                
                <div className="flex gap-8">
                    <NavLink to='/owo' className={navItemClass}>OWO</NavLink>
                    <NavLink to='/mementos' className={navItemClass}>MEMENTO</NavLink>
                    <NavLink to='/ounje' className={navItemClass}>OUNJE</NavLink>
                </div>
            </header>

            <main className="pt-24 w-full p-4 md:py-24 md:px-20 flex-1">
                {children}
            </main>

            <footer className="w-full bg-pink text-claret py-4 px-4 md:px-10">
                <div className="flex items-center justify-center gap-2 text-sm md:text-base">
                    <span>made with</span>
                    <Heart className="size-4 fill-claret text-claret" />
                    <span>by Hephzibah Ifeoluwa Folami.</span>
                </div>
            </footer>
            
        </div>
    )
}