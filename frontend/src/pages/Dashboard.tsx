import Layout from "@/components/Layout";
import PaginationControls from "@/components/PaginationControls";
import RecentExpenses from "@/components/RecentExpenses";
import RecentMementos from "@/components/RecentMementos";
import { useToast } from "@/components/Toast";
import { Check, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    createHabit,
    createSavingsTarget,
    getDashboardOverview,
    getRecentDashboardExpenses,
    getRecentDashboardMementos,
    getBudgets,
    getHabits,
    getRecipes,
    getSavingsTargets,
    getSidequests,
    getWeights,
    toggleHabitLog,
    type BudgetDto,
    type ExpenseDto,
    type HabitDto,
    type HabitFrequency,
    type MementoDto,
    type SavingsTargetDto,
    type SavingsTransactionDto,
    type SidequestDto,
    type WeightDto,
} from "@/lib/api";

type RecentExpenseItem = {
    title: string;
    date: string;
    amount: string;
    category?: string | null;
}
type SavingsTransaction = { id: string; type: "deposit" | "withdraw"; amount: number; date: string }
type SavingsTarget = { _id?: string; id?: string; title: string; targetAmount: number; savedAmount?: number; transactions?: SavingsTransaction[] }
type LocalHabit = { id: string; title: string; frequency: HabitFrequency; target: number; logs: string[] }

const SAVINGS_STORAGE_KEY = "heph_owo_savings_targets"
const SAVINGS_MIGRATION_KEY = "heph_owo_savings_targets_server_migrated"
const HABITS_STORAGE_KEY = "heph_dopamine_calendar"
const HABITS_MIGRATION_KEY = "heph_dopamine_calendar_server_migrated"
const DASHBOARD_HABITS_PER_PAGE = 6

function todayKey() {
    return new Date().toISOString().slice(0, 10)
}

function monthKey(dateKey = todayKey()) {
    return dateKey.slice(0, 7)
}

function parseDateKey(dateKey: string) {
    return new Date(`${dateKey}T00:00:00`)
}

