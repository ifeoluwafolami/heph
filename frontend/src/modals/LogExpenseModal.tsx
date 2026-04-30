import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import CustomDateInput from "@/components/CustomDateInput";
import { Plus } from "lucide-react";
import { useState } from "react";
import { createExpense } from "@/lib/api";
import { useToast } from "@/components/Toast";

type LogExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  categoryName: string;
  categoryId?: string | null;
};

export default function LogExpenseModal({ open, onClose, categoryName, categoryId }: LogExpenseModalProps) {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const toast = useToast()

  if (!open) return null;

  async function handleSave() {
    const amt = Number(amount)
    if (!amt || !date) return

    try {
      const payload: any = { title: title || categoryName, amount: amt, expenseDate: date }
      if (note) payload.note = note
      // prefer passing categoryId if available
      if (categoryId) payload.categoryId = categoryId
      else payload.categoryName = categoryName

      await createExpense(payload)
      toast.push({ type: 'success', message: 'Expense logged' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'expense' } }))
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Log Expense — {categoryName}</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Expense Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Grocery run" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Amount</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="0.00" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Date</span>
          <CustomDateInput value={date} onChange={(v) => setDate(v)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Notes</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24 w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="Optional note" />
        </label>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"
        >
          <Plus className="size-4" />
          Save Log
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
