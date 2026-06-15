import Layout from "@/components/Layout";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import {
  createHabit,
  deleteHabit as deleteHabitApi,
  getHabits,
  toggleHabitLog,
  updateHabit,
  type HabitDto,
  type HabitFrequency,
} from "@/lib/api";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { CalendarCheck, Check, Filter, Pencil, Plus, Save, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type HabitFilter = "all" | HabitFrequency;
type ProgressView = "weekly" | "monthly";
type LocalHabit = {
  id: string;
  title: string;
  frequency: HabitFrequency;
  target: number;
  logs: string[];
};
type Habit = HabitDto;

const STORAGE_KEY = "heph_dopamine_calendar";
const MIGRATION_KEY = "heph_dopamine_calendar_server_migrated";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getWeekKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return toDateKey(date);
}

function getWeekEndLabel(dateKey: string) {
  const start = parseDateKey(getWeekKey(dateKey));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end.toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function getDaysInMonth(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getWeeksInMonth(dateKey: string) {
  const date = parseDateKey(dateKey);
  const days = getDaysInMonth(dateKey);
  const weeks = new Set<string>();
  for (let day = 1; day <= days; day += 1) {
    const key = toDateKey(new Date(date.getFullYear(), date.getMonth(), day));
    weeks.add(getWeekKey(key));
  }
  return weeks.size;
}

function getTargetForPeriod(habit: Habit, selectedDate: string, view: ProgressView) {
  if (view === "weekly") {
    if (habit.frequency === "daily") return 7;
    return habit.target;
  }

  if (habit.frequency === "daily") return getDaysInMonth(selectedDate);
  if (habit.frequency === "weekly") return habit.target * getWeeksInMonth(selectedDate);
  return habit.target;
}

function getDoneForPeriod(habit: Habit, selectedDate: string, view: ProgressView) {
  if (view === "weekly") {
    const weekKey = getWeekKey(selectedDate);
    return habit.logs.filter((date) => getWeekKey(date) === weekKey).length;
  }

  const monthKey = getMonthKey(selectedDate);
  return habit.logs.filter((date) => getMonthKey(date) === monthKey).length;
}

function getHabitProgress(habit: Habit, selectedDate: string, view: ProgressView) {
  const target = getTargetForPeriod(habit, selectedDate, view);
  const done = getDoneForPeriod(habit, selectedDate, view);
  return {
    done,
    target,
    percent: target > 0 ? Math.round((done / target) * 100) : 0,
  };
}

function loadCachedHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<LocalHabit | Habit>) : [];
    return parsed.map((habit) => ({
      _id: "_id" in habit ? habit._id : habit.id,
      title: habit.title,
      frequency: habit.frequency,
      target: habit.target,
      logs: habit.logs || [],
    }));
  } catch {
    return [];
  }
}

function cacheHabits(habits: Habit[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      habits.map((habit) => ({
        id: habit._id,
        title: habit.title,
        frequency: habit.frequency,
        target: habit.target,
        logs: habit.logs,
      }))
    )
  );
}

function announceHabitChange() {
  window.dispatchEvent(new CustomEvent("heph:data:changed", { detail: { resource: "habit" } }));
}

