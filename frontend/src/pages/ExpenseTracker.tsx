import BudgetCategories from "@/components/BudgetCategories";
import Layout from "@/components/Layout";
import RecentExpenses from "@/components/RecentExpenses";
import EditBudgetsModal from "@/modals/EditBudgetsModal";
import NewExpenseModal from "@/modals/NewExpenseModal";
import { useState, useEffect } from "react";
import { getExpenseSummary, getBudgets, getExpenses } from "@/lib/api";

const expenseItems = [
  { title: "Groceries", date: "Mar 22, 2026", amount: "45.50" },
  { title: "Dining Out", date: "Mar 21,2026", amount: "32.75" },
  { title: "Transportation", date: "Mar 20, 2026", amount: "15.00" },
  { title: "Utilities", date: "Mar 19, 2026", amount: "85.00" },
  { title: "Entertainment", date: "Mar 18, 2026", amount: "25.00" },
];

const budgetCategories = [
    { name: "Groceries", spent: 320, budget: 500 },
    { name: "Utilities", spent: 185, budget: 200 },
    { name: "Entertainment", spent: 95, budget: 150 },
    { name: "Transportation", spent: 280, budget: 300 },
    { name: "Dining Out", spent: 220, budget: 200 },
    { name: "Health & Fitness", spent: 45, budget: 150 },
];

const summaryCards = [
  { label: "Total Spent This Month", value: "2,340" },
  { label: "Remaining", value: "2,320" },
    { label: "Total Budget", value: "4,660" },
];

export default function ExpenseTracker() {
    const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
    const [isEditBudgetsOpen, setIsEditBudgetsOpen] = useState(false);
    const [summary, setSummary] = useState<{ totalSpent: number; totalBudgeted: number; remaining: number }>({ totalSpent: 0, totalBudgeted: 0, remaining: 0 })
    const [budgetCategories, setBudgetCategories] = useState<Array<any>>([])
    const [expenseItems, setExpenseItems] = useState<Array<any>>([])
    const [expensePage, setExpensePage] = useState(1)
    const [expensesMeta, setExpensesMeta] = useState<{ total?: number; page?: number; limit?: number } | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const s = await getExpenseSummary()
                if (!mounted) return
                setSummary({ totalSpent: s.totalSpent, totalBudgeted: s.totalBudgeted, remaining: s.remaining })

                const budgets = await getBudgets()
                if (!mounted) return
                setBudgetCategories(budgets)

                const expenses = await getExpenses(6, expensePage)
                if (!mounted) return
                // map categoryId -> name using budgets
                const map = new Map<string, string>()
                budgets.forEach((b: any) => map.set(b._id, b.name))
                setExpenseItems(expenses.map((e: any) => ({
                    _id: e._id,
                    title: e.title,
                    date: new Date(e.expenseDate).toLocaleDateString(),
                    amount: (e.amount || 0).toString(),
                    category: e.categoryId ? map.get(e.categoryId) ?? null : null,
                })))
                const meta = (expenses as any)._meta
                if (meta) setExpensesMeta(meta as any)
            } catch (_err) {
                // ignore
            }
        }

        load()
        const handler = () => { load().catch(() => {}) }
        const dataHandler = (ev: Event) => {
            const detail = (ev as CustomEvent)?.detail
            if (!detail || !detail.resource) return load().catch(() => {})
            if (detail.resource === 'budget' || detail.resource === 'expense') return load().catch(() => {})
        }
        window.addEventListener('heph:expense:created', handler as EventListener)
        window.addEventListener('heph:data:changed', dataHandler as EventListener)
        return () => { mounted = false; window.removeEventListener('heph:expense:created', handler as EventListener); window.removeEventListener('heph:data:changed', dataHandler as EventListener) }
    }, [expensePage])

    return (
        <Layout>
            <section className="w-full">
                <div className="rounded-2xl bg-pink text-claret p-6 md:p-8 shadow-xl border border-claret/20">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-full">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold uppercase">OWO</h1>
                            <p className="mt-2 text-lg md:text-2xl">Hi, money maker! Here's where we do one of your favorite things - plan how to spend money!</p>
                        </div>
                        <div className="flex gap-3 h-full items-center flex-wrap">
                            <button
                                type="button"
                                onClick={() => setIsNewExpenseOpen(true)}
                                className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                            >
                                New Expense
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditBudgetsOpen(true)}
                                className="rounded-2xl border border-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest hover:bg-claret/80 hover:text-pink transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                            >
                                Edit Budgets
                            </button>
                        </div>
                    </div>
                </div>

                <section className="my-6 flex flex-wrap justify-center gap-4">
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{summary.totalSpent.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Total Spent This Month</p>
                    </article>
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{summary.remaining.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Remaining</p>
                    </article>
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{summary.totalBudgeted.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Total Budget</p>
                    </article>
                </section>

                <BudgetCategories categories={budgetCategories} />

                <RecentExpenses expenses={expenseItems} showActions actionLabel="View all" />
                <div className="mt-4 flex items-center gap-3 justify-center">
                    <button disabled={expensePage <= 1} onClick={() => setExpensePage((p) => Math.max(1, p - 1))} className="rounded-lg px-3 py-2 border border-claret/20">Previous</button>
                    <div>Page {expensePage}{expensesMeta?.total ? ` — ${expensesMeta.total} items` : ''}</div>
                    <button disabled={expensesMeta && expensesMeta.total ? (expensePage * (expensesMeta.limit || 6) >= (expensesMeta.total || 0)) : false} onClick={() => setExpensePage((p) => p + 1)} className="rounded-lg px-3 py-2 border border-claret/20">Next</button>
                </div>
            </section>

            <NewExpenseModal open={isNewExpenseOpen} onClose={() => setIsNewExpenseOpen(false)} />
            <EditBudgetsModal
                open={isEditBudgetsOpen}
                onClose={() => setIsEditBudgetsOpen(false)}
                budgets={budgetCategories}
            />
        </Layout>
    );
}