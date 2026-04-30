import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

type CustomDateInputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDateValue = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayValue = (value: string) => {
  const parsed = toDate(value);
  if (!parsed) return "";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

export default function CustomDateInput({
  value,
  defaultValue,
  onChange,
  placeholder = "Select date",
  className = "",
}: CustomDateInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  const selectedValue = isControlled ? value ?? "" : internalValue;
  const selectedDate = toDate(selectedValue);

  const [viewDate, setViewDate] = useState<Date>(() => selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
  }, [selectedDate]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, width: 288 });

  const computePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    // Cap width: never wider than 280px and never wider than the viewport
    const width = Math.min(280, window.innerWidth - margin * 2);

    // Horizontal: align with trigger left, shift left if it would overflow right edge
    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    left = Math.max(margin, left);

    // Vertical: use actual panel height (available via ref) or fall back to estimate
    const panelHeight = panelRef.current?.offsetHeight ?? 330;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    let top: number;
    if (spaceBelow >= panelHeight || spaceBelow >= spaceAbove) {
      // Open below
      top = rect.bottom + gap;
    } else {
      // Flip above
      top = rect.top - panelHeight - gap;
    }
    // Hard-clamp so panel never escapes viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - panelHeight - margin));

    setPanelPosition({ top, left, width });
  };

  // Runs synchronously after DOM mutations (portal is mounted) — no visible flash
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    window.addEventListener("resize", computePosition);
    window.addEventListener("scroll", computePosition, true);
    return () => {
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("scroll", computePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(calendarStart);
        d.setDate(calendarStart.getDate() + i);
        return d;
      }),
    [calendarStart]
  );

  const today = new Date();
  const todayValue = formatDateValue(today);

  const commitValue = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-claret/30 bg-pink px-3 py-2 text-left text-claret focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
      >
        <span className={selectedValue ? "text-claret" : "text-claret/70"}>
          {selectedValue ? formatDisplayValue(selectedValue) : placeholder}
        </span>
        <CalendarDays className="size-4" />
      </button>

      {open
        ? ReactDOM.createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPosition.top, left: panelPosition.left, width: panelPosition.width }}
          className="fixed z-60 max-h-[calc(100vh-1rem)] overflow-y-auto hide-scrollbar rounded-2xl border border-claret/25 bg-pink p-3 text-claret shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-claret/30 hover:bg-claret hover:text-pink"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>

            <p className="text-sm font-bold uppercase tracking-widest">
              {viewDate.toLocaleString("en-NG", { month: "long", year: "numeric" })}
            </p>

            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-claret/30 hover:bg-claret hover:text-pink"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_DAYS.map((day) => (
              <span key={day} className="pb-1 text-xs uppercase tracking-widest opacity-70">
                {day}
              </span>
            ))}

            {days.map((day) => {
              const dayValue = formatDateValue(day);
              const inCurrentMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = dayValue === selectedValue;
              const isToday = dayValue === todayValue;

              return (
                <button
                  key={dayValue}
                  type="button"
                  onClick={() => {
                    commitValue(dayValue);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? "bg-claret text-pink"
                      : isToday
                        ? "border border-claret/50"
                        : "hover:bg-claret/10"
                  } ${inCurrentMonth ? "opacity-100" : "opacity-45"}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                commitValue(todayValue);
                setViewDate(today);
                setOpen(false);
              }}
              className="rounded-xl border border-claret bg-claret px-3 py-2 text-xs uppercase tracking-widest text-pink hover:bg-claret/90"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => commitValue("")}
              className="rounded-xl border border-claret px-3 py-2 text-xs uppercase tracking-widest hover:bg-claret hover:text-pink"
            >
              Clear
            </button>
          </div>
        </div>,
          document.body
        )
        : null}
    </div>
  );
}
