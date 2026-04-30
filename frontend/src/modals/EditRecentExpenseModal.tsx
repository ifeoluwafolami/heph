import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import CustomDateInput from "@/components/CustomDateInput";
import { Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { updateExpense } from "@/lib/api";

type ExpenseItem = {
  _id?: string;
  title: string;
  date: string;
  amount: string;
};

type EditRecentExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  expense: ExpenseItem | null;
};

const toDateValue = (input: string) => {
  if (!input) return "";

  const lower = input.trim().toLowerCase();
  const now = new Date();

  if (lower === "today") {
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth() + 1}`.padStart(2, "0");
    const dd = `${now.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  if (lower === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = `${yesterday.getMonth() + 1}`.padStart(2, "0");
    const dd = `${yesterday.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "";

  const yyyy = parsed.getFullYear();
  const mm = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const dd = `${parsed.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function EditRecentExpenseModal({ open, onClose, expense }: EditRecentExpenseModalProps) {
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [dateValue, setDateValue] = useState(toDateValue(expense?.date ?? ""));
  const toast = useToast()

  // sync when expense prop changes
  useEffect(() => {
    if (!expense) return
    setTitle(expense.title)
    setAmount(expense.amount)
    setDateValue(toDateValue(expense.date))
  }, [expense])

  if (!open || !expense) return null;

  function sanitizeAmount(v: string) {
    // allow digits and one dot
    let s = v.replace(/[^0-9.]/g, '')
    const parts = s.split('.')
    if (parts.length > 2) s = parts.shift() + '.' + parts.join('')
    return s
  }

  async function handleSave() {
    if (!expense._id) return;
    const amt = Number(amount || 0);
    try {
      await updateExpense(expense._id, { title, amount: amt, expenseDate: dateValue });
      toast.push({ type: 'success', message: 'Expense updated' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'expense' } }))
      onClose()
    } catch (err) {
      console.error(err);
      toast.push({ type: 'error', message: 'Failed to update expense' })
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit {expense.title} Expense</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Expense Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Amount</span>
          <input value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Date</span>
          <CustomDateInput value={dateValue} onChange={(v) => setDateValue(v)} />
        </label>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"
        >
          <Pencil className="size-4" />
          Save Expense
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
