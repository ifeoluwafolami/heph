import Layout from "@/components/Layout";
import CustomDateInput from "@/components/CustomDateInput";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  createGoal,
  createHabit,
  deleteGoal as deleteGoalApi,
  deleteHabit as deleteHabitApi,
  getGoals,
  getHabits,
  toggleHabitLog,
  updateGoal,
  updateHabit,
  type GoalDto,
  type GoalStatus,
  type HabitDto,
  type HabitFrequency,
} from "@/lib/api";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { CalendarCheck, Check, ChevronDown, Circle, Flag, MoreVertical, Pencil, Plus, Save, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ProgressView = "weekly" | "monthly";
type GoalFilter = "all" | GoalStatus;
type DeletingItem = { type: "goal"; item: GoalDto } | { type: "step"; item: HabitDto } | null;
type GoalStepDraft = { id: string; title: string; frequency: HabitFrequency; target: number };
type LocalHabit = {
  id: string;
  goalId?: string | null;
  title: string;
  frequency: HabitFrequency;
  target: number;
  logs: string[];
};

const HABITS_STORAGE_KEY = "heph_dopamine_calendar";
const HABITS_MIGRATION_KEY = "heph_dopamine_calendar_server_migrated";
const GOALS_STORAGE_KEY = "heph_dopamine_goals";

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

function monthToDateKey(month: string) {
  return `${month}-01`;
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
    weeks.add(getWeekKey(toDateKey(new Date(date.getFullYear(), date.getMonth(), day))));
  }
  return weeks.size;
}

function getTargetForPeriod(step: HabitDto, selectedDate: string, view: ProgressView) {
  if (view === "weekly") {
    if (step.frequency === "daily") return 7;
    return Math.max(1, step.target);
  }

  if (step.frequency === "daily") return getDaysInMonth(selectedDate);
  if (step.frequency === "weekly") return Math.max(1, step.target) * getWeeksInMonth(selectedDate);
  return Math.max(1, step.target);
}

function getDoneForPeriod(step: HabitDto, selectedDate: string, view: ProgressView) {
  if (view === "weekly") {
    const weekKey = getWeekKey(selectedDate);
    return (step.logs || []).filter((date) => getWeekKey(date) === weekKey).length;
  }

  const monthKey = getMonthKey(selectedDate);
  return (step.logs || []).filter((date) => getMonthKey(date) === monthKey).length;
}

function getStepProgress(step: HabitDto, selectedDate: string, view: ProgressView) {
  const target = getTargetForPeriod(step, selectedDate, view);
  const done = getDoneForPeriod(step, selectedDate, view);
  return {
    done,
    target,
    percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
  };
}

function getFrequencyLabel(step: HabitDto) {
  if (step.frequency === "daily") return "Daily";
  if (step.frequency === "weekly") return `${step.target}x Weekly`;
  return `${step.target}x Monthly`;
}

function loadCachedHabits(): HabitDto[] {
  try {
    const raw = localStorage.getItem(HABITS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<LocalHabit | HabitDto>) : [];
    return parsed.map((step) => ({
      _id: "_id" in step ? step._id : step.id,
      goalId: "goalId" in step ? step.goalId ?? null : null,
      title: step.title,
      frequency: step.frequency,
      target: step.target,
      logs: step.logs || [],
    }));
  } catch {
    return [];
  }
}

function cacheHabits(steps: HabitDto[]) {
  localStorage.setItem(
    HABITS_STORAGE_KEY,
    JSON.stringify(
      steps.map((step) => ({
        id: step._id,
        goalId: step.goalId ?? null,
        title: step.title,
        frequency: step.frequency,
        target: step.target,
        logs: step.logs,
      }))
    )
  );
}

function loadCachedGoals(): GoalDto[] {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoalDto[]) : [];
  } catch {
    return [];
  }
}

function cacheGoals(goals: GoalDto[]) {
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

function announceDopamineChange() {
  window.dispatchEvent(new CustomEvent("heph:data:changed", { detail: { resource: "habit" } }));
}

function createGoalStepDraft(): GoalStepDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    frequency: "daily",
    target: 1,
  };
}

function shouldIgnoreGoalToggle(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, label"));
}

