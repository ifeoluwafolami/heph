import type { ReactNode } from "react";
import { Bell, Brain, Heart, ListChecks, LogOut, Menu, PiggyBank, ScrollText, Sprout, Utensils, Map, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { getAccessToken, getBloomPlans, type BloomPlanDto } from "@/lib/api";
import { logout } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";

interface LayoutProps {
    children: ReactNode;
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string) {
    return new Date(`${dateKey}T00:00:00`);
}

export default function Layout({children}: LayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [bloomPlans, setBloomPlans] = useState<BloomPlanDto[]>([]);
    const [showBloomReminders, setShowBloomReminders] = useState(false);
    const { pathname } = useLocation();
    const pageTitleByPath: Record<string, string> = {
        "/dashboard": "DASHBOARD",
        "/owo": "OWO",
        "/dopamine-calendar": "DOPAMINE CALENDAR",
        "/mementos": "MEMENTO",
        "/ounje": "OUNJE",
        "/bloom": "BLOOM",
        "/odyssey": "ODYSSEY",
        "/the-one": "THE ONE",
    };
    const pageTitle = pageTitleByPath[pathname] || "";
    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `inline-flex items-center gap-2 font-pompiere text-xl tracking-widest hover:underline underline-offset-5 hover:translate-x-1 transition-transform duration-300 cursor-pointer ${isActive ? "underline" : ""}`;

    const mobileNavItemClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-lg tracking-widest hover:bg-claret hover:text-pink ${isActive ? "bg-claret text-pink" : ""}`;

    const navLinks = (
        <>
            <NavLink to="/owo" className={navItemClass}><PiggyBank className="size-4" />OWO</NavLink>
            <NavLink to="/dopamine-calendar" className={navItemClass}><Brain className="size-4" />DOPAMINE</NavLink>
            <NavLink to="/mementos" className={navItemClass}><ScrollText className="size-4" />MEMENTO</NavLink>
            <NavLink to="/ounje" className={navItemClass}><Utensils className="size-4" />OUNJE</NavLink>
            <NavLink to="/bloom" className={navItemClass}><Sprout className="size-4" />BLOOM</NavLink>
            <NavLink to="/odyssey" className={navItemClass}><Map className="size-4" />ODYSSEY</NavLink>
            <NavLink to="/the-one" className={navItemClass}><ListChecks className="size-4" />THE ONE</NavLink>
        </>
    );

    const mobileNavLinks = (
        <>
            <NavLink to="/owo" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><PiggyBank className="size-4" />OWO</NavLink>
            <NavLink to="/dopamine-calendar" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><Brain className="size-4" />DOPAMINE</NavLink>
            <NavLink to="/mementos" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><ScrollText className="size-4" />MEMENTO</NavLink>
            <NavLink to="/ounje" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><Utensils className="size-4" />OUNJE</NavLink>
            <NavLink to="/bloom" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><Sprout className="size-4" />BLOOM</NavLink>
            <NavLink to="/odyssey" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><Map className="size-4" />ODYSSEY</NavLink>
            <NavLink to="/the-one" onClick={() => setIsMobileMenuOpen(false)} className={mobileNavItemClass}><ListChecks className="size-4" />THE ONE</NavLink>
        </>
    );
    const upcomingBloomPlans = useMemo(() => {
        const start = parseDateKey(todayKey()).getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000;
        return bloomPlans
            .filter((plan) => {
                const time = parseDateKey(plan.date).getTime();
                return time >= start && time <= end;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [bloomPlans]);

    useEffect(() => {
        let mounted = true;
        const refreshBloomPlans = () => {
            if (!getAccessToken()) return;
            const start = todayKey();
            const endDate = parseDateKey(start);
            endDate.setDate(endDate.getDate() + 7);
            getBloomPlans(start, `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`)
                .then((plans) => {
                    if (mounted) setBloomPlans(plans);
                })
                .catch(() => {
                    if (mounted) setBloomPlans([]);
                });
        };
        refreshBloomPlans();
        window.addEventListener("heph:bloom:changed", refreshBloomPlans);
        return () => {
            mounted = false;
            window.removeEventListener("heph:bloom:changed", refreshBloomPlans);
        };
    }, []);

    useEffect(() => {
        if (!upcomingBloomPlans.length) return;
        const reminderKey = `heph_bloom_reminders_seen_${todayKey()}`;
        if (sessionStorage.getItem(reminderKey)) return;
        setShowBloomReminders(true);
        sessionStorage.setItem(reminderKey, "true");
    }, [upcomingBloomPlans]);

    return (
        <div className="min-h-screen bg-claret text-pink font-pompiere tracking-widest flex flex-col">
            <header className="fixed top-0 left-0 w-full h-16 flex justify-between px-4 md:px-10 items-center bg-claret z-20">
                <Link to='/dashboard'>
                    <h1 className="font-modern font-black text-2xl md:text-4xl">heph</h1>
                </Link>

                {pageTitle && (
                    <div className="pointer-events-none absolute left-72 right-20 hidden text-center font-pompiere text-xl uppercase tracking-[0.25em] text-pink lg:block">
                        {pageTitle}
                    </div>
                )}
                
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

            {showBloomReminders && upcomingBloomPlans.length ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-claret/60 p-4">
                    <div className="hide-scrollbar h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-claret/20 bg-pink p-6 text-claret shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Bell className="size-5" />
                                <h2 className="text-2xl font-bold uppercase">Bloom Reminders</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowBloomReminders(false)}
                                aria-label="Close reminders"
                                title="Close reminders"
                                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-claret hover:text-pink"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="mt-4 space-y-2">
                            {upcomingBloomPlans.map((plan) => (
                                <div key={plan._id} className="rounded-xl border border-claret/30 p-3">
                                    <div className="flex items-start gap-3">
                                        <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: plan.color }} />
                                        <div>
                                            <p className="text-sm uppercase tracking-widest opacity-75">{new Date(`${plan.date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}</p>
                                            <p className="text-lg leading-tight">{plan.title}</p>
                                            {plan.notes ? <p className="mt-1 whitespace-pre-wrap text-sm tracking-normal opacity-80">{plan.notes}</p> : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Link
                                to="/bloom"
                                onClick={() => setShowBloomReminders(false)}
                                className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90"
                            >
                                Open Bloom
                            </Link>
                        </div>
                    </div>
                </div>
            ) : null}
            
        </div>
    )
}
