import Layout from "@/components/Layout";
import PaginationControls from "@/components/PaginationControls";
import RecentExpenses from "@/components/RecentExpenses";
import RecentMementos from "@/components/RecentMementos";
import { useToast } from "@/components/Toast";
import { Bell, Check, ChevronLeft, ChevronRight, Circle, Dumbbell, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    createHabit,
    getRecentDashboardExpenses,
    getRecentDashboardMementos,
    getBudgets,
    getBloomPlans,
    getActiveGritChallenge,
    getHabits,
    getRecipes,
    getSidequests,
    getWeights,
    toggleHabitLog,
    updateSidequest,
    type BudgetDto,
    type BloomPlanDto,
    type ExpenseDto,
    type GritDailyLogDto,
    type GritChallengeDto,
    type GritTaskDto,
    type HabitDto,
    type HabitFrequency,
    type MementoDto,
    type SidequestDto,
    type WeightDto,
} from "@/lib/api";

type RecentExpenseItem = {
    _id?: string
    title: string;
    date: string;
    dateKey?: string;
    amount: string;
    category?: string | null;
}
type LocalHabit = { id: string; title: string; frequency: HabitFrequency; target: number; logs: string[]; createdAt?: string; updatedAt?: string }
type UiMilestone = { id: string; title: string; done: boolean; cost?: number }

const HABITS_STORAGE_KEY = "heph_dopamine_calendar"
const HABITS_MIGRATION_KEY = "heph_dopamine_calendar_server_migrated"
const DASHBOARD_HABITS_PER_PAGE = 6
const OVERVIEW_SIDEQUESTS_PER_PAGE = 6

function todayKey() {
    return new Date().toISOString().slice(0, 10)
}

function monthKey(dateKey = todayKey()) {
    return dateKey.slice(0, 7)
}

function parseDateKey(dateKey: string) {
    return new Date(`${dateKey}T00:00:00`)
}