export default function DopamineCalendar() {
  const [habits, setHabits] = useState<Habit[]>(loadCachedHabits);
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [target, setTarget] = useState(1);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [filter, setFilter] = useState<HabitFilter>("all");
  const [progressView, setProgressView] = useState<ProgressView>("monthly");
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFrequency, setEditFrequency] = useState<HabitFrequency>("daily");
  const [editTarget, setEditTarget] = useState(1);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadServerHabits() {
      try {
        const remoteHabits = await getHabits();
        if (!mounted) return;

        const cachedHabits = loadCachedHabits();
        const shouldMigrate = !localStorage.getItem(MIGRATION_KEY) && cachedHabits.length > 0;
        if (shouldMigrate) {
          const knownTitles = new Set(remoteHabits.map((habit) => habit.title.trim().toLowerCase()));
          const migrated = await Promise.all(
            cachedHabits
              .filter((habit) => !knownTitles.has(habit.title.trim().toLowerCase()))
              .map((habit) =>
                createHabit({
                  title: habit.title,
                  frequency: habit.frequency,
                  target: habit.frequency === "daily" ? 1 : Math.max(1, habit.target),
                  logs: habit.logs,
                })
              )
          );
          const nextHabits = [...migrated, ...remoteHabits];
          if (!mounted) return;
          setHabits(nextHabits);
          cacheHabits(nextHabits);
          localStorage.setItem(MIGRATION_KEY, "true");
          setSyncError("");
          return;
        }

        setHabits(remoteHabits);
        cacheHabits(remoteHabits);
        localStorage.setItem(MIGRATION_KEY, "true");
        setSyncError("");
      } catch {
        if (!mounted) return;
        setSyncError("Could not sync habits yet. Showing the last habits saved on this device.");
        setHabits(loadCachedHabits());
      }
    }

    loadServerHabits();
    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || detail.resource === "habit") loadServerHabits();
    };
    window.addEventListener("heph:data:changed", handler as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener("heph:data:changed", handler as EventListener);
    };
  }, []);

  const filteredHabits = useMemo(
    () => {
      const order: Record<HabitFrequency, number> = { daily: 0, weekly: 1, monthly: 2 };
      return habits
        .filter((habit) => filter === "all" || habit.frequency === filter)
        .sort((a, b) => filter === "all" ? order[a.frequency] - order[b.frequency] : 0);
    },
    [filter, habits]
  );

  const currentPeriodLabel = useMemo(() => {
    const date = parseDateKey(selectedDate);
    if (progressView === "weekly") return `${parseDateKey(getWeekKey(selectedDate)).toLocaleDateString("en-NG", { month: "long", day: "numeric" })} - ${getWeekEndLabel(selectedDate)}`;
    return date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  }, [progressView, selectedDate]);

  const monthlyOverview = useMemo(() => {
    const progress = filteredHabits.map((habit) => getHabitProgress(habit, selectedDate, "monthly"));
    const done = progress.reduce((sum, item) => sum + item.done, 0);
    const targetTotal = progress.reduce((sum, item) => sum + item.target, 0);
    const completedHabits = progress.filter((item) => item.target > 0 && item.done >= item.target).length;
    const checkIns = filteredHabits.reduce((sum, habit) => sum + getDoneForPeriod(habit, selectedDate, "monthly"), 0);
    return {
      done,
      target: targetTotal,
      checkIns,
      completedHabits,
      percent: targetTotal > 0 ? Math.round((done / targetTotal) * 100) : 0,
    };
  }, [filteredHabits, selectedDate]);

  function resetNewHabitForm() {
    setTitle("");
    setFrequency("daily");
    setTarget(1);
  }

  async function addHabit() {
    const cleanTitle = titleCase(title);
    if (!cleanTitle) return;
    try {
      const created = await createHabit({
        title: cleanTitle,
        frequency,
        target: frequency === "daily" ? 1 : Math.max(1, target),
        logs: [],
      });
      setHabits((prev) => {
        const nextHabits = [created, ...prev];
        cacheHabits(nextHabits);
        return nextHabits;
      });
      resetNewHabitForm();
      setSyncError("");
      announceHabitChange();
    } catch {
      setSyncError("Could not save that habit to your account. Please try again.");
    }
  }

  function openEditHabit(habit: Habit) {
    setEditingHabit(habit);
    setEditTitle(habit.title);
    setEditFrequency(habit.frequency);
    setEditTarget(habit.target);
  }

  async function saveHabitEdit() {
    if (!editingHabit) return;
    const cleanTitle = titleCase(editTitle);
    if (!cleanTitle) return;
    try {
      const updated = await updateHabit(editingHabit._id, {
        title: cleanTitle,
        frequency: editFrequency,
        target: editFrequency === "daily" ? 1 : Math.max(1, editTarget),
      });
      setHabits((prev) => {
        const nextHabits = prev.map((habit) => (habit._id === editingHabit._id ? updated : habit));
        cacheHabits(nextHabits);
        return nextHabits;
      });
      setEditingHabit(null);
      setSyncError("");
      announceHabitChange();
    } catch {
      setSyncError("Could not update that habit. Please try again.");
    }
  }

  async function toggleLog(habitId: string) {
    try {
      const updated = await toggleHabitLog(habitId, selectedDate);
      setHabits((prev) => {
        const nextHabits = prev.map((habit) => (habit._id === habitId ? updated : habit));
        cacheHabits(nextHabits);
        return nextHabits;
      });
      setSyncError("");
      announceHabitChange();
    } catch {
      setSyncError("Could not update that check-in. Please try again.");
    }
  }

  async function deleteHabit(habitId: string) {
    try {
      await deleteHabitApi(habitId);
      setHabits((prev) => {
        const nextHabits = prev.filter((habit) => habit._id !== habitId);
        cacheHabits(nextHabits);
        return nextHabits;
      });
      if (editingHabit?._id === habitId) setEditingHabit(null);
      setDeletingHabit(null);
      setSyncError("");
      announceHabitChange();
    } catch {
      setSyncError("Could not delete that habit. Please try again.");
    }
  }

  return (
    <Layout>
      <section className="w-full">
        <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold uppercase md:text-5xl">Dopamine Calendar</h1>
              <p className="mt-2 text-lg md:text-2xl">Track tiny promises, stack wins, and keep the streaks honest.</p>
            </div>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Tracking Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
              />
            </label>
          </div>
        </div>

        <section className="my-6 rounded-2xl bg-pink p-5 text-claret shadow-xl md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-5" />
              <h2 className="text-2xl font-bold uppercase">Monthly Overview</h2>
            </div>
            <p className="text-sm uppercase tracking-widest">{currentPeriodLabel}</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Follow Through</p>
              <p className="mt-2 text-3xl font-bold">{monthlyOverview.percent}%</p>
            </div>
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Completed Habits</p>
              <p className="mt-2 text-3xl font-bold">{monthlyOverview.completedHabits}</p>
            </div>
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Check Ins</p>
              <p className="mt-2 text-3xl font-bold">{monthlyOverview.checkIns}</p>
            </div>
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Goal Hits</p>
              <p className="mt-2 text-3xl font-bold">{monthlyOverview.done}/{monthlyOverview.target}</p>
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-claret/20">
            <div className="h-full rounded-full bg-claret" style={{ width: `${Math.min(100, monthlyOverview.percent)}%` }} />
          </div>
        </section>

        <section className="my-6 grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addHabit();
            }}
            className="min-h-[340px] self-start rounded-2xl bg-pink p-5 text-claret shadow-xl"
          >
            <h2 className="text-2xl font-bold uppercase">Add Habit</h2>
            {syncError && <p className="mt-3 rounded-xl border border-claret/30 p-3 text-sm">{syncError}</p>}
            <label className="mt-4 block space-y-1">
              <span className="text-sm uppercase tracking-widest">Habit</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2 capitalize" placeholder="e.g. Read 10 Pages" />
            </label>
            <label className="mt-4 block space-y-1">
              <span className="text-sm uppercase tracking-widest">Frequency</span>
              <select value={frequency} onChange={(event) => setFrequency(event.target.value as HabitFrequency)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2 capitalize">
                <option value="daily">Daily</option>
                <option value="weekly">X Times Weekly</option>
                <option value="monthly">X Times Monthly</option>
              </select>
            </label>
            {frequency !== "daily" && (
              <label className="mt-4 block space-y-1">
                <span className="text-sm uppercase tracking-widest">Target Count</span>
                <div className="flex overflow-hidden rounded-xl border border-claret/30">
                  <button type="button" onClick={() => setTarget((value) => Math.max(1, value - 1))} className="w-12 border-r border-claret/30 text-2xl hover:bg-claret hover:text-pink">-</button>
                  <input type="number" min={1} value={target} onChange={(event) => setTarget(Number(event.target.value) || 1)} className="w-full bg-pink px-3 py-2 text-center" />
                  <button type="button" onClick={() => setTarget((value) => value + 1)} className="w-12 border-l border-claret/30 text-2xl hover:bg-claret hover:text-pink">+</button>
                </div>
              </label>
            )}
            <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
              <Plus className="size-4" /> Add Habit
            </button>
          </form>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-pink/20 p-3 text-pink md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-5" />
                <h2 className="text-2xl font-bold uppercase">{progressView === "weekly" ? "Weekly Progress" : "Monthly Progress"}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={filter} onChange={(event) => setFilter(event.target.value as HabitFilter)} className="rounded-xl border border-pink/40 bg-claret px-3 py-2 text-pink">
                  <option value="all">All Habits</option>
                  <option value="daily">Daily Habits</option>
                  <option value="weekly">Weekly Habits</option>
                  <option value="monthly">Monthly Habits</option>
                </select>
                <button type="button" onClick={() => setProgressView("weekly")} className={`inline-flex items-center gap-2 rounded-xl border border-pink/40 px-3 py-2 text-sm uppercase tracking-widest ${progressView === "weekly" ? "bg-pink text-claret" : ""}`}>
                  <Filter className="size-4" /> Weekly
                </button>
                <button type="button" onClick={() => setProgressView("monthly")} className={`rounded-xl border border-pink/40 px-3 py-2 text-sm uppercase tracking-widest ${progressView === "monthly" ? "bg-pink text-claret" : ""}`}>
                  Monthly
                </button>
              </div>
            </div>

            {filteredHabits.length === 0 ? (
              <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl">
                <p className="text-xl">No habits here yet. Add one or change the filter.</p>
              </div>
            ) : (
              filteredHabits.map((habit) => {
                const progress = getHabitProgress(habit, selectedDate, progressView);
                const doneToday = habit.logs.includes(selectedDate);
                return (
                  <article
                    key={habit._id}
                    className="cursor-pointer rounded-2xl bg-pink p-5 text-claret shadow-xl transition-all hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-claret"
                    onClick={() => openEditHabit(habit)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEditHabit(habit);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit ${habit.title}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-bold capitalize">{habit.title}</h3>
                          <Pencil className="size-4 text-claret/70" />
                        </div>
                        <p className="mt-1 text-sm uppercase tracking-widest opacity-80">
                          {habit.frequency === "daily" ? "Daily" : `${habit.target} Times ${titleCase(habit.frequency)}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={(event) => { event.stopPropagation(); toggleLog(habit._id); }} className={`inline-flex items-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest ${doneToday ? "bg-claret text-pink" : "hover:bg-claret hover:text-pink"}`} aria-label="Check in habit" title="Check in habit">
                          <Check className="size-4" />
                        </button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); setDeletingHabit(habit); }} aria-label="Delete habit" title="Delete habit" className="inline-flex items-center justify-center rounded-xl border border-claret px-3 py-2 hover:bg-claret hover:text-pink">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-sm uppercase tracking-widest">
                        <span>{progress.done} / {progress.target}</span>
                        <span>{progress.percent}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-claret/20">
                        <div className="h-full rounded-full bg-claret" style={{ width: `${Math.min(100, progress.percent)}%` }} />
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>

      {editingHabit && (
        <ModalFrame onClose={() => setEditingHabit(null)} shouldConfirmClose={() => editTitle.trim() !== editingHabit.title || editFrequency !== editingHabit.frequency || editTarget !== editingHabit.target}>
          <ModalHead>Edit Habit</ModalHead>
          <ModalBody>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Habit</span>
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2 capitalize" />
            </label>
            <label className="mt-3 block space-y-1">
              <span className="text-sm uppercase tracking-widest">Frequency</span>
              <select value={editFrequency} onChange={(event) => setEditFrequency(event.target.value as HabitFrequency)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2 capitalize">
                <option value="daily">Daily</option>
                <option value="weekly">X Times Weekly</option>
                <option value="monthly">X Times Monthly</option>
              </select>
            </label>
            {editFrequency !== "daily" && (
              <label className="mt-3 block space-y-1">
                <span className="text-sm uppercase tracking-widest">Target Count</span>
                <div className="flex overflow-hidden rounded-xl border border-claret/30">
                  <button type="button" onClick={() => setEditTarget((value) => Math.max(1, value - 1))} className="w-12 border-r border-claret/30 text-2xl hover:bg-claret hover:text-pink">-</button>
                  <input type="number" min={1} value={editTarget} onChange={(event) => setEditTarget(Number(event.target.value) || 1)} className="w-full bg-pink px-3 py-2 text-center" />
                  <button type="button" onClick={() => setEditTarget((value) => value + 1)} className="w-12 border-l border-claret/30 text-2xl hover:bg-claret hover:text-pink">+</button>
                </div>
              </label>
            )}
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setDeletingHabit(editingHabit)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
              <Trash2 className="size-4" /> Delete
            </button>
            <button type="button" onClick={saveHabitEdit} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
              <Save className="size-4" /> Save
            </button>
          </ModalFooter>
        </ModalFrame>
      )}
      <DeleteConfirmationModal
        open={Boolean(deletingHabit)}
        onClose={() => setDeletingHabit(null)}
        itemName={deletingHabit?.title || ""}
        itemType="habit"
        onConfirm={() => {
          if (deletingHabit) deleteHabit(deletingHabit._id);
        }}
      />
    </Layout>
  );
}
