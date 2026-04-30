import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Plus } from "lucide-react";
import { useState } from "react";
import { createBudget } from "@/lib/api";
import { useToast } from "@/components/Toast";

type NewBudgetModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function NewBudgetModal({ open, onClose }: NewBudgetModalProps) {
  const [name, setName] = useState("")
  const [limit, setLimit] = useState("")
  const toast = useToast()

  if (!open) return null;

  async function handleCreate() {
    const monthlyBudget = Number(limit)
    if (!name || !monthlyBudget) return
    try {
      const res = await createBudget({ name, monthlyBudget })
      toast.push({ type: 'success', message: 'Category created' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'budget' } }))
      onClose()
    } catch (err) {
      console.error(err)
      toast.push({ type: 'error', message: 'Failed to create' })
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>New Budget</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Category Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Groceries" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Monthly Limit</span>
          <input value={limit} onChange={(e) => setLimit(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="0.00" />
        </label>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"
        >
          <Plus className="size-4" />
          Create Budget
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
