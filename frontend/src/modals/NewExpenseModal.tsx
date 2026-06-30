import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import CustomDateInput from "@/components/CustomDateInput";
import { Plus } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { createExpense, getBudgetHistory, getExpenses, type BudgetDto } from "@/lib/api";
import { useToast } from "@/components/Toast";

type NewExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
};

export default function NewExpenseModal({ open, onClose, defaultDate = "" }: NewExpenseModalProps) {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [budgets, setBudgets] = useState<Array<BudgetDto & { spentAmount: number }>>([])
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  const toast = useToast()
  const amountNumber = Number(amount || 0)
  const selectedBudget = useMemo(() => budgets.find((budget) => budget._id === category) || null, [budgets, category])
  const categoryWarning = useMemo(() => {
    if (!selectedBudget) return ""
    const spent = Number(selectedBudget.spentAmount || 0)
    const limit = Number(selectedBudget.monthlyBudget || 0)
    if (limit <= 0) return ""
    if (spent >= limit) return `${selectedBudget.name} has already hit its monthly limit.`
    if (amountNumber > 0 && spent + amountNumber > limit) return `This expense will push ${selectedBudget.name} past its monthly limit.`
    return ""
  }, [amountNumber, selectedBudget])

  function dateToMonth(dateValue: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue.slice(0, 7) : new Date().toISOString().slice(0, 7)
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const expenses = await getExpenses(50, 1)
        if (!mounted) return
        setSavedTitles(Array.from(new Set(expenses.map((expense) => expense.title))).slice(0, 50))
      } catch (_err) {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!open || !date) return
    let mounted = true
    getBudgetHistory(dateToMonth(date))
      .then((history) => {
        if (!mounted) return
        setBudgets(history.categories)
        setCategory((current) => history.categories.some((budget) => budget._id === current) ? current : "")
      })
      .catch(() => {
        if (!mounted) return
        setBudgets([])
        setCategory("")
      })
    return () => { mounted = false }
  }, [date, open])

  useEffect(() => {
    if (open) setDate(defaultDate)
  }, [defaultDate, open])

  useEffect(() => {
    if (!open) {
      setTitle("")
      setAmount("")
      setCategory("")
      setDate("")
      setNote("")
    }
  }, [open])

  if (!open) return null;

  async function handleSave() {
    const amt = Number(amount)
    if (!title || !amt || !date) return

    try {
      const payload: any = { title, amount: amt, expenseDate: date }
      if (note) payload.note = note
      if (selectedBudget) payload.categoryId = selectedBudget._id

      await createExpense(payload)

      setSavedTitles((prev) => Array.from(new Set([title, ...prev])).slice(0, 50))
      toast.push({ type: 'success', message: 'Expense created' })
      // notify app to refetch lists
      window.dispatchEvent(new CustomEvent('heph:expense:created', { detail: { expense: { title, amount: amt, category: selectedBudget?._id ?? null } } }))
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
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
            >
              <option value="">Choose a category</option>
              {budgets.map((budget) => (
                <option key={budget._id} value={budget._id}>
                  {budget.name}
                </option>
              ))}
            </select>
            {categoryWarning ? (
              <p className="rounded-xl border border-claret/30 bg-claret/10 px-3 py-2 text-sm tracking-normal">
                {categoryWarning} You can still save this expense.
              </p>
            ) : null}
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
