import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { useState, useEffect } from "react";
import { updateBudgetsBulk } from "@/lib/api";
import { useToast } from "@/components/Toast";

type BudgetItem = {
  _id?: string;
  name: string;
  monthlyBudget: number;
  spentAmount?: number;
};

type EditBudgetsModalProps = {
  open: boolean;
  onClose: () => void;
  budgets: BudgetItem[];
};

export default function EditBudgetsModal({ open, onClose, budgets }: EditBudgetsModalProps) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setItems(budgets.map(b => ({ _id: b._id, name: b.name, monthlyBudget: Number(b.monthlyBudget || b.monthlyBudget || 0), spentAmount: b.spentAmount || 0 })))
  }, [open, budgets])

  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit Budgets</ModalHead>
      <ModalBody>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name} className="rounded-xl border border-claret/25 bg-claret/95 p-4 text-pink">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{item.name}</p>
                <p className="text-sm opacity-80">Spent: N{Number(item.spentAmount || 0).toFixed(0)}</p>
              </div>
              <label className="mt-2 block space-y-1">
                <span className="text-xs uppercase tracking-widest opacity-80">Monthly Budget</span>
                <input
                  value={item.monthlyBudget}
                  onChange={(e) => setItems(items.map(x => x.name === item.name ? { ...x, monthlyBudget: Number(e.target.value || 0) } : x))}
                  className="w-full rounded-xl border border-pink/40 bg-pink px-3 py-2 text-claret"
                />
              </label>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={async () => {
            setLoading(true)
            try {
              const payload = items.filter(i => i._id).map(i => ({ id: i._id!, monthlyBudget: i.monthlyBudget }))
              await updateBudgetsBulk(payload)
              toast.push({ type: 'success', message: 'Budgets updated' })
              window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'budget' } }))
              onClose()
            } catch (err) {
              console.error(err)
            } finally { setLoading(false) }
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"
          disabled={loading}
        >
          Save Changes
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
