import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
};

export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className = "",
  label = "Page",
}: PaginationControlsProps) {
  const safeTotal = Math.max(1, totalPages);
  if (safeTotal <= 1) return null;

  return (
    <div className={`mt-4 flex items-center justify-center gap-4 ${className}`}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="inline-flex size-10 items-center justify-center rounded-xl border border-current disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Previous ${label.toLowerCase()}`}
        title={`Previous ${label.toLowerCase()}`}
      >
        <ChevronLeft className="size-5" />
      </button>
      <p className="text-sm uppercase tracking-widest">
        {page} / {safeTotal}
      </p>
      <button
        type="button"
        disabled={page >= safeTotal}
        onClick={() => onPageChange(Math.min(safeTotal, page + 1))}
        className="inline-flex size-10 items-center justify-center rounded-xl border border-current disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Next ${label.toLowerCase()}`}
        title={`Next ${label.toLowerCase()}`}
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
