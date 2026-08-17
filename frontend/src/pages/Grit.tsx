import Layout from "@/components/Layout";
import CustomDateInput from "@/components/CustomDateInput";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  createGritChallenge,
  deleteGritChallenge,
  getGritChallenges,
  updateGritChallenge,
  updateGritDay,
  type GritCheckInDto,
  type GritChallengeDto,
  type GritGoalDto,
  type GritNoteDto,
  type GritTaskDto,
  type HabitFrequency,
} from "@/lib/api";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { CalendarDays, Check, ChevronLeft, ChevronRight, MoreVertical, NotebookPen, Plus, Save, ShieldCheck, Square, Target, Trash2, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CadenceFilter = HabitFrequency;
type GoalDraft = { id: string; title: string; notes: string };
type TaskDraft = { id: string; goalId: string; title: string; frequency: HabitFrequency; target: number };

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

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthCells(month: Date) {
  const firstDay = getMonthStart(month);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function getWeekKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toDateKey(date);
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function formatDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
}

function makeGoalDraft(): GoalDraft {
  return { id: `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: "", notes: "" };
}

function makeTaskDraft(goalId = ""): TaskDraft {
  return { id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`, goalId, title: "", frequency: "daily", target: 1 };
}

function getChallengeEnd(challenge: GritChallengeDto) {
  return addDays(challenge.startDate, challenge.durationDays - 1);
}

function isDateInChallenge(challenge: GritChallengeDto, date: string) {
  return challenge.startDate <= date && date <= getChallengeEnd(challenge);
}

function getDayLog(challenge: GritChallengeDto | null, date: string) {
  return challenge?.dailyLogs.find((log) => log.date === date) || { date, completedTaskIds: [], checkIns: [], notes: [] };
}

function getLogCheckIns(log: ReturnType<typeof getDayLog>): GritCheckInDto[] {
  const checkIns = log.checkIns?.length ? log.checkIns : (log.completedTaskIds || []).map((taskId, index) => ({
    id: `legacy-${log.date}-${taskId}-${index}`,
    taskId,
    createdAt: `${log.date}T00:00:00.000Z`,
  }));
  const seen = new Set<string>();
  return checkIns.filter((checkIn) => {
    if (seen.has(checkIn.taskId)) return false;
    seen.add(checkIn.taskId);
    return true;
  });
}

function getLogNotes(log: ReturnType<typeof getDayLog>): GritNoteDto[] {
  if (typeof log.notes === "string") {
    return log.notes.trim() ? [{ id: `legacy-note-${log.date}`, text: log.notes, createdAt: `${log.date}T00:00:00.000Z` }] : [];
  }
  return log.notes || [];
}

function getTargetForTask(task: GritTaskDto) {
  if (!task.frequency || task.frequency === "daily") return 1;
  if (task.frequency === "weekly") return Math.max(1, task.target);
  return Math.max(1, task.target);
}

function getDoneForTask(challenge: GritChallengeDto, task: GritTaskDto, date: string) {
  const logs = challenge.dailyLogs || [];
  if (!task.frequency || task.frequency === "daily") return getLogCheckIns(getDayLog(challenge, date)).filter((checkIn) => checkIn.taskId === task.id).length;
  if (task.frequency === "weekly") return logs.filter((log) => getWeekKey(log.date) === getWeekKey(date)).reduce((sum, log) => sum + getLogCheckIns(log).filter((checkIn) => checkIn.taskId === task.id).length, 0);
  return logs.filter((log) => getMonthKey(log.date) === getMonthKey(date)).reduce((sum, log) => sum + getLogCheckIns(log).filter((checkIn) => checkIn.taskId === task.id).length, 0);
}

function getTaskProgress(challenge: GritChallengeDto, task: GritTaskDto, date: string) {
  const target = getTargetForTask(task);
  const done = getDoneForTask(challenge, task, date);
  return { done, target, percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0 };
}

function getTaskLabel(task: GritTaskDto) {
  if (!task.frequency || task.frequency === "daily") return "Daily";
  if (task.frequency === "weekly") return `${task.target}x Weekly`;
  return `${task.target}x Monthly`;
}

function getExpectedChecks(challenge: GritChallengeDto) {
  return challenge.tasks.reduce((sum, task) => {
    if (!task.frequency || task.frequency === "daily") return sum + challenge.durationDays;
    if (task.frequency === "weekly") return sum + Math.ceil(challenge.durationDays / 7) * Math.max(1, task.target);
    return sum + Math.ceil(challenge.durationDays / 30) * Math.max(1, task.target);
  }, 0);
}

function getTotalChecks(challenge: GritChallengeDto) {
  return challenge.dailyLogs.reduce((sum, log) => sum + getLogCheckIns(log).length, 0);
}

function getGoalProgress(challenge: GritChallengeDto, goalId: string) {
  const goalTasks = challenge.tasks.filter((task) => task.goalId === goalId);
  const taskIds = new Set(goalTasks.map((task) => task.id));
  const target = goalTasks.reduce((sum, task) => {
    if (!task.frequency || task.frequency === "daily") return sum + challenge.durationDays;
    if (task.frequency === "weekly") return sum + Math.ceil(challenge.durationDays / 7) * Math.max(1, task.target);
    return sum + Math.ceil(challenge.durationDays / 30) * Math.max(1, task.target);
  }, 0);
  const done = challenge.dailyLogs.reduce((sum, log) => {
    return sum + getLogCheckIns(log).filter((checkIn) => taskIds.has(checkIn.taskId)).length;
  }, 0);
  return {
    done,
    target,
    percent: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
  };
}

export default function Grit() {
  const toast = useToast();
  const [challenges, setChallenges] = useState<GritChallengeDto[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState("");
  const [month, setMonth] = useState(() => getMonthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<GritChallengeDto | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<GritChallengeDto | null>(null);
  const [openChallengeMenuId, setOpenChallengeMenuId] = useState<string | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(() => new Set());
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<CadenceFilter>("daily");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [goalDrafts, setGoalDrafts] = useState<GoalDraft[]>([makeGoalDraft()]);
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([makeTaskDraft()]);
  const [checkInsDraft, setCheckInsDraft] = useState<GritCheckInDto[]>([]);
  const [notesDraft, setNotesDraft] = useState<GritNoteDto[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [isSavingDay, setIsSavingDay] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadChallenges() {
      try {
        const items = await getGritChallenges();
        if (!mounted) return;
        setChallenges(items);
        const today = todayKey();
        const active = items.find((item) => item.status === "active" && isDateInChallenge(item, today)) || items.find((item) => item.status === "active") || items[0];
        if (active) setSelectedChallengeId(active._id);
      } catch (err) {
        console.error(err);
        if (mounted) toast.push({ type: "error", message: "Could not load Grit challenges." });
      }
    }

    loadChallenges();
    return () => { mounted = false };
  }, [toast]);

  const selectedChallenge = useMemo(() => challenges.find((challenge) => challenge._id === selectedChallengeId) || null, [challenges, selectedChallengeId]);
  const monthCells = useMemo(() => getMonthCells(month), [month]);
  const selectedTasks = selectedChallenge?.tasks || [];
  const selectedGoals = selectedChallenge?.goals || [];
  const filteredTasks = useMemo(() => selectedTasks.filter((task) => task.frequency === taskFilter), [selectedTasks, taskFilter]);
  const selectedDateMode = selectedDate < todayKey() ? "past" : selectedDate > todayKey() ? "future" : "today";
  const visibleProgressTasks = useMemo(() => {
    if (selectedDateMode !== "past") return filteredTasks;
    return filteredTasks.filter((task) => checkInsDraft.some((checkIn) => checkIn.taskId === task.id));
  }, [checkInsDraft, filteredTasks, selectedDateMode]);

  const overview = useMemo(() => {
    if (!selectedChallenge) return { done: 0, target: 0, percent: 0, cleanDays: 0 };
    const normalizedChallenge = { ...selectedChallenge, tasks: selectedTasks, goals: selectedGoals };
    const target = getExpectedChecks(normalizedChallenge);
    const done = getTotalChecks(normalizedChallenge);
    const cleanDays = Array.from({ length: selectedChallenge.durationDays }, (_, index) => addDays(selectedChallenge.startDate, index)).filter((date) => {
      const dailyTasks = selectedTasks.filter((task) => task.frequency === "daily");
      const log = getDayLog(selectedChallenge, date);
      const checkIns = getLogCheckIns(log);
      return dailyTasks.length > 0 && dailyTasks.every((task) => checkIns.some((checkIn) => checkIn.taskId === task.id));
    }).length;
    return { done, target, cleanDays, percent: target ? Math.min(100, Math.round((done / target) * 100)) : 0 };
  }, [selectedChallenge]);

  useEffect(() => {
    const log = getDayLog(selectedChallenge, selectedDate);
    setCheckInsDraft(getLogCheckIns(log));
    setNotesDraft(getLogNotes(log));
    setNewNoteText("");
  }, [selectedChallenge, selectedDate]);

  function resetCreateForm() {
    setEditingChallenge(null);
    setTitle("");
    setStartDate("");
    setDurationDays("");
    setGoalDrafts([makeGoalDraft()]);
    setTaskDrafts([makeTaskDraft()]);
  }

  function closeCreateModal() {
    setIsCreateOpen(false);
    resetCreateForm();
  }

  function openCreateModal() {
    resetCreateForm();
    setIsCreateOpen(true);
  }

  function openEditModal(challenge: GritChallengeDto) {
    setEditingChallenge(challenge);
    setTitle(challenge.title);
    setStartDate(challenge.startDate);
    setDurationDays(String(challenge.durationDays));
    const goals = challenge.goals?.length
      ? challenge.goals.map((goal) => ({ id: goal.id, title: goal.title, notes: goal.notes || "" }))
      : [makeGoalDraft()];
    setGoalDrafts(goals);
    setTaskDrafts(
      challenge.tasks?.length
        ? challenge.tasks.map((task) => ({
            id: task.id,
            goalId: task.goalId || "",
            title: task.title,
            frequency: task.frequency,
            target: task.frequency === "daily" ? 1 : Math.max(1, task.target),
          }))
        : [makeTaskDraft()]
    );
    setIsCreateOpen(true);
  }

  function updateGoalDraft(id: string, update: Partial<GoalDraft>) {
    setGoalDrafts((drafts) => drafts.map((draft) => draft.id === id ? { ...draft, ...update } : draft));
  }

  function removeGoalDraft(id: string) {
    setGoalDrafts((drafts) => drafts.length > 1 ? drafts.filter((draft) => draft.id !== id) : [makeGoalDraft()]);
    setTaskDrafts((drafts) => drafts.map((draft) => draft.goalId === id ? { ...draft, goalId: "" } : draft));
  }

  function updateTaskDraft(id: string, update: Partial<TaskDraft>) {
    setTaskDrafts((drafts) => drafts.map((draft) => {
      if (draft.id !== id) return draft;
      const next = { ...draft, ...update };
      return next.frequency === "daily" ? { ...next, target: 1 } : next;
    }));
  }

  function removeTaskDraft(id: string) {
    setTaskDrafts((drafts) => drafts.length > 1 ? drafts.filter((draft) => draft.id !== id) : [makeTaskDraft()]);
  }

  async function createChallenge() {
    const cleanGoals = goalDrafts.map((goal) => ({ id: goal.id, title: goal.title.trim(), notes: goal.notes.trim() })).filter((goal) => goal.title);
    const goalIds = new Set(cleanGoals.map((goal) => goal.id));
    const cleanTasks = taskDrafts
      .map((task) => ({
        title: task.title.trim(),
        goalId: goalIds.has(task.goalId) ? task.goalId : "",
        frequency: task.frequency,
        target: task.frequency === "daily" ? 1 : Math.max(1, task.target),
      }))
      .filter((task) => task.title);
    const days = Math.max(1, Math.floor(Number(durationDays) || 0));
    if (!title.trim() || !startDate || !days || !cleanGoals.length || !cleanTasks.length) return;

    try {
      const created = await createGritChallenge({ title: title.trim(), startDate, durationDays: days, goals: cleanGoals, tasks: cleanTasks });
      setChallenges((current) => [created, ...current]);
      setSelectedChallengeId(created._id);
      setMonth(getMonthStart(parseDateKey(created.startDate)));
      closeCreateModal();
      window.dispatchEvent(new CustomEvent("heph:grit:changed"));
      toast.push({ type: "success", message: "Grit challenge created." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not create Grit challenge." });
    }
  }

  async function saveChallenge() {
    if (!editingChallenge) {
      await createChallenge();
      return;
    }

    const cleanGoals = goalDrafts.map((goal) => ({ id: goal.id, title: goal.title.trim(), notes: goal.notes.trim() })).filter((goal) => goal.title);
    const goalIds = new Set(cleanGoals.map((goal) => goal.id));
    const cleanTasks = taskDrafts
      .map((task) => ({
        id: task.id,
        title: task.title.trim(),
        goalId: goalIds.has(task.goalId) ? task.goalId : "",
        frequency: task.frequency,
        target: task.frequency === "daily" ? 1 : Math.max(1, task.target),
      }))
      .filter((task) => task.title);
    const days = Math.max(1, Math.floor(Number(durationDays) || 0));
    if (!title.trim() || !startDate || !days || !cleanGoals.length || !cleanTasks.length) return;

    try {
      const updated = await updateGritChallenge(editingChallenge._id, {
        title: title.trim(),
        startDate,
        durationDays: days,
        goals: cleanGoals,
        tasks: cleanTasks,
      });
      setChallenges((current) => current.map((challenge) => challenge._id === updated._id ? updated : challenge));
      setSelectedChallengeId(updated._id);
      setMonth(getMonthStart(parseDateKey(updated.startDate)));
      closeCreateModal();
      window.dispatchEvent(new CustomEvent("heph:grit:changed"));
      toast.push({ type: "success", message: "Grit challenge updated." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not update Grit challenge." });
    }
  }

  async function removeChallenge() {
    if (!deletingChallenge) return;
    try {
      await deleteGritChallenge(deletingChallenge._id);
      setChallenges((current) => {
        const next = current.filter((challenge) => challenge._id !== deletingChallenge._id);
        if (selectedChallengeId === deletingChallenge._id) {
          setSelectedChallengeId(next[0]?._id || "");
          if (next[0]) setMonth(getMonthStart(parseDateKey(next[0].startDate)));
        }
        return next;
      });
      if (editingChallenge?._id === deletingChallenge._id) closeCreateModal();
      setDeletingChallenge(null);
      window.dispatchEvent(new CustomEvent("heph:grit:changed"));
      toast.push({ type: "success", message: "Grit challenge deleted." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not delete Grit challenge." });
    }
  }

  function openProgressModal(date: string) {
    setSelectedDate(date);
    setTaskFilter("daily");
    setIsProgressOpen(true);
  }

  function toggleTaskCheckIn(taskId: string) {
    setCheckInsDraft((current) => {
      if (current.some((checkIn) => checkIn.taskId === taskId)) return current.filter((checkIn) => checkIn.taskId !== taskId);
      return [...current, { id: `check-${Date.now()}-${Math.random().toString(36).slice(2)}`, taskId, createdAt: new Date().toISOString() }];
    });
  }

  function addNoteDraft() {
    const text = newNoteText.trim();
    if (!text) return;
    setNotesDraft((current) => [...current, { id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`, text, createdAt: new Date().toISOString() }]);
    setNewNoteText("");
  }

  function removeNoteDraft(noteId: string) {
    if (selectedDateMode !== "today") return;
    setNotesDraft((current) => current.filter((note) => note.id !== noteId));
  }

  async function saveDay() {
    if (!selectedChallenge || selectedDateMode !== "today") return;
    setIsSavingDay(true);
    const finalNotes = newNoteText.trim()
      ? [...notesDraft, { id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: newNoteText.trim(), createdAt: new Date().toISOString() }]
      : notesDraft;
    try {
      const updated = await updateGritDay(selectedChallenge._id, selectedDate, {
        checkIns: checkInsDraft,
        completedTaskIds: Array.from(new Set(checkInsDraft.map((checkIn) => checkIn.taskId))),
        notes: finalNotes,
      });
      setChallenges((current) => current.map((challenge) => challenge._id === updated._id ? updated : challenge));
      window.dispatchEvent(new CustomEvent("heph:grit:changed"));
      toast.push({ type: "success", message: "Grit progress saved." });
      setIsProgressOpen(false);
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not save Grit progress." });
    } finally {
      setIsSavingDay(false);
    }
  }

  async function completeChallenge() {
    if (!selectedChallenge) return;
    try {
      const updated = await updateGritChallenge(selectedChallenge._id, { status: "completed" });
      setChallenges((current) => current.map((challenge) => challenge._id === updated._id ? updated : challenge));
      window.dispatchEvent(new CustomEvent("heph:grit:changed"));
      toast.push({ type: "success", message: "Challenge completed." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not complete challenge." });
    }
  }

  function goalForTask(task: GritTaskDto) {
    return selectedGoals.find((goal) => goal.id === task.goalId);
  }

  function toggleGoalExpanded(goalId: string) {
    setExpandedGoalIds((current) => {
      const next = new Set(current);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }

  function renderTaskToggle(task: GritTaskDto) {
    if (!selectedChallenge) return null;
    const checked = checkInsDraft.some((checkIn) => checkIn.taskId === task.id);
    const savedDayCount = getLogCheckIns(getDayLog(selectedChallenge, selectedDate)).filter((checkIn) => checkIn.taskId === task.id).length;
    const progress = getTaskProgress(selectedChallenge, task, selectedDate);
    const adjustedDone = Math.max(0, progress.done - savedDayCount + (checked ? 1 : 0));
    const adjustedPercent = progress.target > 0 ? Math.min(100, Math.round((adjustedDone / progress.target) * 100)) : 0;
    const overflow = Math.max(0, adjustedDone - progress.target);
    const isEditable = selectedDateMode === "today";
    const goal = goalForTask(task);
    return (
      <article key={task.id} className="rounded-xl border border-claret/20 p-3">
        <button
          type="button"
          onClick={() => isEditable && toggleTaskCheckIn(task.id)}
          disabled={!isEditable}
          className="flex w-full items-start gap-3 text-left disabled:cursor-default"
        >
          {checked ? <Check className="mt-1 size-5 shrink-0" /> : <Square className="mt-1 size-5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-tight">{task.title}</p>
            <p className="mt-1 text-xs uppercase tracking-widest opacity-75">{goal?.title || "No goal"} - {getTaskLabel(task)}</p>
          </div>
        </button>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs uppercase tracking-widest">
            <span>{adjustedDone}/{progress.target}</span>
            <span>{overflow > 0 ? `Overflow +${overflow}` : `${adjustedPercent}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-claret/20">
            <div className="h-full rounded-full bg-claret" style={{ width: `${adjustedPercent}%` }} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <Layout>
      <section className="w-full space-y-6">
        <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold uppercase md:text-5xl">Grit</h1>
              <p className="mt-2 text-lg tracking-normal md:text-2xl">Challenge goals, cadence tasks, calendar receipts.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90"
              >
                <Plus className="size-4" />
                Challenge
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-2xl bg-pink p-5 text-claret shadow-xl">
              <h2 className="text-2xl font-bold uppercase">Challenges</h2>
              <div className="mt-4 space-y-2">
                {challenges.length ? challenges.map((challenge) => (
                  <article
                    key={challenge._id}
                    className={`relative rounded-xl border transition ${selectedChallengeId === challenge._id ? "border-claret bg-claret text-pink" : "border-claret/30 hover:border-claret"}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChallengeId(challenge._id);
                        setMonth(getMonthStart(parseDateKey(challenge.startDate)));
                        setOpenChallengeMenuId(null);
                      }}
                      className="w-full p-3 pr-12 text-left"
                    >
                      <span className="block text-xl font-bold leading-tight">{challenge.title}</span>
                      <span className="block text-xs uppercase tracking-widest opacity-80">{challenge.durationDays} days - {challenge.status}</span>
                    </button>
                    {selectedChallengeId === challenge._id ? (
                      <div className="absolute right-2 top-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenChallengeMenuId((current) => current === challenge._id ? null : challenge._id);
                          }}
                          aria-label={`${challenge.title} actions`}
                          title="Challenge actions"
                          className="inline-flex size-9 items-center justify-center rounded-xl border border-current hover:bg-pink hover:text-claret"
                        >
                          <MoreVertical className="size-5" />
                        </button>
                        {openChallengeMenuId === challenge._id ? (
                          <div className="absolute right-0 top-11 z-20 grid min-w-36 gap-2 rounded-xl border border-claret/30 bg-pink p-2 text-claret shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenChallengeMenuId(null);
                                openEditModal(challenge);
                              }}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
                            >
                              <Save className="size-4" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenChallengeMenuId(null);
                                setDeletingChallenge(challenge);
                              }}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
                            >
                              <Trash2 className="size-4" /> Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenChallengeMenuId(null);
                                completeChallenge();
                              }}
                              disabled={challenge.status === "completed"}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trophy className="size-4" /> Complete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )) : (
                  <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-70">No challenges yet</p>
                )}
              </div>
            </section>

            {selectedChallenge ? (
              <section className="rounded-2xl bg-pink p-5 text-claret shadow-xl">
                <div className="flex items-center gap-2">
                  <Target className="size-5" />
                  <h2 className="text-2xl font-bold uppercase">Goals</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {selectedGoals.length ? selectedGoals.map((goal: GritGoalDto) => {
                    const goalTasks = selectedTasks.filter((task) => task.goalId === goal.id);
                    const progress = selectedChallenge ? getGoalProgress(selectedChallenge, goal.id) : { done: 0, target: 0, percent: 0 };
                    const isExpanded = expandedGoalIds.has(goal.id);
                    return (
                      <article key={goal.id} className="rounded-xl border border-claret/20 p-3">
                        <button
                          type="button"
                          onClick={() => toggleGoalExpanded(goal.id)}
                          className="w-full text-left"
                          aria-expanded={isExpanded}
                          aria-controls={`grit-goal-tasks-${goal.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-xl font-bold leading-tight">{goal.title}</h3>
                              {goal.notes ? <p className="mt-1 text-base tracking-normal opacity-80">{goal.notes}</p> : null}
                            </div>
                            <ChevronRight className={`mt-1 size-5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </div>
                        </button>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs uppercase tracking-widest opacity-75">
                            <span>{progress.done}/{progress.target}</span>
                            <span>{progress.percent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-claret/20">
                            <div className="h-full rounded-full bg-claret" style={{ width: `${progress.percent}%` }} />
                          </div>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-widest opacity-75">{goalTasks.length} tasks tied</p>
                        {isExpanded ? (
                          <div id={`grit-goal-tasks-${goal.id}`} className="mt-3 space-y-2">
                            {goalTasks.length ? goalTasks.map((task) => {
                              const taskProgress = selectedChallenge ? getTaskProgress(selectedChallenge, task, todayKey()) : { done: 0, target: 0, percent: 0 };
                              const overflow = Math.max(0, taskProgress.done - taskProgress.target);
                              return (
                                <div key={task.id} className="rounded-xl border border-claret/20 p-3">
                                  <p className="text-lg font-bold leading-tight">{task.title}</p>
                                  <div className="mt-2 flex justify-between text-xs uppercase tracking-widest opacity-75">
                                    <span>{getTaskLabel(task)}</span>
                                    <span>{overflow > 0 ? `Overflow +${overflow}` : `${taskProgress.done}/${taskProgress.target}`}</span>
                                  </div>
                                </div>
                              );
                            }) : (
                              <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-70">No tasks tied yet</p>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  }) : <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-70">No goals tied yet</p>}
                </div>
              </section>
            ) : null}
          </aside>

          <div className="space-y-6">
            {selectedChallenge ? (
              <>
                <section className="rounded-2xl bg-pink p-5 text-claret shadow-xl md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm uppercase tracking-widest opacity-75">{formatDate(selectedChallenge.startDate)} - {formatDate(getChallengeEnd(selectedChallenge))}</p>
                      <h2 className="mt-1 min-w-0 break-words text-3xl font-bold uppercase">{selectedChallenge.title}</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-claret/20 px-3 py-2">
                        <p className="text-2xl font-bold">{overview.percent}%</p>
                        <p className="text-xs uppercase">Follow Through</p>
                      </div>
                      <div className="rounded-xl border border-claret/20 px-3 py-2">
                        <p className="text-2xl font-bold">{overview.cleanDays}</p>
                        <p className="text-xs uppercase">Clean Days</p>
                      </div>
                      <div className="rounded-xl border border-claret/20 px-3 py-2">
                        <p className="text-2xl font-bold">{overview.done}/{overview.target}</p>
                        <p className="text-xs uppercase">Checks</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-pink p-4 text-claret shadow-xl md:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-5" />
                      <h2 className="text-2xl font-bold uppercase">{month.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</h2>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" title="Previous month" className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink">
                        <ChevronLeft className="size-5" />
                      </button>
                      <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" title="Next month" className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink">
                        <ChevronRight className="size-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-widest opacity-75">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                    {monthCells.map((date) => {
                      const dateKey = toDateKey(date);
                      const inMonth = date.getMonth() === month.getMonth();
                      const inChallenge = isDateInChallenge(selectedChallenge, dateKey);
                      const log = getDayLog(selectedChallenge, dateKey);
                      const done = getLogCheckIns(log).length;
                      const total = selectedTasks.length;
                      const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => inChallenge && openProgressModal(dateKey)}
                          disabled={!inChallenge}
                          className={`min-h-20 rounded-xl border p-2 text-left transition sm:min-h-24 ${inMonth ? "opacity-100" : "opacity-40"} ${inChallenge ? "border-claret/30 hover:border-claret" : "cursor-not-allowed border-claret/10 opacity-30"} ${dateKey === todayKey() ? "ring-2 ring-claret ring-offset-2 ring-offset-pink" : ""}`}
                        >
                          <span className="block text-lg font-bold">{date.getDate()}</span>
                          {inChallenge ? (
                            <>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-claret/20">
                                <div className="h-full rounded-full bg-claret" style={{ width: `${percent}%` }} />
                              </div>
                              <span className="mt-1 block text-xs uppercase tracking-widest">{done}/{total}</span>
                            </>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-dashed border-pink/40 p-8 text-center text-pink">
                <h2 className="text-3xl font-bold uppercase">No challenge yet</h2>
                <p className="mt-2 text-xl tracking-normal">Create one to unlock the calendar.</p>
              </section>
            )}
          </div>
        </div>
      </section>

      {isCreateOpen ? (
        <ModalFrame
          onClose={closeCreateModal}
          shouldConfirmClose={() => Boolean(title.trim() || startDate || durationDays || goalDrafts.some((goal) => goal.title.trim() || goal.notes.trim()) || taskDrafts.some((task) => task.title.trim() || task.goalId || task.frequency !== "daily" || task.target !== 1))}
        >
          <ModalHead>{editingChallenge ? "Edit Grit Challenge" : "Create Grit Challenge"}</ModalHead>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveChallenge();
            }}
          >
            <ModalBody>
              <div className="grid gap-3 sm:grid-cols-[1fr_160px_140px]">
                <label className="block space-y-1">
                  <span className="text-sm uppercase tracking-widest">Challenge</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm uppercase tracking-widest">Start</span>
                  <CustomDateInput value={startDate} onChange={setStartDate} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm uppercase tracking-widest">Days</span>
                  <input type="number" min={1} value={durationDays} onChange={(event) => setDurationDays(event.target.value)} className="no-number-spinner w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                </label>
              </div>

              <section className="space-y-3">
                <h3 className="text-xl font-bold uppercase">Overarching Goals</h3>
                {goalDrafts.map((goal) => (
                  <article key={goal.id} className="rounded-xl border border-claret/20 p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <input value={goal.title} onChange={(event) => updateGoalDraft(goal.id, { title: event.target.value })} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                        <textarea value={goal.notes} onChange={(event) => updateGoalDraft(goal.id, { notes: event.target.value })} rows={2} className="w-full resize-none rounded-xl border border-claret/30 bg-pink px-3 py-2 tracking-normal" />
                      </div>
                      <button type="button" onClick={() => removeGoalDraft(goal.id)} aria-label="Remove goal" title="Remove goal" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
                <button type="button" onClick={() => setGoalDrafts((drafts) => [...drafts, makeGoalDraft()])} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
                  <Plus className="size-4" /> Goal
                </button>
              </section>

              <section className="space-y-3">
                <h3 className="text-xl font-bold uppercase">Tasks</h3>
                {taskDrafts.map((task) => (
                  <article key={task.id} className="rounded-xl border border-claret/20 p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-3">
                        <input value={task.title} onChange={(event) => updateTaskDraft(task.id, { title: event.target.value })} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                        <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px]">
                          <select value={task.goalId} onChange={(event) => updateTaskDraft(task.id, { goalId: event.target.value })} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                            <option value="">No goal</option>
                            {goalDrafts.filter((goal) => goal.title.trim()).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                          </select>
                          <select value={task.frequency} onChange={(event) => updateTaskDraft(task.id, { frequency: event.target.value as HabitFrequency })} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                          {task.frequency !== "daily" ? (
                            <input type="number" min={1} value={task.target} onChange={(event) => updateTaskDraft(task.id, { target: Number(event.target.value) || 1 })} className="no-number-spinner w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                          ) : null}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeTaskDraft(task.id)} aria-label="Remove task" title="Remove task" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
                <button type="button" onClick={() => setTaskDrafts((drafts) => [...drafts, makeTaskDraft()])} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
                  <Plus className="size-4" /> Task
                </button>
              </section>
            </ModalBody>
            <ModalFooter>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                <ShieldCheck className="size-4" /> {editingChallenge ? "Save" : "Create"}
              </button>
            </ModalFooter>
          </form>
        </ModalFrame>
      ) : null}

      {isProgressOpen && selectedChallenge ? (
        <ModalFrame
          onClose={() => setIsProgressOpen(false)}
          shouldConfirmClose={() => {
            if (selectedDateMode !== "today") return false;
            const log = getDayLog(selectedChallenge, selectedDate);
            return Boolean(newNoteText.trim()) || JSON.stringify(notesDraft) !== JSON.stringify(getLogNotes(log)) || JSON.stringify(checkInsDraft) !== JSON.stringify(getLogCheckIns(log));
          }}
        >
          <ModalHead>{formatDate(selectedDate)}</ModalHead>
          <ModalBody>
            <p className="rounded-xl border border-claret/20 p-3 text-sm uppercase tracking-widest opacity-75">
              {selectedDateMode === "past" ? "Past day - showing saved check-ins and notes" : selectedDateMode === "future" ? "Future day - tasks are preview only" : "Today - checklist open"}
            </p>
            <div className="inline-flex w-full overflow-hidden rounded-xl border border-claret/40">
              {(["daily", "weekly", "monthly"] as CadenceFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTaskFilter(filter)}
                  className={`flex-1 px-3 py-2 text-sm uppercase tracking-widest ${taskFilter === filter ? "bg-claret text-pink" : "hover:bg-claret hover:text-pink"} ${filter !== "daily" ? "border-l border-claret/40" : ""}`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="grid gap-3">
              {visibleProgressTasks.length ? visibleProgressTasks.map(renderTaskToggle) : (
                <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-75">{selectedDateMode === "past" ? `No ${taskFilter} tasks done` : `No ${taskFilter} tasks`}</p>
              )}
            </div>
            {selectedDateMode !== "future" ? (
            <section className="space-y-3">
              <span className="inline-flex items-center gap-2 text-sm uppercase tracking-widest">
                <NotebookPen className="size-4" />
                Notes
              </span>
              {notesDraft.length ? (
                <div className="space-y-2">
                  {notesDraft.map((note) => (
                    <article key={note.id} className="flex items-start gap-2 rounded-xl border border-claret/20 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap tracking-normal">{note.text}</p>
                        <p className="mt-1 text-xs uppercase tracking-widest opacity-60">{new Date(note.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNoteDraft(note.id)}
                        aria-label="Remove note"
                        title="Remove note"
                        disabled={selectedDateMode !== "today"}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink disabled:hidden"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-75">No notes yet</p>
              )}
              {selectedDateMode === "today" ? (
                <>
                  <textarea value={newNoteText} onChange={(event) => setNewNoteText(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-claret/30 bg-pink px-3 py-2 tracking-normal" />
                  <button type="button" onClick={addNoteDraft} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">
                    <Plus className="size-4" /> Note
                  </button>
                </>
              ) : null}
            </section>
            ) : null}
          </ModalBody>
          {selectedDateMode === "today" ? (
            <ModalFooter>
              <button type="button" onClick={saveDay} disabled={isSavingDay} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 disabled:cursor-not-allowed disabled:opacity-60">
                <Save className="size-4" /> Save Day
              </button>
            </ModalFooter>
          ) : null}
        </ModalFrame>
      ) : null}

      <DeleteConfirmationModal
        open={Boolean(deletingChallenge)}
        onClose={() => setDeletingChallenge(null)}
        itemName={deletingChallenge?.title || ""}
        itemType="challenge"
        onConfirm={removeChallenge}
      />
    </Layout>
  );
}