export default function DopamineCalendar() {
  const toast = useToast();
  const [goals, setGoals] = useState<GoalDto[]>(loadCachedGoals);
  const [steps, setSteps] = useState<HabitDto[]>(loadCachedHabits);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [progressView, setProgressView] = useState<ProgressView>("monthly");
  const [goalFilter, setGoalFilter] = useState<GoalFilter>("active");
  const [syncError, setSyncError] = useState("");
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isNewStepOpen, setIsNewStepOpen] = useState(false);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(() => new Set());
  const [openGoalMenuId, setOpenGoalMenuId] = useState<string | null>(null);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [newGoalSteps, setNewGoalSteps] = useState<GoalStepDraft[]>([]);

  const [stepTitle, setStepTitle] = useState("");
  const [stepGoalId, setStepGoalId] = useState("");
  const [stepFrequency, setStepFrequency] = useState<HabitFrequency>("daily");
  const [stepTarget, setStepTarget] = useState(1);

  const [editingGoal, setEditingGoal] = useState<GoalDto | null>(null);
  const [editGoalTitle, setEditGoalTitle] = useState("");
  const [editGoalDescription, setEditGoalDescription] = useState("");
  const [editGoalStatus, setEditGoalStatus] = useState<GoalStatus>("active");
  const [editGoalTargetDate, setEditGoalTargetDate] = useState("");

  const [editingStep, setEditingStep] = useState<HabitDto | null>(null);
  const [editStepTitle, setEditStepTitle] = useState("");
  const [editStepGoalId, setEditStepGoalId] = useState("");
  const [editStepFrequency, setEditStepFrequency] = useState<HabitFrequency>("daily");
  const [editStepTarget, setEditStepTarget] = useState(1);
  const [deletingItem, setDeletingItem] = useState<DeletingItem>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDopamine() {
      try {
        const [remoteGoals, remoteSteps] = await Promise.all([getGoals(), getHabits()]);
        if (!mounted) return;

        const cachedSteps = loadCachedHabits();
        const shouldMigrate = !localStorage.getItem(HABITS_MIGRATION_KEY) && cachedSteps.length > 0;
        if (shouldMigrate) {
          const knownTitles = new Set(remoteSteps.map((step) => step.title.trim().toLowerCase()));
          const migrated = await Promise.all(
            cachedSteps
              .filter((step) => !knownTitles.has(step.title.trim().toLowerCase()))
              .map((step) =>
                createHabit({
                  title: step.title,
                  frequency: step.frequency,
                  target: step.frequency === "daily" ? 1 : Math.max(1, step.target),
                  goalId: step.goalId ?? null,
                  logs: step.logs,
                })
              )
          );
          const nextSteps = [...migrated, ...remoteSteps];
          if (!mounted) return;
          setGoals(remoteGoals);
          setSteps(nextSteps);
          cacheGoals(remoteGoals);
          cacheHabits(nextSteps);
          localStorage.setItem(HABITS_MIGRATION_KEY, "true");
          setSyncError("");
          return;
        }

        setGoals(remoteGoals);
        setSteps(remoteSteps);
        cacheGoals(remoteGoals);
        cacheHabits(remoteSteps);
        localStorage.setItem(HABITS_MIGRATION_KEY, "true");
        setSyncError("");
      } catch {
        if (!mounted) return;
        setGoals(loadCachedGoals());
        setSteps(loadCachedHabits());
        setSyncError("Could not sync Dopamine yet. Showing the last tracker saved on this device.");
      }
    }

    loadDopamine();
    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || detail.resource === "habit") loadDopamine();
    };
    window.addEventListener("heph:data:changed", handler as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener("heph:data:changed", handler as EventListener);
    };
  }, []);

  const currentPeriodLabel = useMemo(() => {
    const date = parseDateKey(selectedDate);
    if (progressView === "weekly") return `${parseDateKey(getWeekKey(selectedDate)).toLocaleDateString("en-NG", { month: "long", day: "numeric" })} - ${getWeekEndLabel(selectedDate)}`;
    return date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  }, [progressView, selectedDate]);

  const goalsToRender = useMemo(() => {
    const base = goalFilter === "all" ? goals : goals.filter((goal) => goal.status === goalFilter);
    const targetTime = (goal: GoalDto) => goal.targetDate ? parseDateKey(goal.targetDate).getTime() : Number.POSITIVE_INFINITY;
    return [...base].sort((a, b) => {
      const statusOrder: Record<GoalStatus, number> = { active: 0, paused: 1, completed: 2 };
      return targetTime(a) - targetTime(b) || statusOrder[a.status] - statusOrder[b.status] || a.title.localeCompare(b.title);
    });
  }, [goalFilter, goals]);

  const unassignedSteps = useMemo(() => steps.filter((step) => !step.goalId || !goals.some((goal) => goal._id === step.goalId)), [goals, steps]);

  const overview = useMemo(() => {
    const progress = steps.map((step) => getStepProgress(step, selectedDate, progressView));
    const done = progress.reduce((sum, item) => sum + item.done, 0);
    const target = progress.reduce((sum, item) => sum + item.target, 0);
    const completedSteps = progress.filter((item) => item.target > 0 && item.done >= item.target).length;
    const activeGoals = goals.filter((goal) => goal.status === "active").length;
    return {
      done,
      target,
      completedSteps,
      activeGoals,
      percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
    };
  }, [goals, progressView, selectedDate, steps]);

  function resetGoalForm() {
    setGoalTitle("");
    setGoalDescription("");
    setGoalTargetDate("");
    setNewGoalSteps([]);
  }

  function resetStepForm() {
    setStepTitle("");
    setStepGoalId("");
    setStepFrequency("daily");
    setStepTarget(1);
  }

  function closeNewGoalModal() {
    setIsNewGoalOpen(false);
    resetGoalForm();
  }

  function closeNewStepModal() {
    setIsNewStepOpen(false);
    resetStepForm();
  }

  function openNewGoalModal() {
    resetGoalForm();
    setNewGoalSteps([createGoalStepDraft()]);
    setIsNewGoalOpen(true);
  }

  function updateGoalStepDraft(id: string, update: Partial<GoalStepDraft>) {
    setNewGoalSteps((drafts) => drafts.map((draft) => (draft.id === id ? { ...draft, ...update } : draft)));
  }

  function addGoalStepDraft() {
    setNewGoalSteps((drafts) => [...drafts, createGoalStepDraft()]);
  }

  function removeGoalStepDraft(id: string) {
    setNewGoalSteps((drafts) => drafts.filter((draft) => draft.id !== id));
  }

  function toggleGoalExpanded(goalId: string) {
    setOpenGoalMenuId(null);
    setExpandedGoalIds((current) => {
      const next = new Set(current);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }

  async function addGoal() {
    const title = goalTitle.trim();
    if (!title) return;
    const stepDrafts = newGoalSteps
      .map((draft) => ({
        title: draft.title.trim(),
        frequency: draft.frequency,
        target: draft.frequency === "daily" ? 1 : Math.max(1, draft.target),
      }))
      .filter((draft) => draft.title);
    try {
      const created = await createGoal({
        title,
        description: goalDescription.trim(),
        targetDate: goalTargetDate,
      });
      const createdSteps = await Promise.all(
        stepDrafts.map((draft) =>
          createHabit({
            title: draft.title,
            frequency: draft.frequency,
            target: draft.target,
            goalId: created._id,
            logs: [],
          })
        )
      );
      setGoals((prev) => {
        const next = [created, ...prev];
        cacheGoals(next);
        return next;
      });
      if (createdSteps.length) {
        setSteps((prev) => {
          const next = [...createdSteps, ...prev];
          cacheHabits(next);
          return next;
        });
      }
      resetGoalForm();
      setIsNewGoalOpen(false);
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: createdSteps.length ? "Goal and steps added." : "Goal added." });
    } catch {
      setSyncError("Could not save that goal. Please try again.");
      toast.push({ type: "error", message: "Could not save that goal." });
    }
  }

  async function addStep() {
    const title = stepTitle.trim();
    if (!title) return;
    try {
      const created = await createHabit({
        title,
        frequency: stepFrequency,
        target: stepFrequency === "daily" ? 1 : Math.max(1, stepTarget),
        goalId: stepGoalId || null,
        logs: [],
      });
      setSteps((prev) => {
        const next = [created, ...prev];
        cacheHabits(next);
        return next;
      });
      resetStepForm();
      setIsNewStepOpen(false);
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: "Step added." });
    } catch {
      setSyncError("Could not save that step. Please try again.");
      toast.push({ type: "error", message: "Could not save that step." });
    }
  }

  function openGoalEdit(goal: GoalDto) {
    setEditingGoal(goal);
    setEditGoalTitle(goal.title);
    setEditGoalDescription(goal.description || "");
    setEditGoalStatus(goal.status);
    setEditGoalTargetDate(goal.targetDate || "");
  }

  async function saveGoalEdit() {
    if (!editingGoal) return;
    const title = editGoalTitle.trim();
    if (!title) return;
    try {
      const updated = await updateGoal(editingGoal._id, {
        title,
        description: editGoalDescription.trim(),
        status: editGoalStatus,
        targetDate: editGoalTargetDate,
      });
      setGoals((prev) => {
        const next = prev.map((goal) => (goal._id === updated._id ? updated : goal));
        cacheGoals(next);
        return next;
      });
      setEditingGoal(null);
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: "Goal updated." });
    } catch {
      setSyncError("Could not update that goal. Please try again.");
      toast.push({ type: "error", message: "Could not update that goal." });
    }
  }

  function openStepEdit(step: HabitDto) {
    setEditingStep(step);
    setEditStepTitle(step.title);
    setEditStepGoalId(step.goalId || "");
    setEditStepFrequency(step.frequency);
    setEditStepTarget(step.target);
  }

  async function saveStepEdit() {
    if (!editingStep) return;
    const title = editStepTitle.trim();
    if (!title) return;
    try {
      const updated = await updateHabit(editingStep._id, {
        title,
        frequency: editStepFrequency,
        target: editStepFrequency === "daily" ? 1 : Math.max(1, editStepTarget),
        goalId: editStepGoalId || null,
      });
      setSteps((prev) => {
        const next = prev.map((step) => (step._id === updated._id ? updated : step));
        cacheHabits(next);
        return next;
      });
      setEditingStep(null);
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: "Step updated." });
    } catch {
      setSyncError("Could not update that step. Please try again.");
      toast.push({ type: "error", message: "Could not update that step." });
    }
  }

  async function toggleStep(stepId: string) {
    try {
      const updated = await toggleHabitLog(stepId, selectedDate);
      const checkedIn = updated.logs.includes(selectedDate);
      setSteps((prev) => {
        const next = prev.map((step) => (step._id === stepId ? updated : step));
        cacheHabits(next);
        return next;
      });
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: checkedIn ? "Step checked in." : "Check-in removed." });
    } catch {
      setSyncError("Could not update that check-in. Please try again.");
      toast.push({ type: "error", message: "Could not update that check-in." });
    }
  }

  async function deleteGoal(goal: GoalDto) {
    try {
      await deleteGoalApi(goal._id);
      setGoals((prev) => {
        const next = prev.filter((item) => item._id !== goal._id);
        cacheGoals(next);
        return next;
      });
      setSteps((prev) => {
        const next = prev.map((step) => (step.goalId === goal._id ? { ...step, goalId: null } : step));
        cacheHabits(next);
        return next;
      });
      if (editingGoal?._id === goal._id) setEditingGoal(null);
      setDeletingItem(null);
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: "Goal deleted." });
    } catch {
      setSyncError("Could not delete that goal. Please try again.");
      toast.push({ type: "error", message: "Could not delete that goal." });
    }
  }

  async function deleteStep(step: HabitDto) {
    try {
      await deleteHabitApi(step._id);
      setSteps((prev) => {
        const next = prev.filter((item) => item._id !== step._id);
        cacheHabits(next);
        return next;
      });
      if (editingStep?._id === step._id) setEditingStep(null);
      setDeletingItem(null);
      setSyncError("");
      announceDopamineChange();
      toast.push({ type: "success", message: "Step deleted." });
    } catch {
      setSyncError("Could not delete that step. Please try again.");
      toast.push({ type: "error", message: "Could not delete that step." });
    }
  }

  function renderStep(step: HabitDto) {
    const progress = getStepProgress(step, selectedDate, progressView);
    const doneToday = step.logs.includes(selectedDate);
    return (
      <article key={step._id} className="rounded-xl border border-claret/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {doneToday ? <Check className="size-5 md:size-4" /> : <Circle className="size-5 md:size-4" />}
              <h4 className="text-xl font-bold">{step.title}</h4>
            </div>
            <p className="mt-1 text-xs uppercase tracking-widest opacity-75">{getFrequencyLabel(step)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => toggleStep(step._id)}
              className={`inline-flex items-center justify-center rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest ${doneToday ? "bg-claret text-pink" : "hover:bg-claret hover:text-pink"}`}
              aria-label={`Check in ${step.title}`}
              title={`Check in ${step.title}`}
            >
              <Check className="size-5 md:size-4" />
            </button>
            <button
              type="button"
              onClick={() => openStepEdit(step)}
              className="inline-flex items-center justify-center rounded-xl border border-claret px-3 py-2 hover:bg-claret hover:text-pink"
              aria-label={`Edit ${step.title}`}
              title={`Edit ${step.title}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingItem({ type: "step", item: step })}
              className="inline-flex items-center justify-center rounded-xl border border-claret px-3 py-2 hover:bg-claret hover:text-pink"
              aria-label={`Delete ${step.title}`}
              title={`Delete ${step.title}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs uppercase tracking-widest">
            <span>{progress.done} / {progress.target}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-claret/20">
            <div className="h-full rounded-full bg-claret" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      </article>
    );
  }

  function renderGoal(goal: GoalDto) {
    const goalSteps = steps.filter((step) => step.goalId === goal._id);
    const isExpanded = expandedGoalIds.has(goal._id);
    const progressItems = goalSteps.map((step) => getStepProgress(step, selectedDate, progressView));
    const done = progressItems.reduce((sum, item) => sum + item.done, 0);
    const target = progressItems.reduce((sum, item) => sum + item.target, 0);
    const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    return (
      <article
        key={goal._id}
        className="cursor-pointer rounded-2xl bg-pink p-5 text-claret shadow-xl"
        onClick={(event) => {
          if (shouldIgnoreGoalToggle(event.target)) return;
          toggleGoalExpanded(goal._id);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleGoalExpanded(goal._id);
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={`goal-steps-${goal._id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
            <ChevronDown className={`mt-1 size-5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-start gap-2">
                <Flag className="mt-1 size-5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="break-words text-2xl font-bold leading-tight">{goal.title}</h3>
                  <span className="mt-2 inline-flex rounded-full border border-claret/30 px-3 py-1 text-xs uppercase tracking-widest">{goal.status}</span>
                </div>
              </div>
              {goal.description ? <p className="mt-2 text-lg">{goal.description}</p> : null}
              {goal.targetDate ? <p className="mt-2 text-xs uppercase font-black tracking-widest opacity-75">{parseDateKey(goal.targetDate).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}</p> : null}
            </div>
          </div>
          <div className="relative flex shrink-0 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenGoalMenuId((current) => current === goal._id ? null : goal._id);
              }}
              className="inline-flex items-center justify-center rounded-xl px-2 py-2 hover:bg-claret hover:text-pink md:hidden"
              aria-label={`${openGoalMenuId === goal._id ? "Close" : "Open"} ${goal.title} actions`}
              title={`${goal.title} actions`}
            >
              <MoreVertical className="size-4" />
            </button>
            {openGoalMenuId === goal._id ? (
              <div
                className="absolute right-0 top-11 z-20 grid min-w-32 gap-2 rounded-xl border border-claret/30 bg-pink p-2 shadow-xl md:hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenGoalMenuId(null);
                    openGoalEdit(goal);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
                >
                  <Pencil className="size-4" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenGoalMenuId(null);
                    setDeletingItem({ type: "goal", item: goal });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openGoalEdit(goal);
              }}
              className="hidden items-center justify-center rounded-xl border border-claret px-3 py-2 hover:bg-claret hover:text-pink md:inline-flex"
              aria-label={`Edit ${goal.title}`}
              title={`Edit ${goal.title}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDeletingItem({ type: "goal", item: goal });
              }}
              className="hidden items-center justify-center rounded-xl border border-claret px-3 py-2 hover:bg-claret hover:text-pink md:inline-flex"
              aria-label={`Delete ${goal.title}`}
              title={`Delete ${goal.title}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs uppercase tracking-widest">
            <span>{done} / {target}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-claret/20">
            <div className="h-full rounded-full bg-claret" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {isExpanded ? (
          <div id={`goal-steps-${goal._id}`} className="mt-4 grid gap-3">
            {goalSteps.length ? goalSteps.map(renderStep) : <p className="rounded-xl border border-dashed border-claret/30 p-4 text-lg">No steps yet.</p>}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <Layout>
      <section className="w-full">
        <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold uppercase md:text-5xl">Dopamine Goals</h1>
              <p className="mt-2 text-lg md:text-2xl">Targets, steps, receipts.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Tracking Date</span>
                <CustomDateInput value={selectedDate} onChange={(value) => setSelectedDate(value || todayKey())} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Review Month</span>
                <input type="month" value={getMonthKey(selectedDate)} onChange={(event) => setSelectedDate(monthToDateKey(event.target.value))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
              </label>
            </div>
          </div>
        </div>

        <section className="my-6 rounded-2xl bg-pink p-5 text-claret shadow-xl md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-5" />
              <h2 className="text-2xl font-bold uppercase">{progressView === "weekly" ? "Weekly Overview" : "Monthly Overview"}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm uppercase tracking-widest">{currentPeriodLabel}</p>
              <div className="inline-flex overflow-hidden rounded-xl border border-claret/40">
                <button type="button" onClick={() => setProgressView("weekly")} className={`px-3 py-2 text-sm uppercase tracking-widest ${progressView === "weekly" ? "bg-claret text-pink" : "hover:bg-claret hover:text-pink"}`}>Weekly</button>
                <button type="button" onClick={() => setProgressView("monthly")} className={`border-l border-claret/40 px-3 py-2 text-sm uppercase tracking-widest ${progressView === "monthly" ? "bg-claret text-pink" : "hover:bg-claret hover:text-pink"}`}>Monthly</button>
              </div>
            </div>
          </div>
          {syncError ? <p className="mt-4 rounded-xl border border-claret/30 p-3 text-sm uppercase tracking-widest">{syncError}</p> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Follow Through</p>
              <p className="mt-2 text-3xl font-bold">{overview.percent}%</p>
            </div>
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Active Goals</p>
              <p className="mt-2 text-3xl font-bold">{overview.activeGoals}</p>
            </div>
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Steps Hit</p>
              <p className="mt-2 text-3xl font-bold">{overview.completedSteps}</p>
            </div>
            <div className="rounded-xl border border-claret/20 p-4">
              <p className="text-sm uppercase tracking-widest opacity-80">Check Ins</p>
              <p className="mt-2 text-3xl font-bold">{overview.done}/{overview.target}</p>
            </div>
          </div>
        </section>

        <section className="my-6 space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-pink/20 p-3 text-pink md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-5" />
                <h2 className="text-2xl font-bold uppercase">Targets</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openNewGoalModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink/40 px-3 py-2 text-sm uppercase tracking-widest hover:bg-pink hover:text-claret"
                >
                  <Plus className="size-4" /> Goal
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewStepOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink/40 px-3 py-2 text-sm uppercase tracking-widest hover:bg-pink hover:text-claret"
                >
                  <Plus className="size-4" /> Step
                </button>
                <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value as GoalFilter)} className="rounded-xl border border-pink/40 bg-claret px-3 py-2 text-pink">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            {goalsToRender.length ? goalsToRender.map(renderGoal) : (
              <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl">
                <p className="text-xl">No goals here yet.</p>
              </div>
            )}

            {unassignedSteps.length ? (
              <article className="rounded-2xl bg-pink p-5 text-claret shadow-xl">
                <div className="flex items-center gap-2">
                  <Flag className="size-5" />
                  <h3 className="text-2xl font-bold">Unassigned Steps</h3>
                </div>
                <div className="mt-4 grid gap-3">
                  {unassignedSteps.map(renderStep)}
                </div>
              </article>
            ) : null}
        </section>
      </section>

      {isNewGoalOpen ? (
        <ModalFrame
          onClose={closeNewGoalModal}
          shouldConfirmClose={() => Boolean(goalTitle.trim() || goalDescription.trim() || goalTargetDate || newGoalSteps.some((draft) => draft.title.trim() || draft.frequency !== "daily" || draft.target !== 1))}
        >
          <ModalHead>New Goal</ModalHead>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addGoal();
            }}
          >
            <ModalBody>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Goal</span>
                <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Finish the Book of Psalms" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Details</span>
                <textarea value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} className="min-h-24 w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Target Date</span>
                <CustomDateInput value={goalTargetDate} onChange={setGoalTargetDate} />
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold uppercase">Steps</h3>
                </div>
                {newGoalSteps.length ? (
                  <div className="grid gap-3">
                    {newGoalSteps.map((draft, index) => (
                      <article key={draft.id} className="rounded-xl border border-claret/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm uppercase tracking-widest opacity-75">Step {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeGoalStepDraft(draft.id)}
                            aria-label="Remove step"
                            title="Remove step"
                            className="inline-flex size-9 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <label className="mt-3 block space-y-1">
                          <span className="text-sm uppercase tracking-widest">Step</span>
                          <input
                            value={draft.title}
                            onChange={(event) => updateGoalStepDraft(draft.id, { title: event.target.value })}
                            className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                            placeholder="e.g. Read two Psalms"
                          />
                        </label>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
                          <label className="block space-y-1">
                            <span className="text-sm uppercase tracking-widest">Cadence</span>
                            <select
                              value={draft.frequency}
                              onChange={(event) => updateGoalStepDraft(draft.id, { frequency: event.target.value as HabitFrequency, target: event.target.value === "daily" ? 1 : draft.target })}
                              className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </label>
                          {draft.frequency !== "daily" ? (
                            <label className="block space-y-1">
                              <span className="text-sm uppercase tracking-widest">Target</span>
                              <div className="flex overflow-hidden rounded-xl border border-claret/30">
                                <button
                                  type="button"
                                  onClick={() => updateGoalStepDraft(draft.id, { target: Math.max(1, draft.target - 1) })}
                                  className="w-12 border-r border-claret/30 text-2xl hover:bg-claret hover:text-pink"
                                  aria-label={`Decrease target for step ${index + 1}`}
                                  title="Decrease target"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={draft.target}
                                  onChange={(event) => updateGoalStepDraft(draft.id, { target: Number(event.target.value) || 1 })}
                                  className="no-number-spinner w-full bg-pink px-3 py-2 text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateGoalStepDraft(draft.id, { target: draft.target + 1 })}
                                  className="w-12 border-l border-claret/30 text-2xl hover:bg-claret hover:text-pink"
                                  aria-label={`Increase target for step ${index + 1}`}
                                  title="Increase target"
                                >
                                  +
                                </button>
                              </div>
                            </label>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-75">No steps added yet.</p>
                )}
                <button
                  type="button"
                  onClick={addGoalStepDraft}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
                >
                  <Plus className="size-4" /> Add Another Step
                </button>
              </div>
            </ModalBody>
            <ModalFooter>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                <Plus className="size-4" /> Add Goal
              </button>
            </ModalFooter>
          </form>
        </ModalFrame>
      ) : null}

      {isNewStepOpen ? (
        <ModalFrame
          onClose={closeNewStepModal}
          shouldConfirmClose={() => Boolean(stepTitle.trim() || stepGoalId || stepFrequency !== "daily" || stepTarget !== 1)}
        >
          <ModalHead>New Step</ModalHead>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addStep();
            }}
          >
            <ModalBody>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Step</span>
                <input value={stepTitle} onChange={(event) => setStepTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Read two Psalms" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Goal</span>
                <select value={stepGoalId} onChange={(event) => setStepGoalId(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                  <option value="">No goal yet</option>
                  {goals.map((goal) => <option key={goal._id} value={goal._id}>{goal.title}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Cadence</span>
                <select value={stepFrequency} onChange={(event) => setStepFrequency(event.target.value as HabitFrequency)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              {stepFrequency !== "daily" ? (
                <label className="block space-y-1">
                  <span className="text-sm uppercase tracking-widest">Target Count</span>
                  <div className="flex overflow-hidden rounded-xl border border-claret/30">
                    <button type="button" onClick={() => setStepTarget((value) => Math.max(1, value - 1))} className="w-12 border-r border-claret/30 text-2xl hover:bg-claret hover:text-pink">-</button>
                    <input type="number" min={1} value={stepTarget} onChange={(event) => setStepTarget(Number(event.target.value) || 1)} className="no-number-spinner w-full bg-pink px-3 py-2 text-center" />
                    <button type="button" onClick={() => setStepTarget((value) => value + 1)} className="w-12 border-l border-claret/30 text-2xl hover:bg-claret hover:text-pink">+</button>
                  </div>
                </label>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                <Plus className="size-4" /> Add Step
              </button>
            </ModalFooter>
          </form>
        </ModalFrame>
      ) : null}

      {editingGoal ? (
        <ModalFrame
          onClose={() => setEditingGoal(null)}
          shouldConfirmClose={() => editGoalTitle.trim() !== editingGoal.title || editGoalDescription.trim() !== (editingGoal.description || "") || editGoalStatus !== editingGoal.status || editGoalTargetDate !== (editingGoal.targetDate || "")}
        >
          <ModalHead>Edit Goal</ModalHead>
          <ModalBody>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Goal</span>
              <input value={editGoalTitle} onChange={(event) => setEditGoalTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Details</span>
              <textarea value={editGoalDescription} onChange={(event) => setEditGoalDescription(event.target.value)} className="min-h-24 w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Status</span>
              <select value={editGoalStatus} onChange={(event) => setEditGoalStatus(event.target.value as GoalStatus)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Target Date</span>
              <CustomDateInput value={editGoalTargetDate} onChange={setEditGoalTargetDate} />
            </label>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setDeletingItem({ type: "goal", item: editingGoal })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
              <Trash2 className="size-4" /> Delete
            </button>
            <button type="button" onClick={saveGoalEdit} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
              <Save className="size-4" /> Save
            </button>
          </ModalFooter>
        </ModalFrame>
      ) : null}

      {editingStep ? (
        <ModalFrame
          onClose={() => setEditingStep(null)}
          shouldConfirmClose={() => editStepTitle.trim() !== editingStep.title || editStepGoalId !== (editingStep.goalId || "") || editStepFrequency !== editingStep.frequency || editStepTarget !== editingStep.target}
        >
          <ModalHead>Edit Step</ModalHead>
          <ModalBody>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Step</span>
              <input value={editStepTitle} onChange={(event) => setEditStepTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Goal</span>
              <select value={editStepGoalId} onChange={(event) => setEditStepGoalId(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                <option value="">No goal yet</option>
                {goals.map((goal) => <option key={goal._id} value={goal._id}>{goal.title}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Cadence</span>
              <select value={editStepFrequency} onChange={(event) => setEditStepFrequency(event.target.value as HabitFrequency)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            {editStepFrequency !== "daily" ? (
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Target Count</span>
                <div className="flex overflow-hidden rounded-xl border border-claret/30">
                  <button type="button" onClick={() => setEditStepTarget((value) => Math.max(1, value - 1))} className="w-12 border-r border-claret/30 text-2xl hover:bg-claret hover:text-pink">-</button>
                  <input type="number" min={1} value={editStepTarget} onChange={(event) => setEditStepTarget(Number(event.target.value) || 1)} className="no-number-spinner w-full bg-pink px-3 py-2 text-center" />
                  <button type="button" onClick={() => setEditStepTarget((value) => value + 1)} className="w-12 border-l border-claret/30 text-2xl hover:bg-claret hover:text-pink">+</button>
                </div>
              </label>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setDeletingItem({ type: "step", item: editingStep })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
              <Trash2 className="size-4" /> Delete
            </button>
            <button type="button" onClick={saveStepEdit} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
              <Save className="size-4" /> Save
            </button>
          </ModalFooter>
        </ModalFrame>
      ) : null}

      <DeleteConfirmationModal
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        itemName={deletingItem?.item.title || ""}
        itemType={deletingItem?.type || "item"}
        onConfirm={() => {
          if (deletingItem?.type === "goal") deleteGoal(deletingItem.item);
          if (deletingItem?.type === "step") deleteStep(deletingItem.item);
        }}
      />
    </Layout>
  );
}
