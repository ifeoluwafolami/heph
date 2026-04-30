import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { updateBudget } from "@/lib/api";
import { useToast } from "@/components/Toast";

type BudgetCategory = {
  _id?: string;
  name: string;
  spent: number;
  budget: number;
};

type EditBudgetModalProps = {
  open: boolean;
  onClose: () => void;
  category: BudgetCategory | null;
};

export default function EditBudgetModal({ open, onClose, category }: EditBudgetModalProps) {
  const [limit, setLimit] = useState(category?.budget ?? 0)
  const toast = useToast()

  useEffect(() => {
    if (!open || !category) return
    // prefer explicit keys that may come from backend
    const current = (category as any).budget ?? (category as any).monthlyBudget ?? 0
    setLimit(Number(current || 0))
  }, [open, category])

  if (!open || !category) return null;

  async function handleUpdate() {
    if (!category._id) return
    try {
      await updateBudget(category._id, { monthlyBudget: Number(limit) as any })
      toast.push({ type: 'success', message: 'Budget updated' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'budget' } }))
      onClose()
    } catch (err) {
      console.error(err)
      toast.push({ type: 'error', message: 'Failed to update budget' })
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit {category.name} Budget</ModalHead>
      <ModalBody>
        <div className="rounded-xl border border-claret/25 bg-claret/95 p-4 text-pink grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest opacity-80">Current Spend</p>
            <p className="text-2xl font-bold">N{Number((category as any).spent || 0).toFixed(0)}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest opacity-80">Current Limit</p>
            <p className="text-2xl font-bold">N{Number((category as any).budget ?? (category as any).monthlyBudget ?? 0).toFixed(0)}</p>
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Budget Limit</span>
          <input
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
          />
        </label>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={handleUpdate}
          className="flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"
        >
          <Pencil className="size-4" />
          Update Budget
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