function formatDateKey(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
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

function getGritChallengeEnd(challenge: GritChallengeDto) {
    const date = parseDateKey(challenge.startDate)
    date.setDate(date.getDate() + challenge.durationDays - 1)
    return formatDateKey(date)
}

function getGritLogCheckIns(log: GritDailyLogDto) {
    const checkIns = log.checkIns?.length ? log.checkIns : (log.completedTaskIds || []).map((taskId, index) => ({
        id: `legacy-${log.date}-${taskId}-${index}`,
        taskId,
        createdAt: `${log.date}T00:00:00.000Z`,
    }))
    const seen = new Set<string>()
    return checkIns.filter((checkIn) => {
        if (seen.has(checkIn.taskId)) return false
        seen.add(checkIn.taskId)
        return true
    })
}

function getGritDoneForTask(challenge: GritChallengeDto, task: GritTaskDto, dateKey = todayKey()) {
    const logs = challenge.dailyLogs || []
    if (!task.frequency || task.frequency === "daily") {
        return getGritLogCheckIns(logs.find((log) => log.date === dateKey) || { date: dateKey, completedTaskIds: [] }).filter((checkIn) => checkIn.taskId === task.id).length
    }
    if (task.frequency === "weekly") {
        return logs.filter((log) => getWeekKey(log.date) === getWeekKey(dateKey)).reduce((sum, log) => sum + getGritLogCheckIns(log).filter((checkIn) => checkIn.taskId === task.id).length, 0)
    }
    return logs.filter((log) => monthKey(log.date) === monthKey(dateKey)).reduce((sum, log) => sum + getGritLogCheckIns(log).filter((checkIn) => checkIn.taskId === task.id).length, 0)
}

function getGritTaskTarget(task: GritTaskDto) {
    return !task.frequency || task.frequency === "daily" ? 1 : Math.max(1, task.target)
}

function getGritTaskProgress(challenge: GritChallengeDto, task: GritTaskDto, dateKey = todayKey()) {
    const done = getGritDoneForTask(challenge, task, dateKey)
    const target = getGritTaskTarget(task)
    return {
        done,
        target,
        percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
    }
}

function getGritFrequencyLabel(task: GritTaskDto) {
    if (!task.frequency || task.frequency === "daily") return "Daily"
    return `${task.target} Times ${task.frequency === "weekly" ? "Weekly" : "Monthly"}`
}

function getMetaTotal<T>(items: T[], fallback = items.length) {
    return ((items as T[] & { _meta?: { total?: number } })._meta?.total) ?? fallback
}

function normalizeMilestones(raw: unknown): UiMilestone[] {
    if (!Array.isArray(raw)) return []
    return raw.reduce<UiMilestone[]>((items, item, index) => {
        const milestone = item as Partial<UiMilestone> & { name?: string; text?: string }
        const title = String(milestone?.title ?? milestone?.name ?? milestone?.text ?? '').trim()
        if (!title) return items
        items.push({
            id: String(milestone?.id ?? `ms-${index}-${title}`),
            title,
            done: Boolean(milestone?.done),
            cost: milestone?.cost === undefined ? undefined : Math.max(0, Number(milestone.cost) || 0),
        })
        return items
    }, [])
}

function isCompletedSidequest(sidequest: SidequestDto) {
    const milestones = normalizeMilestones(sidequest.milestones)
    if (milestones.length > 0) return milestones.every((milestone) => milestone.done)
    return Boolean(sidequest.completed)
}

function isOngoingSidequest(sidequest: SidequestDto) {
    if (isCompletedSidequest(sidequest)) return false
    const milestones = normalizeMilestones(sidequest.milestones)
    if (milestones.length === 0) return false
    const done = milestones.filter((milestone) => milestone.done).length
    return done > 0
}

function getSidequestStatus(sidequest: SidequestDto) {
    if (isCompletedSidequest(sidequest)) return "Completed"
    return isOngoingSidequest(sidequest) ? "Ongoing" : "Queued"
}

function getDisplayedCost(sidequest: SidequestDto) {
    const milestones = normalizeMilestones(sidequest.milestones)
    const hasMilestoneCosts = milestones.some((milestone) => milestone.cost !== undefined)
    return hasMilestoneCosts ? milestones.reduce((sum, milestone) => sum + (milestone.cost || 0), 0) : sidequest.cost
}

function getHabitCreatedTime(habit: HabitDto) {
    if (habit.createdAt) {
        const time = new Date(habit.createdAt).getTime()
        if (Number.isFinite(time)) return time
    }

    const objectIdTimestamp = /^[a-f\d]{24}$/i.test(habit._id) ? Number.parseInt(habit._id.slice(0, 8), 16) * 1000 : NaN
    return Number.isFinite(objectIdTimestamp) ? objectIdTimestamp : Number.MAX_SAFE_INTEGER
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
            createdAt: habit.createdAt,
            updatedAt: habit.updatedAt,
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
        createdAt: habit.createdAt,
        updatedAt: habit.updatedAt,
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

    const [recentExpenses, setRecentExpenses] = useState<RecentExpenseItem[]>([])
    const [recentMementos, setRecentMementos] = useState<MementoDto[]>([])
    const [recipesTotal, setRecipesTotal] = useState(0)
    const [weightEntries, setWeightEntries] = useState<WeightDto[]>([])
    const [sidequests, setSidequests] = useState<SidequestDto[]>([])
    const [bloomPlans, setBloomPlans] = useState<BloomPlanDto[]>([])
    const [activeGritChallenge, setActiveGritChallenge] = useState<GritChallengeDto | null>(null)
    const [selectedBloomPlan, setSelectedBloomPlan] = useState<BloomPlanDto | null>(null)
    const [selectedSidequest, setSelectedSidequest] = useState<SidequestDto | null>(null)
    const [overviewSlide, setOverviewSlide] = useState(1)
    const [isOverviewTransitioning, setIsOverviewTransitioning] = useState(true)
    const [overviewTouchStartX, setOverviewTouchStartX] = useState<number | null>(null)
    const [sidequestOverviewPage, setSidequestOverviewPage] = useState(1)
    const [habits, setHabits] = useState<HabitDto[]>([])
    const [habitsPage, setHabitsPage] = useState(1)

    useEffect(() => {
        let mounted = true
        async function load() {
            getSyncedHabits()
                .then((items) => {
                    if (mounted) setHabits(items)
                })
                .catch(() => {
                    if (mounted) setHabits(loadCachedHabits())
                })

            Promise.all([
                getRecentDashboardExpenses(10),
                getBudgets().catch(() => [] as BudgetDto[]),
            ])
                .then(([expenses, budgets]) => {
                    if (!mounted) return
                    const map = new Map<string, string>()
                    budgets.forEach((b: BudgetDto) => map.set(b._id, b.name))
                    setRecentExpenses(expenses.map((e: ExpenseDto) => ({
                        _id: e._id,
                        title: e.title,
                        date: new Date(e.expenseDate).toLocaleDateString(),
                        dateKey: e.expenseDate.slice(0, 10),
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
                getBloomPlans(todayKey(), formatDateKey(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))).catch(() => [] as BloomPlanDto[]),
                getActiveGritChallenge().catch(() => null),
            ]).then(([recipes, weights, sidequestItems, bloomItems, gritChallenge]) => {
                if (!mounted) return
                setRecipesTotal(getMetaTotal(recipes, recipes.length))
                setWeightEntries(weights)
                setSidequests(sidequestItems)
                setBloomPlans(bloomItems)
                setActiveGritChallenge(gritChallenge)
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
            window.addEventListener('heph:bloom:changed', handler as EventListener)
            window.addEventListener('heph:grit:changed', handler as EventListener)
                return () => { mounted = false; window.removeEventListener('heph:expense:created', handler as EventListener); window.removeEventListener('heph:data:changed', dataHandler as EventListener); window.removeEventListener('heph:bloom:changed', handler as EventListener); window.removeEventListener('heph:grit:changed', handler as EventListener) }
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

    async function toggleSelectedSidequestMilestone(milestoneId: string) {
        if (!selectedSidequest) return
        const previousSidequests = sidequests
        const previousSelected = selectedSidequest
        const milestones = normalizeMilestones(selectedSidequest.milestones)
        const nextMilestones = milestones.map((milestone) => milestone.id === milestoneId ? { ...milestone, done: !milestone.done } : milestone)
        const completed = nextMilestones.length > 0 ? nextMilestones.every((milestone) => milestone.done) : selectedSidequest.completed
        const nextSelected = { ...selectedSidequest, milestones: nextMilestones, completed }

        setSelectedSidequest(nextSelected)
        setSidequests((current) => current.map((sidequest) => sidequest._id === nextSelected._id ? nextSelected : sidequest))

        try {
            const updated = await updateSidequest(selectedSidequest._id, { milestones: nextMilestones })
            setSelectedSidequest((current) => current?._id === updated._id ? updated : current)
            setSidequests((current) => current.map((sidequest) => sidequest._id === updated._id ? updated : sidequest))
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'sidequest' } }))
        } catch {
            setSelectedSidequest(previousSelected)
            setSidequests(previousSidequests)
            toast.push({ type: "error", message: "Could not update milestone." })
        }
    }

    async function toggleSelectedSidequestComplete() {
        if (!selectedSidequest || normalizeMilestones(selectedSidequest.milestones).length > 0) return
        const previousSidequests = sidequests
        const previousSelected = selectedSidequest
        const completed = !isCompletedSidequest(selectedSidequest)
        const nextSelected = { ...selectedSidequest, completed }

        setSelectedSidequest(nextSelected)
        setSidequests((current) => current.map((sidequest) => sidequest._id === nextSelected._id ? nextSelected : sidequest))

        try {
            const updated = await updateSidequest(selectedSidequest._id, { completed })
            setSelectedSidequest((current) => current?._id === updated._id ? updated : current)
            setSidequests((current) => current.map((sidequest) => sidequest._id === updated._id ? updated : sidequest))
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'sidequest' } }))
            toast.push({ type: "success", message: completed ? "Sidequest completed." : "Sidequest reopened." })
        } catch {
            setSelectedSidequest(previousSelected)
            setSidequests(previousSidequests)
            toast.push({ type: "error", message: "Could not update sidequest." })
        }
    }

    const sortedHabits = useMemo(() => {
        const order: Record<HabitFrequency, number> = { daily: 0, weekly: 1, monthly: 2 }
        return habits
            .map((habit, index) => ({ habit, index }))
            .sort((a, b) => (
                order[a.habit.frequency] - order[b.habit.frequency] ||
                getHabitCreatedTime(a.habit) - getHabitCreatedTime(b.habit) ||
                a.index - b.index
            ))
            .map(({ habit }) => habit)
    }, [habits])

    const habitsTotalPages = Math.max(1, Math.ceil(sortedHabits.length / DASHBOARD_HABITS_PER_PAGE))
    const safeHabitsPage = Math.min(habitsPage, habitsTotalPages)
    const paginatedHabits = sortedHabits.slice((safeHabitsPage - 1) * DASHBOARD_HABITS_PER_PAGE, safeHabitsPage * DASHBOARD_HABITS_PER_PAGE)

    useEffect(() => {
        setHabitsPage((page) => Math.min(page, habitsTotalPages))
    }, [habitsTotalPages])

    const overviewStats = useMemo(() => {
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
        const queuedSidequests = sidequests.filter((sidequest) => getSidequestStatus(sidequest) === "Queued")
        const completedSidequests = sidequests.filter(isCompletedSidequest)
        const upcomingBloomPlans = [...bloomPlans].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
        const activeGritTasks = activeGritChallenge?.tasks || []
        const todayGritProgress = activeGritChallenge
            ? activeGritTasks.map((task) => ({ task, progress: getGritTaskProgress(activeGritChallenge, task) }))
            : []
        const todayGritDone = todayGritProgress.reduce((sum, item) => sum + item.progress.done, 0)
        const todayGritTarget = todayGritProgress.reduce((sum, item) => sum + item.progress.target, 0)
        const todayGritPercent = todayGritTarget > 0 ? Math.min(100, Math.round((todayGritDone / todayGritTarget) * 100)) : 0
        const sortedWeights = [...weightEntries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
        const firstWeight = sortedWeights[0]?.weightKg ?? 0
        const latestWeight = sortedWeights[sortedWeights.length - 1]?.weightKg ?? firstWeight
        const weightDelta = Number((latestWeight - firstWeight).toFixed(1))

        return {
            monthlyHabitDone,
            monthlyHabitTarget,
            monthlyHabitPercent: monthlyHabitTarget > 0 ? Math.round((monthlyHabitDone / monthlyHabitTarget) * 100) : 0,
            monthlyHitHabits,
            ongoingSidequests,
            queuedSidequests,
            completedSidequests,
            upcomingBloomPlans,
            activeGritTasks,
            todayGritProgress,
            todayGritDone,
            todayGritTarget,
            todayGritPercent,
            sortedWeights,
            weightDelta,
        }
    }, [activeGritChallenge, bloomPlans, habits, sidequests, weightEntries])

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

    const sidequestOverviewTotalPages = Math.max(1, Math.ceil(sidequests.length / OVERVIEW_SIDEQUESTS_PER_PAGE))
    const safeSidequestOverviewPage = Math.min(sidequestOverviewPage, sidequestOverviewTotalPages)
    const overviewSidequests = sidequests.slice((safeSidequestOverviewPage - 1) * OVERVIEW_SIDEQUESTS_PER_PAGE, safeSidequestOverviewPage * OVERVIEW_SIDEQUESTS_PER_PAGE)

    useEffect(() => {
        setSidequestOverviewPage((page) => Math.min(page, sidequestOverviewTotalPages))
    }, [sidequestOverviewTotalPages])

    const overviewSlides = [
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
                            <div className="hide-scrollbar mt-2 grid max-h-40 gap-2 overflow-y-auto pr-2 md:grid-cols-4">
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
            title: "Bloom",
            to: "/bloom",
            content: (
                <>
                    <div className="flex items-center gap-2">
                        <Bell className="size-5" />
                        <p className="text-sm uppercase tracking-widest opacity-75">Upcoming Plans</p>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {overviewStats.upcomingBloomPlans.length > 0 ? overviewStats.upcomingBloomPlans.map((plan) => (
                            <button
                                key={plan._id}
                                type="button"
                                onClick={() => setSelectedBloomPlan(plan)}
                                className="rounded-xl border border-claret/20 p-3 text-left transition-colors hover:bg-claret hover:text-pink"
                            >
                                <span className="flex items-start gap-3">
                                    <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: plan.color }} />
                                    <span>
                                        <span className="block text-sm uppercase tracking-widest opacity-75">
                                            {parseDateKey(plan.date).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}
                                        </span>
                                        <span className="mt-1 block text-xl font-bold leading-tight">{plan.title}</span>
                                    </span>
                                </span>
                            </button>
                        )) : (
                            <p className="rounded-xl border border-dashed border-claret/30 p-4 text-lg">No upcoming Bloom plans.</p>
                        )}
                    </div>
                </>
            ),
        },
        {
            title: "Grit",
            to: "/grit",
            content: (
                activeGritChallenge ? (
                    <>
                        <div className="flex items-center gap-2">
                            <Dumbbell className="size-5" />
                            <p className="text-sm uppercase tracking-widest opacity-75">Active Challenge</p>
                        </div>
                        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-3xl font-bold leading-tight">{activeGritChallenge.title}</p>
                                <p className="mt-1 text-sm uppercase tracking-widest opacity-75">
                                    {parseDateKey(activeGritChallenge.startDate).toLocaleDateString("en-NG", { month: "short", day: "numeric" })} - {parseDateKey(getGritChallengeEnd(activeGritChallenge)).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                                </p>
                            </div>
                            <Link to="/grit" className="rounded-xl border border-claret px-3 py-2 text-center text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
                                Open Grit
                            </Link>
                        </div>
                        <div className="mt-5 h-4 overflow-hidden rounded-full bg-claret/20">
                            <div className="h-full rounded-full bg-claret" style={{ width: `${overviewStats.todayGritPercent}%` }} />
                        </div>
                        <p className="mt-3 text-sm uppercase tracking-widest opacity-75">{overviewStats.todayGritDone} / {overviewStats.todayGritTarget} checks due now</p>
                        <div className="mt-5 grid gap-2 md:grid-cols-3">
                            {overviewStats.todayGritProgress.slice(0, 6).map(({ task, progress }) => (
                                <div key={task.id} className="rounded-xl border border-claret/20 px-3 py-2">
                                    <p className="font-bold leading-tight">{task.title}</p>
                                    <p className="mt-1 text-xs uppercase tracking-widest opacity-75">{getGritFrequencyLabel(task)} - {progress.done}/{progress.target}</p>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-claret/30 p-4">
                        <p className="text-xl">No active Grit challenge yet.</p>
                        <Link to="/grit" className="mt-3 inline-flex rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
                            Create Challenge
                        </Link>
                    </div>
                )
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
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {[
                            ["Total", sidequests.length],
                            ["Ongoing", sidequests.filter(isOngoingSidequest).length],
                            ["Queued", overviewStats.queuedSidequests.length],
                            ["Completed", overviewStats.completedSidequests.length],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-claret/20 p-3">
                                <p className="text-xs uppercase tracking-widest opacity-75">{label}</p>
                                <p className="mt-1 text-3xl font-bold">{value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="hide-scrollbar mt-4 max-h-64 overflow-y-auto pr-1">
                        <div className="grid gap-2 md:grid-cols-2">
                            {overviewSidequests.length > 0 ? overviewSidequests.map((sidequest) => (
                                <button
                                    key={sidequest._id}
                                    type="button"
                                    onClick={() => setSelectedSidequest(sidequest)}
                                    className="rounded-xl border border-claret/20 p-3 text-left transition-colors hover:bg-claret hover:text-pink group"
                                >
                                    <div className="flex flex-col justify-center gap-2">
                                        <div className="flex gap-1 items-baseline">
                                            <span className="block text-xl font-bold leading-tight">{sidequest.title}</span>
                                            <span className="uppercase tracking-widest text-xs opacity-75">({getSidequestStatus(sidequest)})</span> 
                                        </div>
                                        
                                        <span className="p-1 bg-claret group-hover:bg-pink text-pink group-hover:text-claret text-xs w-fit">COST: {getDisplayedCost(sidequest)}</span> 
                                    </div>
                                   
                                    

                                    
                                </button>
                            )) : <p className="text-lg">No sidequests yet.</p>}
                        </div>
                    </div>
                    <PaginationControls
                        page={safeSidequestOverviewPage}
                        totalPages={sidequestOverviewTotalPages}
                        onPageChange={setSidequestOverviewPage}
                        label="Sidequests"
                    />
                </>
            ),
        },
    ]

    const overviewCarouselSlides = overviewSlides.length ? [overviewSlides[overviewSlides.length - 1], ...overviewSlides, overviewSlides[0]] : []
    const safeOverviewSlide = overviewSlides.length ? (overviewSlide - 1 + overviewSlides.length) % overviewSlides.length : 0
    const goToPreviousOverview = () => {
        setIsOverviewTransitioning(true)
        setOverviewSlide((slide) => slide - 1)
    }
    const goToNextOverview = () => {
        setIsOverviewTransitioning(true)
        setOverviewSlide((slide) => slide + 1)
    }
    const finishOverviewTransition = () => {
        if (!overviewSlides.length) return
        if (overviewSlide === 0) {
            setIsOverviewTransitioning(false)
            setOverviewSlide(overviewSlides.length)
            window.setTimeout(() => setIsOverviewTransitioning(true), 20)
        }
        if (overviewSlide === overviewSlides.length + 1) {
            setIsOverviewTransitioning(false)
            setOverviewSlide(1)
            window.setTimeout(() => setIsOverviewTransitioning(true), 20)
        }
    }

    return (
        <Layout>
            <div className="w-full overflow-y-auto">
                <div className="min-h-16 rounded-2xl p-4 md:p-8 bg-pink text-claret w-full transition-all duration-300">
                    <h3 className="text-xl md:text-4xl font-bold uppercase md:mb-4">{greeting}, {nickname}!</h3>
                    <p className="text-lg md:text-2xl">I am so glad to see you!</p>
                </div>

                <section className="my-6 rounded-2xl bg-pink p-4 text-claret shadow-xl md:p-8">
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
                        <div
                            className={`flex w-full ${isOverviewTransitioning ? "transition-transform duration-300 ease-out" : ""}`}
                            style={{ transform: `translateX(-${overviewSlide * 100}%)` }}
                            onTransitionEnd={finishOverviewTransition}
                        >
                            {overviewCarouselSlides.map((slide, index) => (
                                <article key={`${slide.title}-${index}`} className="hide-scrollbar max-h-[22rem] w-full min-w-0 flex-none basis-full overflow-y-auto overflow-x-hidden pr-1 md:max-h-none md:overflow-visible md:pr-0">
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
            {selectedBloomPlan ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-claret/60 p-4"
                    onClick={() => setSelectedBloomPlan(null)}
                >
                    <article
                        className="w-full max-w-md rounded-2xl border border-claret/20 bg-pink p-6 text-claret shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-sm uppercase tracking-widest opacity-75">
                                    {parseDateKey(selectedBloomPlan.date).toLocaleDateString("en-NG", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: selectedBloomPlan.color }} />
                                    <h4 className="text-2xl font-bold leading-tight">{selectedBloomPlan.title}</h4>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedBloomPlan(null)}
                                aria-label="Close Bloom plan details"
                                title="Close"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        {selectedBloomPlan.notes ? (
                            <p className="mt-4 whitespace-pre-wrap text-base tracking-normal opacity-85">{selectedBloomPlan.notes}</p>
                        ) : (
                            <p className="mt-4 text-base opacity-75">No notes added.</p>
                        )}
                    </article>
                </div>
            ) : null}
            {selectedSidequest ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-claret/60 p-4"
                    onClick={() => setSelectedSidequest(null)}
                >
                    <article
                        className="hide-scrollbar max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-claret/20 bg-pink p-6 text-claret shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-widest opacity-75">{getSidequestStatus(selectedSidequest)}</p>
                                <h4 className="mt-1 text-2xl font-bold leading-tight">{selectedSidequest.title}</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedSidequest(null)}
                                aria-label="Close sidequest details"
                                title="Close"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <p className="mt-4 text-lg tracking-normal">{selectedSidequest.description}</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-claret/20 p-3">
                                <p className="text-xs uppercase tracking-widest opacity-75">Cost</p>
                                <p className="mt-1 text-2xl font-bold">{getDisplayedCost(selectedSidequest)}</p>
                            </div>
                            <div className="rounded-xl border border-claret/20 p-3">
                                <p className="text-xs uppercase tracking-widest opacity-75">Created</p>
                                <p className="mt-1 text-lg font-bold">{selectedSidequest.createdAt ? new Date(selectedSidequest.createdAt).toLocaleDateString() : "Unknown"}</p>
                            </div>
                        </div>
                        {normalizeMilestones(selectedSidequest.milestones).length ? (
                            <div className="mt-4">
                                <p className="text-sm uppercase tracking-widest opacity-75">Milestones</p>
                                <div className="mt-2 space-y-2">
                                    {normalizeMilestones(selectedSidequest.milestones).map((milestone) => (
                                        <button
                                            key={milestone.id}
                                            type="button"
                                            onClick={() => toggleSelectedSidequestMilestone(milestone.id)}
                                            className="flex w-full items-start gap-3 rounded-xl border border-claret/20 p-3 text-left transition-colors hover:bg-claret hover:text-pink"
                                        >
                                            <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${milestone.done ? "border-claret bg-claret text-pink" : "border-current"}`}>
                                                {milestone.done ? <Check className="size-4" /> : null}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className={`block ${milestone.done ? "line-through opacity-60" : ""}`}>{milestone.title}</span>
                                                {milestone.cost !== undefined ? <span className="mt-1 block text-xs uppercase tracking-widest opacity-75">Cost {milestone.cost.toLocaleString()}</span> : null}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <p className="text-sm uppercase tracking-widest opacity-75">Completion</p>
                                <button
                                    type="button"
                                    onClick={toggleSelectedSidequestComplete}
                                    className="mt-2 flex w-full items-start gap-3 rounded-xl border border-claret/20 p-3 text-left transition-colors hover:bg-claret hover:text-pink"
                                >
                                    <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${isCompletedSidequest(selectedSidequest) ? "border-claret bg-claret text-pink" : "border-current"}`}>
                                        {isCompletedSidequest(selectedSidequest) ? <Check className="size-4" /> : null}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold">{isCompletedSidequest(selectedSidequest) ? "Completed" : "Mark as completed"}</span>
                                        <span className="mt-1 block text-xs uppercase tracking-widest opacity-75">{isCompletedSidequest(selectedSidequest) ? "Tap to reopen this sidequest" : "No milestones on this one"}</span>
                                    </span>
                                </button>
                            </div>
                        )}
                    </article>
                </div>
            ) : null}
        </Layout>
    )
}
