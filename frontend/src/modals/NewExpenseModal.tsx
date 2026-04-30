import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import CustomDateInput from "@/components/CustomDateInput";
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { createExpense, getBudgets, createBudget } from "@/lib/api";
import { useToast } from "@/components/Toast";

type NewExpenseModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function NewExpenseModal({ open, onClose }: NewExpenseModalProps) {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [budgets, setBudgets] = useState<Array<{ _id: string; name: string }>>([])
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  const [creatingCategoryName, setCreatingCategoryName] = useState<string | null>(null)
  const [creatingCategoryBudget, setCreatingCategoryBudget] = useState<string>("")
  const [creatingCategoryLoading, setCreatingCategoryLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const budgets = await getBudgets()
        if (!mounted) return
        setCategories(budgets.map(b => b.name))
        setBudgets(budgets.map(b => ({ _id: b._id, name: b.name })))
        // load saved titles from localStorage
        const raw = localStorage.getItem('heph_saved_expense_titles')
        if (raw) {
          try { setSavedTitles(JSON.parse(raw) as string[]) } catch { /* ignore */ }
        }
      } catch (_err) {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  if (!open) return null;

  async function handleSave() {
    const amt = Number(amount)
    if (!title || !amt || !date) return

    try {
      // prefer sending categoryId if we have a matching budget
      const matched = budgets.find(b => b.name.toLowerCase() === (category || '').toLowerCase())
      const payload: any = { title, amount: amt, expenseDate: date }
      if (note) payload.note = note
      if (matched) payload.categoryId = matched._id
      else if (category) payload.categoryName = category

      await createExpense(payload)

      // save title for future suggestions
      try {
        const list = Array.from(new Set([title, ...savedTitles])).slice(0, 50)
        localStorage.setItem('heph_saved_expense_titles', JSON.stringify(list))
      } catch {}
      toast.push({ type: 'success', message: 'Expense created' })
      // notify app to refetch lists
      window.dispatchEvent(new CustomEvent('heph:expense:created', { detail: { expense: { title, amount: amt, category: matched?._id ?? null } } }))
      onClose()
    } catch (err) {
      console.error(err)
      toast.push({ type: 'error', message: 'Failed to create expense' })
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>New Expense</ModalHead>
      <ModalBody>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Expense Name</span>
            <input list="saved-expense-titles" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Grocery run" />
            <datalist id="saved-expense-titles">
              {savedTitles.map(s => <option key={s} value={s} />)}
            </datalist>
          </label>
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Amount</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="0.00" />
          </label>
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Category</span>
              <SearchableSelect
                options={categories}
                value={category}
                onChange={(v) => setCategory(v)}
                onCreateOption={async (v) => {
                  // open inline prompt to ask for monthly budget for the new category
                  setCreatingCategoryName(v)
                  setCreatingCategoryBudget("")
                }}
                placeholder="e.g. Utilities"
              />
              {creatingCategoryName && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input value={creatingCategoryName} readOnly className="flex-1 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                    <input value={creatingCategoryBudget} onChange={(e) => setCreatingCategoryBudget(e.target.value)} placeholder="monthly budget" className="w-36 rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={creatingCategoryLoading}
                      onClick={async () => {
                        if (!creatingCategoryName) return
                        setCreatingCategoryLoading(true)
                        try {
                          const mb = Number(creatingCategoryBudget) || 0
                          const result = await createBudget({ name: creatingCategoryName, monthlyBudget: mb })
                          // backend upserts and returns existing or created doc
                          setCategory(result.name)
                          const refreshed = await getBudgets()
                          setCategories(refreshed.map((b: any) => b.name))
                          toast.push({ type: 'success', message: `Category "${result.name}" ready` })
                        } catch (err: any) {
                          console.error(err)
                          // duplicate key or other conflict -> try to fetch existing and use it
                          try {
                            const refreshed = await getBudgets()
                            setCategories(refreshed.map((b: any) => b.name))
                            const found = refreshed.find((b: any) => b.name.toLowerCase() === creatingCategoryName.toLowerCase())
                            if (found) {
                              setCategory(found.name)
                              toast.push({ type: 'info', message: `Category "${found.name}" already exists` })
                            } else {
                              toast.push({ type: 'error', message: 'Failed to create category' })
                            }
                          } catch (e) {
                            toast.push({ type: 'error', message: 'Failed to create category' })
                          }
                        } finally {
                          setCreatingCategoryLoading(false)
                          setCreatingCategoryName(null)
                          setCreatingCategoryBudget("")
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-2 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreatingCategoryName(null); setCreatingCategoryBudget("") }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-transparent px-3 py-2 text-sm uppercase tracking-widest text-claret hover:bg-pink/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
          </label>
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Date</span>
            <CustomDateInput value={date} onChange={(v) => setDate(v)} />
          </label>
        </div>
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
          Save Expense
        </button>
      </ModalFooter>
    </ModalFrame>
  );
}
