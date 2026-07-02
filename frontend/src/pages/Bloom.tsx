import Layout from "@/components/Layout";
import CustomDateInput from "@/components/CustomDateInput";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  createBloomCourse,
  createBloomCourseLog,
  createBloomDeepDive,
  createBloomDeepDiveLog,
  createBloomPlan,
  deleteBloomCourse,
  deleteBloomCourseLog,
  deleteBloomDeepDive,
  deleteBloomDeepDiveLog,
  deleteBloomPlan,
  getBloomCourses,
  getBloomDeepDives,
  getBloomPlans,
  updateBloomCourse,
  updateBloomDeepDive,
  updateBloomPlan,
  type BloomCourseDto,
  type BloomDeepDiveDto,
  type BloomDeepDiveReferenceDto,
  type BloomPlanDto,
} from "@/lib/api";
import { Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, GraduationCap, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PLAN_COLORS = [
  { name: "Claret", value: "#670626" },
  { name: "Rose", value: "#be185d" },
  { name: "Gold", value: "#b45309" },
  { name: "Green", value: "#047857" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Violet", value: "#7c3aed" },
];

type BloomTab = "calendar" | "learning";
type LearningTab = "courses" | "deep-dives";
type ReferenceDraft = { id: string; label: string; url: string };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function makeReferenceDraft(reference?: BloomDeepDiveReferenceDto): ReferenceDraft {
  return {
    id: reference?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: reference?.label || "",
    url: reference?.url || "",
  };
}

function getQuarterStart(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function getQuarterMonths(start: Date) {
  return [0, 1, 2].map((offset) => new Date(start.getFullYear(), start.getMonth() + offset, 1));
}

function getQuarterMonthIndex(date: Date) {
  return date.getMonth() % 3;
}

function getMonthCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export default function Bloom() {
  const toast = useToast();
  const eventPanelRef = useRef<HTMLDivElement | null>(null);
  const [plans, setPlans] = useState<BloomPlanDto[]>([]);
  const [quarterStart, setQuarterStart] = useState(() => getQuarterStart(new Date()));
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [color, setColor] = useState(PLAN_COLORS[0].value);
  const [notes, setNotes] = useState("");
  const [editingPlan, setEditingPlan] = useState<BloomPlanDto | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(() => getQuarterMonthIndex(new Date()));
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [isEventPanelPinned, setIsEventPanelPinned] = useState(false);
  const [activeBloomTab, setActiveBloomTab] = useState<BloomTab>("calendar");
  const [activeLearningTab, setActiveLearningTab] = useState<LearningTab>("courses");
  const [courses, setCourses] = useState<BloomCourseDto[]>([]);
  const [deepDives, setDeepDives] = useState<BloomDeepDiveDto[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseHours, setCourseHours] = useState("");
  const [courseMinutes, setCourseMinutes] = useState("");
  const [editingCourse, setEditingCourse] = useState<BloomCourseDto | null>(null);
  const [courseLogHoursById, setCourseLogHoursById] = useState<Record<string, string>>({});
  const [courseLogMinutesById, setCourseLogMinutesById] = useState<Record<string, string>>({});
  const [courseLogDateById, setCourseLogDateById] = useState<Record<string, string>>({});
  const [deepDiveTopic, setDeepDiveTopic] = useState("");
  const [deepDiveTidbits, setDeepDiveTidbits] = useState("");
  const [deepDiveReferences, setDeepDiveReferences] = useState<ReferenceDraft[]>([makeReferenceDraft()]);
  const [editingDeepDive, setEditingDeepDive] = useState<BloomDeepDiveDto | null>(null);
  const [deepDiveLogHoursById, setDeepDiveLogHoursById] = useState<Record<string, string>>({});
  const [deepDiveLogMinutesById, setDeepDiveLogMinutesById] = useState<Record<string, string>>({});
  const [deepDiveLogDateById, setDeepDiveLogDateById] = useState<Record<string, string>>({});
  const quarterMonths = useMemo(() => getQuarterMonths(quarterStart), [quarterStart]);
  const visibleMonth = quarterMonths[visibleMonthIndex] || quarterMonths[0];
  const plansByDate = useMemo(() => {
    return plans.reduce<Record<string, BloomPlanDto[]>>((groups, plan) => {
      groups[plan.date] = [...(groups[plan.date] || []), plan];
      return groups;
    }, {});
  }, [plans]);
  const upcomingPlans = useMemo(() => {
    const start = parseDateKey(todayKey()).getTime();
    const end = start + 7 * 24 * 60 * 60 * 1000;
    return plans
      .filter((plan) => {
        const time = parseDateKey(plan.date).getTime();
        return time >= start && time <= end;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [plans]);
  const quarterLabel = `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`;
  const activeDatePlans = activeDateKey ? plansByDate[activeDateKey] || [] : [];
  const courseStats = useMemo(() => {
    const totalRequired = courses.reduce((sum, course) => sum + course.durationMinutes, 0);
    const totalLogged = courses.reduce((sum, course) => sum + (course.logs || []).reduce((logSum, log) => logSum + log.minutes, 0), 0);
    return {
      totalRequired,
      totalLogged,
      percent: totalRequired > 0 ? Math.min(100, Math.round((totalLogged / totalRequired) * 100)) : 0,
    };
  }, [courses]);

  function canUseHoverPreview() {
    return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  useEffect(() => {
    let mounted = true;
    const start = toDateKey(quarterMonths[0]);
    const lastMonth = quarterMonths[quarterMonths.length - 1];
    const end = toDateKey(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0));

    async function loadPlans() {
      try {
        const items = await getBloomPlans(start, end);
        if (mounted) setPlans(items);
      } catch (err) {
        console.error(err);
        if (mounted) toast.push({ type: "error", message: "Could not load Bloom plans." });
      }
    }

    loadPlans();
    return () => { mounted = false };
  }, [quarterMonths, toast]);

  useEffect(() => {
    if (!activeDateKey) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (eventPanelRef.current?.contains(target)) return;
      closeDayEvents();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeDateKey]);

  useEffect(() => {
    let mounted = true;

    async function loadLearning() {
      try {
        const [courseItems, deepDiveItems] = await Promise.all([getBloomCourses(), getBloomDeepDives()]);
        if (!mounted) return;
        setCourses(courseItems);
        setDeepDives(deepDiveItems);
      } catch (err) {
        console.error(err);
        if (mounted) toast.push({ type: "error", message: "Could not load Bloom learning." });
      }
    }

    loadLearning();
    return () => { mounted = false };
  }, [toast]);

  async function addPlan() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      const created = await createBloomPlan({
        title: cleanTitle,
        date,
        color,
        notes: notes.trim() || undefined,
      });
      setPlans((current) => [...current, created].sort((a, b) => a.date.localeCompare(b.date)));
      window.dispatchEvent(new CustomEvent("heph:bloom:changed"));
      closePlanModal();
      toast.push({ type: "success", message: "Bloom plan added." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not add Bloom plan." });
    }
  }

  async function removePlan(id: string) {
    try {
      await deleteBloomPlan(id);
      setPlans((current) => current.filter((plan) => plan._id !== id));
      setActiveDateKey((current) => {
        if (!current) return current;
        const hasRemainingPlans = plans.some((plan) => plan._id !== id && plan.date === current);
        if (!hasRemainingPlans) setIsEventPanelPinned(false);
        return hasRemainingPlans ? current : null;
      });
      window.dispatchEvent(new CustomEvent("heph:bloom:changed"));
      toast.push({ type: "success", message: "Bloom plan removed." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not remove Bloom plan." });
    }
  }

  function moveQuarter(direction: -1 | 1) {
    setQuarterStart(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + direction * 3, 1));
    setVisibleMonthIndex(direction === 1 ? 0 : 2);
  }

  function moveMonth(direction: -1 | 1) {
    setActiveDateKey(null);
    setIsEventPanelPinned(false);
    setVisibleMonthIndex((current) => {
      const next = current + direction;
      if (next >= 0 && next < quarterMonths.length) return next;
      setQuarterStart(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + direction * 3, 1));
      return direction === 1 ? 0 : 2;
    });
  }

  function beginEdit(plan: BloomPlanDto) {
    setActiveDateKey(null);
    setIsEventPanelPinned(false);
    setEditingPlan(plan);
    setTitle(plan.title);
    setDate(plan.date);
    setColor(plan.color);
    setNotes(plan.notes || "");
    setIsPlanModalOpen(true);
  }

  function resetForm() {
    setEditingPlan(null);
    setTitle("");
    setDate(todayKey());
    setColor(PLAN_COLORS[0].value);
    setNotes("");
  }

  function openNewPlanModal() {
    resetForm();
    setIsPlanModalOpen(true);
  }

  function closePlanModal() {
    setIsPlanModalOpen(false);
    resetForm();
  }

  async function savePlan() {
    if (editingPlan) {
      await updatePlan();
      return;
    }
    await addPlan();
  }

  async function updatePlan() {
    if (!editingPlan) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      const updated = await updateBloomPlan(editingPlan._id, {
        title: cleanTitle,
        date,
        color,
        notes: notes.trim() || undefined,
      });
      setPlans((current) => current.map((plan) => plan._id === updated._id ? updated : plan).sort((a, b) => a.date.localeCompare(b.date)));
      window.dispatchEvent(new CustomEvent("heph:bloom:changed"));
      closePlanModal();
      toast.push({ type: "success", message: "Bloom plan updated." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not update Bloom plan." });
    }
  }

  function handleTouchEnd(endX: number) {
    if (touchStartX === null) return;
    const delta = touchStartX - endX;
    setTouchStartX(null);
    if (Math.abs(delta) < 40) return;
    moveMonth(delta > 0 ? 1 : -1);
  }

  function showDayEvents(dateKey: string, persist = false) {
    setActiveDateKey(dateKey);
    setIsEventPanelPinned(persist);
  }

  function closeDayEvents() {
    setActiveDateKey(null);
    setIsEventPanelPinned(false);
  }

  function resetCourseForm() {
    setEditingCourse(null);
    setCourseTitle("");
    setCourseHours("");
    setCourseMinutes("");
  }

  function beginEditCourse(course: BloomCourseDto) {
    setEditingCourse(course);
    setCourseTitle(course.title);
    setCourseHours(String(Math.floor(course.durationMinutes / 60)));
    setCourseMinutes(String(course.durationMinutes % 60));
  }

  async function saveCourse() {
    const cleanTitle = courseTitle.trim();
    const durationMinutes = (Number(courseHours) || 0) * 60 + (Number(courseMinutes) || 0);
    if (!cleanTitle || durationMinutes < 1) return;
    try {
      if (editingCourse) {
        const updated = await updateBloomCourse(editingCourse._id, { title: cleanTitle, durationMinutes });
        setCourses((current) => current.map((course) => course._id === updated._id ? updated : course));
        toast.push({ type: "success", message: "Course updated." });
      } else {
        const created = await createBloomCourse({ title: cleanTitle, durationMinutes });
        setCourses((current) => [created, ...current]);
        toast.push({ type: "success", message: "Course added." });
      }
      resetCourseForm();
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not save course." });
    }
  }

  async function removeCourse(id: string) {
    try {
      await deleteBloomCourse(id);
      setCourses((current) => current.filter((course) => course._id !== id));
      if (editingCourse?._id === id) resetCourseForm();
      toast.push({ type: "success", message: "Course removed." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not remove course." });
    }
  }

  async function logCourseTime(courseId: string) {
    const minutes = (Number(courseLogHoursById[courseId]) || 0) * 60 + (Number(courseLogMinutesById[courseId]) || 0);
    const logDate = courseLogDateById[courseId] || todayKey();
    if (minutes < 1) return;
    try {
      const updated = await createBloomCourseLog(courseId, { date: logDate, minutes });
      setCourses((current) => current.map((course) => course._id === updated._id ? updated : course));
      setCourseLogHoursById((current) => ({ ...current, [courseId]: "" }));
      setCourseLogMinutesById((current) => ({ ...current, [courseId]: "" }));
      setCourseLogDateById((current) => ({ ...current, [courseId]: todayKey() }));
      toast.push({ type: "success", message: "Progress logged." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not log progress." });
    }
  }

  async function removeCourseLog(courseId: string, logId: string) {
    try {
      const updated = await deleteBloomCourseLog(courseId, logId);
      setCourses((current) => current.map((course) => course._id === updated._id ? updated : course));
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not remove progress log." });
    }
  }

  function resetDeepDiveForm() {
    setEditingDeepDive(null);
    setDeepDiveTopic("");
    setDeepDiveTidbits("");
    setDeepDiveReferences([makeReferenceDraft()]);
  }

  function beginEditDeepDive(deepDive: BloomDeepDiveDto) {
    setEditingDeepDive(deepDive);
    setDeepDiveTopic(deepDive.topic);
    setDeepDiveTidbits(deepDive.tidbits || "");
    setDeepDiveReferences(deepDive.references.length ? deepDive.references.map(makeReferenceDraft) : [makeReferenceDraft()]);
  }

  function updateReferenceDraft(id: string, update: Partial<ReferenceDraft>) {
    setDeepDiveReferences((current) => current.map((reference) => reference.id === id ? { ...reference, ...update } : reference));
  }

  function addReferenceDraft() {
    setDeepDiveReferences((current) => [...current, makeReferenceDraft()]);
  }

  function removeReferenceDraft(id: string) {
    setDeepDiveReferences((current) => current.length > 1 ? current.filter((reference) => reference.id !== id) : [makeReferenceDraft()]);
  }

  async function saveDeepDive() {
    const topic = deepDiveTopic.trim();
    if (!topic) return;
    const references = deepDiveReferences
      .map((reference) => ({ id: reference.id, label: reference.label.trim(), url: reference.url.trim() }))
      .filter((reference) => reference.url);
    try {
      if (editingDeepDive) {
        const updated = await updateBloomDeepDive(editingDeepDive._id, { topic, tidbits: deepDiveTidbits.trim(), references });
        setDeepDives((current) => current.map((deepDive) => deepDive._id === updated._id ? updated : deepDive));
        toast.push({ type: "success", message: "Deep dive updated." });
      } else {
        const created = await createBloomDeepDive({ topic, tidbits: deepDiveTidbits.trim(), references });
        setDeepDives((current) => [created, ...current]);
        toast.push({ type: "success", message: "Deep dive added." });
      }
      resetDeepDiveForm();
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not save deep dive." });
    }
  }

  async function removeDeepDive(id: string) {
    try {
      await deleteBloomDeepDive(id);
      setDeepDives((current) => current.filter((deepDive) => deepDive._id !== id));
      if (editingDeepDive?._id === id) resetDeepDiveForm();
      toast.push({ type: "success", message: "Deep dive removed." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not remove deep dive." });
    }
  }

  async function logDeepDiveTime(deepDiveId: string) {
    const minutes = (Number(deepDiveLogHoursById[deepDiveId]) || 0) * 60 + (Number(deepDiveLogMinutesById[deepDiveId]) || 0);
    const logDate = deepDiveLogDateById[deepDiveId] || todayKey();
    if (minutes < 1) return;
    try {
      const updated = await createBloomDeepDiveLog(deepDiveId, { date: logDate, minutes });
      setDeepDives((current) => current.map((deepDive) => deepDive._id === updated._id ? updated : deepDive));
      setDeepDiveLogHoursById((current) => ({ ...current, [deepDiveId]: "" }));
      setDeepDiveLogMinutesById((current) => ({ ...current, [deepDiveId]: "" }));
      setDeepDiveLogDateById((current) => ({ ...current, [deepDiveId]: todayKey() }));
      toast.push({ type: "success", message: "Deep dive time logged." });
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not log deep dive time." });
    }
  }

  async function removeDeepDiveLog(deepDiveId: string, logId: string) {
    try {
      const updated = await deleteBloomDeepDiveLog(deepDiveId, logId);
      setDeepDives((current) => current.map((deepDive) => deepDive._id === updated._id ? updated : deepDive));
    } catch (err) {
      console.error(err);
      toast.push({ type: "error", message: "Could not remove deep dive log." });
    }
  }

  return (
    <Layout>
      <section className="w-full space-y-6">
        <div className="rounded-2xl bg-pink text-claret p-6 md:p-8 shadow-xl border border-claret/20">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-5xl font-bold uppercase">Bloom</h1>
              </div>
              <p className="mt-2 max-w-3xl text-lg md:text-2xl tracking-normal">
                A quarterly planning calendar for color-coded patterns, plans, and near-term reminders.
              </p>
            </div>
            {activeBloomTab === "calendar" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveQuarter(-1)}
                aria-label="Previous quarter"
                title="Previous quarter"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
              >
                <ChevronLeft className="size-5" />
              </button>
              <p className="min-w-28 text-center text-2xl font-bold uppercase">{quarterLabel}</p>
              <button
                type="button"
                onClick={() => moveQuarter(1)}
                aria-label="Next quarter"
                title="Next quarter"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            ) : null}
          </div>
        </div>

        <div className="mb-4 flex rounded-2xl border border-pink/30 bg-pink/10 p-1 text-pink">
          <button
            type="button"
            onClick={() => setActiveBloomTab("calendar")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm uppercase tracking-widest transition-all ${activeBloomTab === "calendar" ? "bg-pink text-claret" : "hover:bg-pink/10"}`}
          >
            <CalendarDays className="size-4" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveBloomTab("learning")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm uppercase tracking-widest transition-all ${activeBloomTab === "learning" ? "bg-pink text-claret" : "hover:bg-pink/10"}`}
          >
            <GraduationCap className="size-4" />
            Learning
          </button>
        </div>

        {activeBloomTab === "calendar" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl bg-pink text-claret p-6 shadow-xl border border-claret/20">
              <h2 className="text-2xl font-bold uppercase">Plans</h2>
              <button
                type="button"
                onClick={openNewPlanModal}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90"
              >
                <Plus className="size-4" />
                New Plan
              </button>
            </div>

            <div className="rounded-2xl bg-pink text-claret p-6 shadow-xl border border-claret/20">
              <div className="flex items-center gap-2">
                <Bell className="size-5" />
                <h2 className="text-2xl font-bold uppercase">Upcoming</h2>
              </div>
              <div className="hide-scrollbar mt-4 h-72 space-y-2 overflow-y-auto pr-1">
                {upcomingPlans.length ? upcomingPlans.map((plan) => (
                  <div key={plan._id} className="rounded-xl border border-claret/30 p-3">
                    <p className="text-sm uppercase tracking-widest opacity-75">{new Date(`${plan.date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <p className="text-lg leading-tight">{plan.title}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-70">Nothing queued</p>
                )}
              </div>
            </div>
          </aside>

          <div
            className="relative"
            onMouseLeave={() => {
              if (!isEventPanelPinned) setActiveDateKey(null);
            }}
          >
            <section
              className="rounded-2xl bg-pink text-claret p-3 shadow-xl border border-claret/20 sm:p-4"
              onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
                <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                  <div>
                    <h2 className="text-2xl font-bold uppercase">{visibleMonth.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</h2>
                    <p className="mt-1 text-xs uppercase tracking-widest opacity-75 sm:text-sm">Swipe or use arrows to move through this quarter</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveMonth(-1)}
                      aria-label="Previous month"
                      title="Previous month"
                      className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <div className="flex gap-1">
                      {quarterMonths.map((month, index) => (
                        <button
                          key={month.toISOString()}
                          type="button"
                          onClick={() => setVisibleMonthIndex(index)}
                          aria-label={`Show ${month.toLocaleDateString("en-NG", { month: "long" })}`}
                          title={month.toLocaleDateString("en-NG", { month: "long" })}
                          className={`size-2.5 rounded-full ${index === visibleMonthIndex ? "bg-claret" : "bg-claret/30"}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => moveMonth(1)}
                      aria-label="Next month"
                      title="Next month"
                      className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest opacity-75 sm:text-xs">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {getMonthCells(visibleMonth).map((cell) => {
                    const key = toDateKey(cell);
                    const dayPlans = plansByDate[key] || [];
                    const isCurrentMonth = cell.getMonth() === visibleMonth.getMonth();
                    return (
                      <div
                        key={key}
                        className={`h-16 rounded-lg border p-1 sm:h-24 sm:p-1.5 ${isCurrentMonth ? "border-claret/20" : "border-claret/10 opacity-40"}`}
                        onMouseEnter={() => {
                          if (dayPlans.length > 0 && !isEventPanelPinned && canUseHoverPreview()) showDayEvents(key);
                          if (dayPlans.length === 0 && !isEventPanelPinned && canUseHoverPreview()) setActiveDateKey(null);
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (dayPlans.length > 0) showDayEvents(key, true);
                          }}
                          className="flex h-full w-full flex-col items-start justify-between text-left"
                        >
                          <span className="text-xs font-bold sm:text-sm">{cell.getDate()}</span>
                          <span className="flex min-h-5 w-full flex-wrap content-end items-end gap-1 overflow-hidden">
                            {dayPlans.slice(0, 6).map((plan) => (
                              <span
                                key={plan._id}
                                className="size-2.5 rounded-full sm:size-3"
                                style={{ backgroundColor: plan.color }}
                              />
                            ))}
                            {dayPlans.length > 6 ? <span className="text-[10px] font-bold leading-none">+{dayPlans.length - 6}</span> : null}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
              {activeDateKey && activeDatePlans.length > 0 ? (
                <div ref={eventPanelRef} className="fixed inset-x-3 bottom-4 z-40 rounded-2xl border border-claret/20 bg-pink p-4 text-claret shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:w-80">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-widest opacity-75">
                        {new Date(`${activeDateKey}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long", month: "short", day: "numeric" })}
                      </p>
                      <h3 className="text-2xl font-bold uppercase">Events</h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeDayEvents}
                      aria-label="Close events"
                      title="Close events"
                      className="inline-flex size-8 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {activeDatePlans.map((plan) => (
                      <article key={plan._id} className="rounded-xl border border-claret/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: plan.color }} />
                              <p className="truncate text-lg font-bold">{plan.title}</p>
                            </div>
                            {plan.notes ? <p className="mt-1 whitespace-pre-wrap text-sm tracking-normal opacity-80">{plan.notes}</p> : null}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => beginEdit(plan)}
                              aria-label={`Edit ${plan.title}`}
                              title={`Edit ${plan.title}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-claret/40 hover:bg-claret hover:text-pink"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePlan(plan._id)}
                              aria-label={`Delete ${plan.title}`}
                              title={`Delete ${plan.title}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-claret/40 hover:bg-claret hover:text-pink"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
          </div>
        </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-6" />
                    <h2 className="text-3xl font-bold uppercase">Learning</h2>
                  </div>
                  <p className="mt-2 text-lg tracking-normal">Track course hours and collect the curious trails worth remembering.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-claret/20 p-3">
                    <p className="text-xs uppercase tracking-widest opacity-75">Logged</p>
                    <p className="mt-1 text-2xl font-bold">{formatDuration(courseStats.totalLogged)}</p>
                  </div>
                  <div className="rounded-xl border border-claret/20 p-3">
                    <p className="text-xs uppercase tracking-widest opacity-75">Course Load</p>
                    <p className="mt-1 text-2xl font-bold">{formatDuration(courseStats.totalRequired)}</p>
                  </div>
                  <div className="rounded-xl border border-claret/20 p-3">
                    <p className="text-xs uppercase tracking-widest opacity-75">Progress</p>
                    <p className="mt-1 text-2xl font-bold">{courseStats.percent}%</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mb-4 flex rounded-2xl border border-pink/30 bg-pink/10 p-1 text-pink">
              <button
                type="button"
                onClick={() => setActiveLearningTab("courses")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm uppercase tracking-widest transition-all ${activeLearningTab === "courses" ? "bg-pink text-claret" : "hover:bg-pink/10"}`}
              >
                <BookOpen className="size-4" />
                Course Progress
              </button>
              <button
                type="button"
                onClick={() => setActiveLearningTab("deep-dives")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm uppercase tracking-widest transition-all ${activeLearningTab === "deep-dives" ? "bg-pink text-claret" : "hover:bg-pink/10"}`}
              >
                <Search className="size-4" />
                Deep Dives
              </button>
            </div>

            {activeLearningTab === "courses" ? (
              <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
                <section className="rounded-2xl bg-pink p-6 text-claret shadow-xl">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-5" />
                    <h3 className="text-2xl font-bold uppercase">{editingCourse ? "Edit Course" : "New Course"}</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block space-y-1">
                      <span className="text-sm uppercase tracking-widest">Course Name</span>
                      <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-sm uppercase tracking-widest">Hours</span>
                        <input type="number" min={0} value={courseHours} onChange={(event) => setCourseHours(event.target.value)} className="no-number-spinner w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm uppercase tracking-widest">Minutes</span>
                        <input type="number" min={0} max={59} value={courseMinutes} onChange={(event) => setCourseMinutes(event.target.value)} className="no-number-spinner w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={saveCourse} disabled={!courseTitle.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 disabled:opacity-40">
                        {editingCourse ? <Save className="size-4" /> : <Plus className="size-4" />}
                        {editingCourse ? "Save" : "Add"}
                      </button>
                      {editingCourse ? (
                        <button type="button" onClick={resetCourseForm} className="rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">Cancel</button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-pink p-4 text-claret shadow-xl md:p-6">
                  <div className="hide-scrollbar max-h-[680px] space-y-3 overflow-y-auto pr-1">
                    {courses.length ? courses.map((course) => {
                      const logged = (course.logs || []).reduce((sum, log) => sum + log.minutes, 0);
                      const percent = course.durationMinutes > 0 ? Math.min(100, Math.round((logged / course.durationMinutes) * 100)) : 0;
                      return (
                        <article key={course._id} className="rounded-xl border border-claret/20 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <h4 className="break-words text-2xl font-bold">{course.title}</h4>
                              <p className="mt-1 text-xs uppercase tracking-widest opacity-75">{formatDuration(logged)} / {formatDuration(course.durationMinutes)}</p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button type="button" onClick={() => beginEditCourse(course)} aria-label={`Edit ${course.title}`} title="Edit course" className="inline-flex size-9 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"><Pencil className="size-4" /></button>
                              <button type="button" onClick={() => removeCourse(course._id)} aria-label={`Delete ${course.title}`} title="Delete course" className="inline-flex size-9 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"><Trash2 className="size-4" /></button>
                            </div>
                          </div>
                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-claret/20">
                            <div className="h-full rounded-full bg-claret" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_96px_96px_auto]">
                            <CustomDateInput value={courseLogDateById[course._id] || todayKey()} onChange={(value) => setCourseLogDateById((current) => ({ ...current, [course._id]: value || todayKey() }))} />
                            <input type="number" min={0} value={courseLogHoursById[course._id] || ""} onChange={(event) => setCourseLogHoursById((current) => ({ ...current, [course._id]: event.target.value }))} placeholder="Hours" className="no-number-spinner min-w-0 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                            <input type="number" min={0} max={59} value={courseLogMinutesById[course._id] || ""} onChange={(event) => setCourseLogMinutesById((current) => ({ ...current, [course._id]: event.target.value }))} placeholder="Mins" className="no-number-spinner min-w-0 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                            <button type="button" onClick={() => logCourseTime(course._id)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink sm:w-auto"><Clock className="size-4" /> Log</button>
                          </div>
                          {course.logs?.length ? (
                            <div className="hide-scrollbar mt-4 max-h-36 space-y-2 overflow-y-auto pr-1">
                              {[...course.logs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => (
                                <div key={log.id} className="flex items-center justify-between gap-3 rounded-xl border border-claret/20 px-3 py-2">
                                  <p className="text-sm">{parseDateKey(log.date).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold">{formatDuration(log.minutes)}</p>
                                    <button type="button" onClick={() => removeCourseLog(course._id, log.id)} aria-label="Remove log" title="Remove log" className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-claret hover:text-pink"><X className="size-4" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      );
                    }) : (
                      <p className="rounded-xl border border-dashed border-claret/30 p-4 text-sm uppercase tracking-widest opacity-70">No courses yet</p>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
                <section className="rounded-2xl bg-pink p-6 text-claret shadow-xl">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-5" />
                    <h3 className="text-2xl font-bold uppercase">{editingDeepDive ? "Edit Deep Dive" : "New Deep Dive"}</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block space-y-1">
                      <span className="text-sm uppercase tracking-widest">Topic</span>
                      <input value={deepDiveTopic} onChange={(event) => setDeepDiveTopic(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm uppercase tracking-widest">Tidbits</span>
                      <textarea value={deepDiveTidbits} onChange={(event) => setDeepDiveTidbits(event.target.value)} rows={7} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                    </label>
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-widest">References</p>
                      {deepDiveReferences.map((reference) => (
                        <div key={reference.id} className="grid gap-2 rounded-xl border border-claret/20 p-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input value={reference.label} onChange={(event) => updateReferenceDraft(reference.id, { label: event.target.value })} placeholder="Label" className="min-w-0 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                          <input value={reference.url} onChange={(event) => updateReferenceDraft(reference.id, { url: event.target.value })} placeholder="https://" className="min-w-0 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                          <button type="button" onClick={() => removeReferenceDraft(reference.id)} aria-label="Remove reference" title="Remove reference" className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink sm:size-10"><Trash2 className="size-4" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={addReferenceDraft} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"><Plus className="size-4" /> Reference</button>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={saveDeepDive} disabled={!deepDiveTopic.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 disabled:opacity-40">
                        {editingDeepDive ? <Save className="size-4" /> : <Plus className="size-4" />}
                        {editingDeepDive ? "Save" : "Add"}
                      </button>
                      {editingDeepDive ? (
                        <button type="button" onClick={resetDeepDiveForm} className="rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">Cancel</button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-pink p-4 text-claret shadow-xl md:p-6">
                  <div className="hide-scrollbar max-h-[720px] space-y-3 overflow-y-auto pr-1">
                    {deepDives.length ? deepDives.map((deepDive) => (
                      <article key={deepDive._id} className="rounded-xl border border-claret/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="break-words text-2xl font-bold">{deepDive.topic}</h4>
                            {deepDive.createdAt ? <p className="mt-1 text-xs uppercase tracking-widest opacity-75">{new Date(deepDive.createdAt).toLocaleDateString()}</p> : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => beginEditDeepDive(deepDive)} aria-label={`Edit ${deepDive.topic}`} title="Edit deep dive" className="inline-flex size-9 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"><Pencil className="size-4" /></button>
                            <button type="button" onClick={() => removeDeepDive(deepDive._id)} aria-label={`Delete ${deepDive.topic}`} title="Delete deep dive" className="inline-flex size-9 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink"><Trash2 className="size-4" /></button>
                          </div>
                        </div>
                        {deepDive.tidbits ? <p className="mt-3 whitespace-pre-wrap text-base tracking-normal">{deepDive.tidbits}</p> : null}
                        {deepDive.references?.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {deepDive.references.map((reference) => (
                              <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 break-all rounded-xl border border-claret/30 px-3 py-2 text-sm hover:bg-claret hover:text-pink">
                                <ExternalLink className="size-4" />
                                {reference.label || reference.url}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 rounded-xl border border-claret/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm uppercase tracking-widest opacity-75">Time Logged</p>
                            <p className="font-bold">{formatDuration((deepDive.logs || []).reduce((sum, log) => sum + log.minutes, 0))}</p>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_96px_96px_auto]">
                            <CustomDateInput value={deepDiveLogDateById[deepDive._id] || todayKey()} onChange={(value) => setDeepDiveLogDateById((current) => ({ ...current, [deepDive._id]: value || todayKey() }))} />
                            <input type="number" min={0} value={deepDiveLogHoursById[deepDive._id] || ""} onChange={(event) => setDeepDiveLogHoursById((current) => ({ ...current, [deepDive._id]: event.target.value }))} placeholder="Hours" className="no-number-spinner min-w-0 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                            <input type="number" min={0} max={59} value={deepDiveLogMinutesById[deepDive._id] || ""} onChange={(event) => setDeepDiveLogMinutesById((current) => ({ ...current, [deepDive._id]: event.target.value }))} placeholder="Mins" className="no-number-spinner min-w-0 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                            <button type="button" onClick={() => logDeepDiveTime(deepDive._id)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink sm:w-auto"><Clock className="size-4" /> Log</button>
                          </div>
                          {deepDive.logs?.length ? (
                            <div className="hide-scrollbar mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
                              {[...deepDive.logs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => (
                                <div key={log.id} className="flex items-center justify-between gap-3 rounded-xl border border-claret/20 px-3 py-2">
                                  <p className="text-sm">{parseDateKey(log.date).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold">{formatDuration(log.minutes)}</p>
                                    <button type="button" onClick={() => removeDeepDiveLog(deepDive._id, log.id)} aria-label="Remove deep dive log" title="Remove log" className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-claret hover:text-pink"><X className="size-4" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )) : (
                      <p className="rounded-xl border border-dashed border-claret/30 p-4 text-sm uppercase tracking-widest opacity-70">No deep dives yet</p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {isPlanModalOpen ? (
          <ModalFrame
            onClose={closePlanModal}
            shouldConfirmClose={() => (
              editingPlan
                ? title.trim() !== editingPlan.title ||
                  date !== editingPlan.date ||
                  color !== editingPlan.color ||
                  notes.trim() !== (editingPlan.notes || "")
                : Boolean(title.trim() || notes.trim())
            )}
          >
            <ModalHead>{editingPlan ? "Edit Plan" : "New Plan"}</ModalHead>
            <ModalBody>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Plan</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Date</span>
                <CustomDateInput value={date} onChange={(value) => setDate(value || todayKey())} />
              </label>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-widest">Color</p>
                <div className="grid grid-cols-6 gap-2">
                  {PLAN_COLORS.map((planColor) => (
                    <button
                      key={planColor.value}
                      type="button"
                      onClick={() => setColor(planColor.value)}
                      aria-label={planColor.name}
                      title={planColor.name}
                      className={`size-9 rounded-full border-2 ${color === planColor.value ? "border-claret" : "border-transparent"}`}
                      style={{ backgroundColor: planColor.value }}
                    />
                  ))}
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-sm uppercase tracking-widest">Notes</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
              </label>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={savePlan}
                disabled={!title.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingPlan ? <Save className="size-4" /> : <Plus className="size-4" />}
                {editingPlan ? "Save Plan" : "Add Plan"}
              </button>
            </ModalFooter>
          </ModalFrame>
        ) : null}
      </section>
    </Layout>
  );
}