function toDateKey(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function getWeekKey(dateKey: string) {
    const date = parseDateKey(dateKey)
    const day = date.getDay()
    const daysSinceMonday = day === 0 ? 6 : day - 1
    date.setDate(date.getDate() - daysSinceMonday)
    return toDateKey(date)
}

function getDashboardHabitProgress(habit: HabitDto, dateKey = todayKey()) {
    if (habit.frequency === "daily") {
        const done = habit.logs.includes(dateKey) ? 1 : 0
        return { done, target: 1, percent: done * 100, extra: 0 }
    }

    const target = Math.max(1, habit.target)
    const done = habit.logs.filter((logDate) => (
        habit.frequency === "weekly"
            ? getWeekKey(logDate) === getWeekKey(dateKey)
            : monthKey(logDate) === monthKey(dateKey)
    )).length

    return {
        done,
        target,
        percent: Math.round((done / target) * 100),
        extra: Math.max(0, done - target),
    }
}

function getFrequencyLabel(habit: HabitDto) {
    if (habit.frequency === "daily") return "Daily"
    return `${habit.target} Times ${habit.frequency === "weekly" ? "Weekly" : "Monthly"}`
}

function getSavedAmount(target: SavingsTargetDto) {
    return (target.transactions || []).reduce((sum, transaction) => (
        sum + (transaction.type === "deposit" ? transaction.amount : -transaction.amount)
    ), 0)
}

function getDaysInMonth(dateKey = todayKey()) {
    const date = parseDateKey(dateKey)
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function getWeeksInMonth(dateKey = todayKey()) {
    const date = parseDateKey(dateKey)
    const weeks = new Set<string>()
    for (let day = 1; day <= getDaysInMonth(dateKey); day += 1) {
        weeks.add(getWeekKey(toDateKey(new Date(date.getFullYear(), date.getMonth(), day))))
    }
    return weeks.size
}

function getMonthlyHabitTarget(habit: HabitDto, dateKey = todayKey()) {
    if (habit.frequency === "daily") return getDaysInMonth(dateKey)
    if (habit.frequency === "weekly") return Math.max(1, habit.target) * getWeeksInMonth(dateKey)
    return Math.max(1, habit.target)
}

function getMonthlyHabitDone(habit: HabitDto, dateKey = todayKey()) {
    const currentMonth = monthKey(dateKey)
    return (habit.logs || []).filter((logDate) => monthKey(logDate) === currentMonth).length
}

function getMetaTotal<T>(items: T[], fallback = items.length) {
    return ((items as T[] & { _meta?: { total?: number } })._meta?.total) ?? fallback
}

function isCompletedSidequest(sidequest: SidequestDto) {
    const milestones = sidequest.milestones || []
    if (milestones.length > 0) return milestones.every((milestone) => milestone.done)
    return Boolean(sidequest.completed)
}

function isOngoingSidequest(sidequest: SidequestDto) {
    if (isCompletedSidequest(sidequest)) return false
    const milestones = sidequest.milestones || []
    if (milestones.length === 0) return !sidequest.completed
    const done = milestones.filter((milestone) => milestone.done).length
    return done > 0
}

function loadCachedSavingsTargets(): SavingsTargetDto[] {
    try {
        const raw = localStorage.getItem(SAVINGS_STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) as SavingsTarget[] : []
        return parsed.map((target) => {
            const id = target._id || target.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`
            const savedAmount = target.savedAmount || 0
            return {
                _id: id,
                title: target.title,
                targetAmount: target.targetAmount,
                transactions: target.transactions || (savedAmount > 0 ? [{ id: `migration-${id}`, type: "deposit" as const, amount: savedAmount, date: todayKey() }] : []),
            }
        })
    } catch {
        return []
    }
}

function cacheSavingsTargets(targets: SavingsTargetDto[]) {
    localStorage.setItem(SAVINGS_STORAGE_KEY, JSON.stringify(targets.map((target) => ({
        id: target._id,
        title: target.title,
        targetAmount: target.targetAmount,
        transactions: target.transactions,
    }))))
}

async function getSyncedSavingsTargets() {
    const cachedTargets = loadCachedSavingsTargets()
    let remoteTargets: SavingsTargetDto[] = []

    try {
        remoteTargets = await getSavingsTargets()
    } catch {
        return cachedTargets
    }

    const shouldMigrate = !localStorage.getItem(SAVINGS_MIGRATION_KEY) && cachedTargets.length > 0
    if (!shouldMigrate) {
        cacheSavingsTargets(remoteTargets)
        localStorage.setItem(SAVINGS_MIGRATION_KEY, "true")
        return remoteTargets
    }

    const knownTitles = new Set(remoteTargets.map((target) => target.title.trim().toLowerCase()))
    const migrated = await Promise.all(cachedTargets
        .filter((target) => !knownTitles.has(target.title.trim().toLowerCase()))
        .map((target) => createSavingsTarget({
            title: target.title,
            targetAmount: target.targetAmount,
            transactions: target.transactions as SavingsTransactionDto[],
        })))
    const nextTargets = [...migrated, ...remoteTargets]
    cacheSavingsTargets(nextTargets)
    localStorage.setItem(SAVINGS_MIGRATION_KEY, "true")
    return nextTargets
}

function loadCachedHabits(): HabitDto[] {
    try {
        const raw = localStorage.getItem(HABITS_STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) as Array<LocalHabit | HabitDto> : []
        return parsed.map((habit) => ({
            _id: "_id" in habit ? habit._id : habit.id,
            title: habit.title,
            frequency: habit.frequency,
            target: habit.target,
            logs: habit.logs || [],
        }))
    } catch {
        return []
    }
}

function cacheHabits(habits: HabitDto[]) {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits.map((habit) => ({
        id: habit._id,
        title: habit.title,
        frequency: habit.frequency,
        target: habit.target,
        logs: habit.logs,
    }))))
}

async function getSyncedHabits() {
    const cachedHabits = loadCachedHabits()
    let remoteHabits: HabitDto[] = []

    try {
        remoteHabits = await getHabits()
    } catch {
        return cachedHabits
    }

    const shouldMigrate = !localStorage.getItem(HABITS_MIGRATION_KEY) && cachedHabits.length > 0
    if (!shouldMigrate) {
        cacheHabits(remoteHabits)
        localStorage.setItem(HABITS_MIGRATION_KEY, "true")
        return remoteHabits
    }

    const knownTitles = new Set(remoteHabits.map((habit) => habit.title.trim().toLowerCase()))
    const migrated = await Promise.all(cachedHabits
        .filter((habit) => !knownTitles.has(habit.title.trim().toLowerCase()))
        .map((habit) => createHabit({
            title: habit.title,
            frequency: habit.frequency,
            target: habit.frequency === "daily" ? 1 : Math.max(1, habit.target),
            logs: habit.logs,
        })))
    const nextHabits = [...migrated, ...remoteHabits]
    cacheHabits(nextHabits)
    localStorage.setItem(HABITS_MIGRATION_KEY, "true")
    return nextHabits
}

export default function Dashboard() {
    const toast = useToast()
    const [greeting, setGreeting] = useState("");
    const [nickname, setNickname] = useState("princess");

    useEffect(() => {
        const formatter = new Intl.DateTimeFormat("en-NG", {
            timeZone: "Africa/Lagos",
            hour: "2-digit",
            hour12: false,
        });

        const setGreetingByWatHour = () => {
            const hour = Number(formatter.format(new Date()));

            if (hour < 12) {
                setGreeting("Good morning");
            } else if (hour < 18) {
                setGreeting("Good afternoon");
            } else if (hour < 22) {
                setGreeting("Good evening");
            } else {
                setGreeting("Hi")
                setNickname("night owl");
            }
        };

        setGreetingByWatHour();
        const id = window.setInterval(setGreetingByWatHour, 60_000);

        return () => window.clearInterval(id);
    }, []);

    const [summary, setSummary] = useState<{ totalSpent: number; totalBudgeted: number; mementosAdded: number; weightProgressKg: number; newRecipes: number; totalSidequests: number }>({ totalSpent: 0, totalBudgeted: 0, mementosAdded: 0, weightProgressKg: 0, newRecipes: 0, totalSidequests: 0 })
    const [recentExpenses, setRecentExpenses] = useState<RecentExpenseItem[]>([])
    const [recentMementos, setRecentMementos] = useState<MementoDto[]>([])
    const [totalSavedThisMonth, setTotalSavedThisMonth] = useState(0)
    const [savingsOverviewTargets, setSavingsOverviewTargets] = useState<SavingsTargetDto[]>(loadCachedSavingsTargets)
    const [recipesTotal, setRecipesTotal] = useState(0)
    const [weightEntries, setWeightEntries] = useState<WeightDto[]>([])
    const [sidequests, setSidequests] = useState<SidequestDto[]>([])
    const [overviewSlide, setOverviewSlide] = useState(0)
    const [overviewTouchStartX, setOverviewTouchStartX] = useState<number | null>(null)
    const [habits, setHabits] = useState<HabitDto[]>([])
    const [habitsPage, setHabitsPage] = useState(1)

    async function loadLocalOverview() {
        const savings = await getSyncedSavingsTargets().catch(() => loadCachedSavingsTargets())
        setSavingsOverviewTargets(savings)
        const saved = savings.reduce((sum, target) => {
            const transactions = target.transactions || []
            return sum + transactions
                .filter((transaction) => transaction.type === "deposit" && monthKey(transaction.date) === monthKey())
                .reduce((targetSum, transaction) => targetSum + transaction.amount, 0)
        }, 0)
        setTotalSavedThisMonth(saved)
    }

    useEffect(() => {
        let mounted = true
        async function load() {
            loadLocalOverview().catch(() => setTotalSavedThisMonth(0))

            getSyncedHabits()
                .then((items) => {
                    if (mounted) setHabits(items)
                })
                .catch(() => {
                    if (mounted) setHabits(loadCachedHabits())
                })

            getDashboardOverview()
                .then((overview) => {
                    if (!mounted) return
                    setSummary({
                        totalSpent: overview.totalSpent,
                        totalBudgeted: overview.totalBudgeted,
                        mementosAdded: overview.mementosAdded,
                        weightProgressKg: overview.weightProgressKg,
                        newRecipes: overview.totalRecipes ?? overview.newRecipes,
                        totalSidequests: overview.totalSidequests ?? 0,
                    })
                })
                .catch(() => {})

            Promise.all([
                getRecentDashboardExpenses(10),
                getBudgets().catch(() => [] as BudgetDto[]),
            ])
                .then(([expenses, budgets]) => {
                    if (!mounted) return
                    const map = new Map<string, string>()
                    budgets.forEach((b: BudgetDto) => map.set(b._id, b.name))
                    setRecentExpenses(expenses.map((e: ExpenseDto) => ({
                        title: e.title,
                        date: new Date(e.expenseDate).toLocaleDateString(),
                        amount: (e.amount || 0).toString(),
                        category: e.categoryId ? map.get(e.categoryId) ?? null : null,
                    })))
                })
                .catch(() => {})

            getRecentDashboardMementos(3)
                .then((mementos) => {
                    if (mounted) setRecentMementos(mementos)
                })
                .catch(() => {})

            Promise.all([
                getRecipes(1, 1).catch(() => []),
                getWeights(12, 1).catch(() => [] as WeightDto[]),
                getSidequests(1000, 1).catch(() => [] as SidequestDto[]),
            ]).then(([recipes, weights, sidequestItems]) => {
                if (!mounted) return
                setRecipesTotal(getMetaTotal(recipes, recipes.length))
                setWeightEntries(weights)
                setSidequests(sidequestItems)
            }).catch(() => {})
        }

        load()
            const handler = () => { load().catch(() => {}) }
            const dataHandler = (ev: Event) => {
                const detail = (ev as CustomEvent)?.detail
                if (!detail || !detail.resource) return load().catch(() => {})
                return load().catch(() => {})
            }
            window.addEventListener('heph:expense:created', handler as EventListener)
            window.addEventListener('heph:data:changed', dataHandler as EventListener)
                return () => { mounted = false; window.removeEventListener('heph:expense:created', handler as EventListener); window.removeEventListener('heph:data:changed', dataHandler as EventListener) }
    }, [])

    async function toggleHabitForToday(habitId: string) {
        const today = todayKey()
        try {
            const updated = await toggleHabitLog(habitId, today)
            const checkedIn = updated.logs.includes(today)
            setHabits((prev) => {
                const nextHabits = prev.map((habit) => habit._id === habitId ? updated : habit)
                cacheHabits(nextHabits)
                return nextHabits
            })
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'habit' } }))
            toast.push({ type: "success", message: checkedIn ? "Habit checked in." : "Check-in removed." })
        } catch {
            toast.push({ type: "error", message: "Could not update that check-in." })
        }
    }

    const sortedHabits = useMemo(() => {
        const order: Record<HabitFrequency, number> = { daily: 0, weekly: 1, monthly: 2 }
        return [...habits].sort((a, b) => order[a.frequency] - order[b.frequency])
    }, [habits])

    const habitsTotalPages = Math.max(1, Math.ceil(sortedHabits.length / DASHBOARD_HABITS_PER_PAGE))
    const safeHabitsPage = Math.min(habitsPage, habitsTotalPages)
    const paginatedHabits = sortedHabits.slice((safeHabitsPage - 1) * DASHBOARD_HABITS_PER_PAGE, safeHabitsPage * DASHBOARD_HABITS_PER_PAGE)

    useEffect(() => {
        setHabitsPage((page) => Math.min(page, habitsTotalPages))
    }, [habitsTotalPages])

    const overviewStats = useMemo(() => {
        const totalSavingsTarget = savingsOverviewTargets.reduce((sum, target) => sum + target.targetAmount, 0)
        const totalSaved = savingsOverviewTargets.reduce((sum, target) => sum + getSavedAmount(target), 0)
        const monthlyHabitDone = habits.reduce((sum, habit) => sum + getMonthlyHabitDone(habit), 0)
        const monthlyHabitTarget = habits.reduce((sum, habit) => sum + getMonthlyHabitTarget(habit), 0)
        const monthlyHitHabits = habits
            .map((habit) => ({
                habit,
                done: getMonthlyHabitDone(habit),
                target: getMonthlyHabitTarget(habit),
            }))
            .filter((item) => item.done > 0)
            .sort((a, b) => b.done - a.done)
        const ongoingSidequests = sidequests.filter(isOngoingSidequest).slice(0, 3)
        const sortedWeights = [...weightEntries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
        const firstWeight = sortedWeights[0]?.weightKg ?? 0
        const latestWeight = sortedWeights[sortedWeights.length - 1]?.weightKg ?? firstWeight
        const weightDelta = Number((latestWeight - firstWeight).toFixed(1))

        return {
            totalSavingsTarget,
            totalSaved,
            savingsPercent: totalSavingsTarget > 0 ? Math.round((totalSaved / totalSavingsTarget) * 100) : 0,
            monthlyHabitDone,
            monthlyHabitTarget,
            monthlyHabitPercent: monthlyHabitTarget > 0 ? Math.round((monthlyHabitDone / monthlyHabitTarget) * 100) : 0,
            monthlyHitHabits,
            ongoingSidequests,
            sortedWeights,
            weightDelta,
        }
    }, [habits, savingsOverviewTargets, sidequests, weightEntries])

    const weightChartPoints = useMemo(() => {
        const values = overviewStats.sortedWeights.map((entry) => entry.weightKg)
        if (values.length === 0) return ""
        if (values.length === 1) return "0,50 100,50"
        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min || 1
        return values.map((value, index) => {
            const x = (index / (values.length - 1)) * 100
            const y = 90 - ((value - min) / range) * 80
            return `${x},${y}`
        }).join(" ")
    }, [overviewStats.sortedWeights])

    const overviewSlides = [
        {
            title: "OWO",
            to: "/owo",
            content: (
                <>
                    <div className="rounded-xl border border-claret/20 p-5">
                        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-widest opacity-75">Saved / Savings Target</p>
                                <p className="mt-1 text-4xl font-bold">
                                    N{overviewStats.totalSaved.toLocaleString()}
                                    <span className="text-xl font-bold opacity-75"> / N{overviewStats.totalSavingsTarget.toLocaleString()}</span>
                                </p>
                            </div>
                            <p className="text-sm uppercase tracking-widest opacity-75">{overviewStats.savingsPercent}%</p>
                        </div>
                        <div className="mt-5 h-3 overflow-hidden rounded-full bg-claret/20">
                            <div className="h-full rounded-full bg-claret" style={{ width: `${Math.min(100, overviewStats.savingsPercent)}%` }} />
                        </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-claret/20 p-4">
                            <p className="text-sm uppercase tracking-widest opacity-75">Saved This Month</p>
                            <p className="mt-1 text-3xl font-bold">N{totalSavedThisMonth.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl border border-claret/20 p-4">
                            <p className="text-sm uppercase tracking-widest opacity-75">Spent This Month</p>
                            <p className="mt-1 text-3xl font-bold">N{summary.totalSpent.toLocaleString()}</p>
                        </div>
                    </div>
                </>
            ),
        },
        {
            title: "Dopamine Calendar",
            to: "/dopamine-calendar",
            content: (
                <>
                    <p className="text-sm uppercase tracking-widest opacity-75">Monthly Hits</p>
                    <p className="mt-1 text-4xl font-bold">{overviewStats.monthlyHabitDone} / {overviewStats.monthlyHabitTarget}</p>
                    <div className="mt-5 h-4 overflow-hidden rounded-full bg-claret/20">
                        <div className="h-full rounded-full bg-claret" style={{ width: `${Math.min(100, overviewStats.monthlyHabitPercent)}%` }} />
                    </div>
                    <p className="mt-3 text-sm uppercase tracking-widest opacity-75">{overviewStats.monthlyHabitPercent}% follow through this month</p>
                    <div className="mt-5">
                        <p className="text-sm uppercase tracking-widest opacity-75">Hit This Month</p>
                        {overviewStats.monthlyHitHabits.length > 0 ? (
                            <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto pr-2 md:grid-cols-4">
                                {overviewStats.monthlyHitHabits.map(({ habit, done, target }) => (
                                    <div key={habit._id} className="rounded-xl border border-claret/20 px-3 py-2 flex flex-col justify-between">
                                        <p className={`font-bold capitalize ${habit.title.length > 24 ? 'text-base' : 'text-lg'}`}>{habit.title}</p>
                                        <p className="text-xs uppercase tracking-widest opacity-75">{done} / {target}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-lg">No hits logged this month yet.</p>
                        )}
                    </div>
                </>
            ),
        },
        {
            title: "Ounje",
            to: "/ounje",
            content: (
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="rounded-xl border border-claret/20 p-5">
                        <p className="text-sm uppercase tracking-widest opacity-75">Recipes</p>
                        <p className="mt-1 text-4xl font-bold">{recipesTotal}</p>
                        <p className="mt-4 text-sm uppercase tracking-widest opacity-75">Trend</p>
                        <p className="mt-1 text-3xl font-bold">{overviewStats.weightDelta > 0 ? "+" : ""}{overviewStats.weightDelta} kg</p>
                    </div>
                    <div className="rounded-xl border border-claret/20 p-4">
                        <svg viewBox="0 0 100 100" className="h-36 w-full" preserveAspectRatio="none" role="img" aria-label="Weight trend chart">
                            <polyline points="0,90 100,90" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                            <polyline points={weightChartPoints} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            ),
        },
        {
            title: "Odyssey",
            to: "/odyssey",
            content: (
                <>
                    <p className="text-sm uppercase tracking-widest opacity-75">Total Sidequests</p>
                    <p className="mt-1 text-4xl font-bold">{sidequests.length}</p>
                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                        {overviewStats.ongoingSidequests.length > 0 ? overviewStats.ongoingSidequests.map((sidequest) => (
                            <div key={sidequest._id} className="rounded-xl border border-claret/20 p-3">
                                <p className="text-xl font-bold">{sidequest.title}</p>
                                <p className="mt-1 text-xs uppercase tracking-widest opacity-75">Ongoing</p>
                            </div>
                        )) : <p className="text-lg">No ongoing sidequests yet.</p>}
                    </div>
                </>
            ),
        },
    ]

    const safeOverviewSlide = Math.min(overviewSlide, overviewSlides.length - 1)
    const goToPreviousOverview = () => setOverviewSlide((slide) => (slide - 1 + overviewSlides.length) % overviewSlides.length)
    const goToNextOverview = () => setOverviewSlide((slide) => (slide + 1) % overviewSlides.length)

    return (
        <Layout>
            <div className="w-full overflow-y-auto">
                <div className="min-h-16 rounded-2xl p-4 md:p-8 bg-pink text-claret w-full transition-all duration-300">
                    <h3 className="text-xl md:text-4xl font-bold uppercase md:mb-4">{greeting}, {nickname}!</h3>
                    <p className="text-lg md:text-2xl">I am so glad to see you!</p>
                </div>

                <section className="my-6 rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="text-2xl font-bold uppercase md:text-3xl">Overview: {overviewSlides[safeOverviewSlide]?.title}</h4>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={goToPreviousOverview} className="hidden size-10 items-center justify-center rounded-xl border border-claret md:inline-flex" aria-label="Previous overview" title="Previous overview">
                                <ChevronLeft className="size-5" />
                            </button>
                            <button type="button" onClick={goToNextOverview} className="hidden size-10 items-center justify-center rounded-xl border border-claret md:inline-flex" aria-label="Next overview" title="Next overview">
                                <ChevronRight className="size-5" />
                            </button>
                        </div>
                    </div>
                    <div
                        className="overflow-hidden"
                        onTouchStart={(event) => setOverviewTouchStartX(event.touches[0]?.clientX ?? null)}
                        onTouchEnd={(event) => {
                            if (overviewTouchStartX === null) return
                            const endX = event.changedTouches[0]?.clientX ?? overviewTouchStartX
                            const delta = overviewTouchStartX - endX
                            if (Math.abs(delta) > 50) {
                                if (delta > 0) goToNextOverview()
                                else goToPreviousOverview()
                            }
                            setOverviewTouchStartX(null)
                        }}
                    >
                        <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${safeOverviewSlide * 100}%)` }}>
                            {overviewSlides.map((slide) => (
                                <article key={slide.title} className="min-w-full">
                                    {slide.content}
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
                    <h4 className="text-2xl md:text-3xl font-bold uppercase mb-4">Today's Dopamine Hits</h4>
                    {habits.length === 0 ? (
                        <p className="text-lg md:text-xl">No habits yet. Add some in the Dopamine Calendar.</p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {paginatedHabits.map((habit) => {
                                const doneToday = habit.logs.includes(todayKey())
                                const progress = getDashboardHabitProgress(habit)
                                return (
                                    <button
                                        key={habit._id}
                                        type="button"
                                        onClick={() => toggleHabitForToday(habit._id)}
                                        className={`rounded-xl border border-claret/30 p-4 text-left transition-all ${doneToday ? "bg-claret text-pink" : "bg-pink text-claret hover:bg-claret hover:text-pink"}`}
                                    >
                                        <span className="flex items-start justify-between gap-3">
                                            <span>
                                                <span className="block text-xl font-bold capitalize">{habit.title}</span>
                                                <span className="mt-1 block text-xs uppercase tracking-widest opacity-75">{getFrequencyLabel(habit)}</span>
                                            </span>
                                            {doneToday ? <Check className="mt-1 size-5 shrink-0" /> : <Circle className="mt-1 size-5 shrink-0" />}
                                        </span>
                                        <span className="mt-4 block">
                                            <span className="mb-2 flex items-center justify-between gap-2 text-xs uppercase tracking-widest">
                                                <span>{progress.done} / {progress.target}</span>
                                                {progress.extra > 0 ? <span>+{progress.extra} Extra</span> : <span>{progress.percent}%</span>}
                                            </span>
                                            <span className={`block h-2 overflow-hidden rounded-full ${doneToday ? "bg-pink/25" : "bg-claret/20"}`}>
                                                <span
                                                    className={`block h-full rounded-full ${doneToday ? "bg-pink" : "bg-claret"}`}
                                                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                                                />
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    <PaginationControls
                        page={safeHabitsPage}
                        totalPages={habitsTotalPages}
                        onPageChange={setHabitsPage}
                        label="Habits"
                    />
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <RecentExpenses expenses={recentExpenses} />
                    <RecentMementos mementos={recentMementos.map((m) => ({ title: m.title, preview: m.content.replace(/\\n/g, '\n'), date: new Date(m.createdAt).toLocaleDateString() }))} />
                </div>

                <div className="h-10"></div>
            </div>
        </Layout>
    )
}
