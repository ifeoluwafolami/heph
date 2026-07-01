import Layout from "@/components/Layout";
import CustomDateInput from "@/components/CustomDateInput";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createBloomPlan, deleteBloomPlan, getBloomPlans, updateBloomPlan, type BloomPlanDto } from "@/lib/api";
import { Bell, ChevronLeft, ChevronRight, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PLAN_COLORS = [
  { name: "Claret", value: "#670626" },
  { name: "Rose", value: "#be185d" },
  { name: "Gold", value: "#b45309" },
  { name: "Green", value: "#047857" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Violet", value: "#7c3aed" },
];

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
          </div>
        </div>

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
