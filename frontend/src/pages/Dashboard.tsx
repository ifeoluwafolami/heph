import Layout from "@/components/Layout";
import MonthlyOverview from "@/components/MonthlyOverview";
import RecentExpenses from "@/components/RecentExpenses";
import RecentMementos from "@/components/RecentMementos";
import { Check, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import {
    createHabit,
    createSavingsTarget,
    getDashboardOverview,
    getRecentDashboardExpenses,
    getRecentDashboardMementos,
    getBudgets,
    getHabits,
    getSavingsTargets,
    toggleHabitLog,
    type BudgetDto,
    type ExpenseDto,
    type HabitDto,
    type HabitFrequency,
    type MementoDto,
    type SavingsTargetDto,
    type SavingsTransactionDto,
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

function todayKey() {
    return new Date().toISOString().slice(0, 10)
}

function monthKey(dateKey = todayKey()) {
    return dateKey.slice(0, 7)
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
    const [habits, setHabits] = useState<HabitDto[]>([])

    async function loadLocalOverview() {
        const savings = await getSyncedSavingsTargets().catch(() => loadCachedSavingsTargets())
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
        }

        load()
            const handler = () => { load().catch(() => {}) }
            const dataHandler = (ev: Event) => {
                const detail = (ev as CustomEvent)?.detail
                if (!detail || !detail.resource) {
                    loadLocalOverview().catch(() => {})
                    return load().catch(() => {})
                }
                if (
                    detail.resource === 'memento' ||
                    detail.resource === 'expense' ||
                    detail.resource === 'budget' ||
                    detail.resource === 'recipe' ||
                    detail.resource === 'weight'
                ) return load().catch(() => {})
                if (detail.resource === 'savings') loadLocalOverview().catch(() => {})
                if (detail.resource === 'habit') {
                    getSyncedHabits().then((items) => {
                        if (mounted) setHabits(items)
                    }).catch(() => {})
                }
            }
            window.addEventListener('heph:expense:created', handler as EventListener)
            window.addEventListener('heph:data:changed', dataHandler as EventListener)
                return () => { mounted = false; window.removeEventListener('heph:expense:created', handler as EventListener); window.removeEventListener('heph:data:changed', dataHandler as EventListener) }
    }, [])

    async function toggleHabitForToday(habitId: string) {
        const today = todayKey()
        try {
            const updated = await toggleHabitLog(habitId, today)
            setHabits((prev) => {
                const nextHabits = prev.map((habit) => habit._id === habitId ? updated : habit)
                cacheHabits(nextHabits)
                return nextHabits
            })
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'habit' } }))
        } catch {
            // Keep the visible state unchanged if the shared account update fails.
        }
    }

    return (
        <Layout>
            <div className="w-full overflow-y-auto">
                <div className="min-h-16 rounded-2xl p-4 md:p-8 bg-pink text-claret w-full transition-all duration-300">
                    <h3 className="text-xl md:text-4xl font-bold uppercase md:mb-4">{greeting}, {nickname}!</h3>
                    <p className="text-lg md:text-2xl">I am so glad to see you. <br className="md:hidden" />What are we doing today?</p>
                </div>

                <MonthlyOverview totalSpent={summary.totalSpent} totalBudgeted={summary.totalBudgeted} totalSavedThisMonth={totalSavedThisMonth} mementosAdded={summary.mementosAdded} weightProgressKg={summary.weightProgressKg} newRecipes={summary.newRecipes} totalSidequests={summary.totalSidequests} />

                <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
                    <h4 className="text-2xl md:text-3xl font-bold uppercase mb-4">Today's Dopamine Hits</h4>
                    {habits.length === 0 ? (
                        <p className="text-lg md:text-xl">No habits yet. Add some in the Dopamine Calendar.</p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {habits.map((habit) => {
                                const doneToday = habit.logs.includes(todayKey())
                                return (
                                    <button
                                        key={habit._id}
                                        type="button"
                                        onClick={() => toggleHabitForToday(habit._id)}
                                        className={`flex items-center justify-between gap-3 rounded-xl border border-claret/30 p-4 text-left transition-all ${doneToday ? "bg-claret text-pink" : "bg-pink text-claret hover:bg-claret hover:text-pink"}`}
                                    >
                                        <span className="text-xl font-bold capitalize">{habit.title}</span>
                                        {doneToday ? <Check className="size-5" /> : <Circle className="size-5" />}
                                    </button>
                                )
                            })}
                        </div>
                    )}
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
