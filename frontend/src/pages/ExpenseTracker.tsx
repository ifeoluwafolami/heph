import BudgetCategories from "@/components/BudgetCategories";
import Layout from "@/components/Layout";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import RecentExpenses from "@/components/RecentExpenses";
import EditBudgetsModal from "@/modals/EditBudgetsModal";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import NewExpenseModal from "@/modals/NewExpenseModal";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, PiggyBank, Plus, Save, Trash2, Wallet } from "lucide-react";
import { getExpenseSummary, getBudgets, getExpenses, getBudgetHistory, type BudgetDto, type ExpenseDto } from "@/lib/api";

// Example data removed — real data is loaded from API and kept in component state
type OwoTab = "savings" | "spending";
type SavingsTarget = {
    id: string;
    title: string;
    targetAmount: number;
    savedAmount?: number;
    transactions?: SavingsTransaction[];
};
type SavingsTransaction = {
    id: string;
    type: "deposit" | "withdraw";
    amount: number;
    date: string;
};
type BudgetCategoryItem = {
    _id?: string;
    name: string;
    spentAmount: number;
    monthlyBudget: number;
    spent: number;
    budget: number;
};
type ExpenseListItem = {
    _id: string;
    title: string;
    date: string;
    amount: string;
    category?: string | null;
};
type BudgetHistory = {
    month: string;
    totalSpent: number;
    totalBudgeted: number;
    categories: Array<BudgetDto & { spentAmount: number }>;
};

const SAVINGS_STORAGE_KEY = "heph_owo_savings_targets";

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return monthKey(date);
}

function getSavedAmount(target: SavingsTarget) {
    if (target.transactions?.length) {
        return target.transactions.reduce((sum, transaction) => sum + (transaction.type === "deposit" ? transaction.amount : -transaction.amount), 0);
    }
    return target.savedAmount || 0;
}

function loadSavingsTargets() {
    try {
        const raw = localStorage.getItem(SAVINGS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as SavingsTarget[]) : [];
        return parsed.map((target) => {
            if (target.transactions) return target;
            const savedAmount = target.savedAmount || 0;
            return {
                ...target,
                transactions: savedAmount > 0 ? [{ id: `migration-${target.id}`, type: "deposit" as const, amount: savedAmount, date: todayKey() }] : [],
            };
        });
    } catch {
        return [];
    }
}

export default function ExpenseTracker() {
    const [activeTab, setActiveTab] = useState<OwoTab>("savings");
    const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
    const [isEditBudgetsOpen, setIsEditBudgetsOpen] = useState(false);
    const [summary, setSummary] = useState<{ totalSpent: number; totalBudgeted: number; remaining: number }>({ totalSpent: 0, totalBudgeted: 0, remaining: 0 })
    const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryItem[]>([])
    const [expenseItems, setExpenseItems] = useState<ExpenseListItem[]>([])
    const [expensePage, setExpensePage] = useState(1)
    const [expensesMeta, setExpensesMeta] = useState<{ total?: number; page?: number; limit?: number } | null>(null)
    const [budgetHistoryMonth, setBudgetHistoryMonth] = useState(previousMonthKey)
    const [budgetHistory, setBudgetHistory] = useState<BudgetHistory | null>(null)
    const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>(loadSavingsTargets)
    const [savingsTitle, setSavingsTitle] = useState("")
    const [savingsTargetAmount, setSavingsTargetAmount] = useState("")
    const [savingsAmounts, setSavingsAmounts] = useState<Record<string, string>>({})
    const [selectedSavingsTarget, setSelectedSavingsTarget] = useState<SavingsTarget | null>(null)
    const [openSavingsMenuId, setOpenSavingsMenuId] = useState<string | null>(null)
    const [editingSavingsTarget, setEditingSavingsTarget] = useState<SavingsTarget | null>(null)
    const [editSavingsTitle, setEditSavingsTitle] = useState("")
    const [editSavingsTargetAmount, setEditSavingsTargetAmount] = useState("")
    const [deletingSavingsTarget, setDeletingSavingsTarget] = useState<SavingsTarget | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const s = await getExpenseSummary()
                if (!mounted) return
                setSummary({ totalSpent: s.totalSpent, totalBudgeted: s.totalBudgeted, remaining: s.remaining })

                const budgets = await getBudgets()
                if (!mounted) return
                setBudgetCategories(budgets.map((budget: BudgetDto) => ({
                    _id: budget._id,
                    name: budget.name,
                    spentAmount: budget.spentAmount ?? 0,
                    monthlyBudget: budget.monthlyBudget,
                    spent: budget.spentAmount ?? 0,
                    budget: budget.monthlyBudget,
                })))

                const expenses = await getExpenses(6, expensePage)
                if (!mounted) return
                // map categoryId -> name using budgets
                const map = new Map<string, string>()
                budgets.forEach((b: BudgetDto) => map.set(b._id, b.name))
                setExpenseItems(expenses.map((e: ExpenseDto) => ({
                    _id: e._id,
                    title: e.title,
                    date: new Date(e.expenseDate).toLocaleDateString(),
                    amount: (e.amount || 0).toString(),
                    category: e.categoryId ? map.get(e.categoryId) ?? null : null,
                })))
                const meta = (expenses as ExpenseDto[] & { _meta?: { total?: number; page?: number; limit?: number } })._meta
                if (meta) setExpensesMeta(meta)
            } catch {
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

    useEffect(() => {
        localStorage.setItem(SAVINGS_STORAGE_KEY, JSON.stringify(savingsTargets));
    }, [savingsTargets]);

    useEffect(() => {
        let mounted = true;
        async function loadHistory() {
            try {
                const history = await getBudgetHistory(budgetHistoryMonth);
                if (mounted) setBudgetHistory(history);
            } catch {
                if (mounted) setBudgetHistory(null);
            }
        }

        loadHistory();
        return () => { mounted = false };
    }, [budgetHistoryMonth]);

    function addSavingsTarget() {
        const cleanTitle = savingsTitle.trim();
        const cleanAmount = Number(savingsTargetAmount);
        if (!cleanTitle || !Number.isFinite(cleanAmount) || cleanAmount <= 0) return;
        setSavingsTargets((prev) => [
            {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                title: cleanTitle,
                targetAmount: cleanAmount,
                savedAmount: 0,
                transactions: [],
            },
            ...prev,
        ]);
        setSavingsTitle("");
        setSavingsTargetAmount("");
    }

    function updateSavings(targetId: string, direction: "deposit" | "withdraw") {
        const amount = Number(savingsAmounts[targetId] || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        setSavingsTargets((prev) =>
            prev.map((target) => {
                if (target.id !== targetId) return target;
                const savedAmount = getSavedAmount(target);
                const safeAmount = direction === "withdraw" ? Math.min(amount, savedAmount) : amount;
                if (safeAmount <= 0) return target;
                return {
                    ...target,
                    savedAmount: undefined,
                    transactions: [
                        ...(target.transactions || []),
                        {
                            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            type: direction === "deposit" ? "deposit" : "withdraw",
                            amount: safeAmount,
                            date: todayKey(),
                        },
                    ],
                };
            })
        );
        setSavingsAmounts((prev) => ({ ...prev, [targetId]: "" }));
        window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
    }

    function deleteSavingsTarget(targetId: string) {
        setSavingsTargets((prev) => prev.filter((target) => target.id !== targetId));
        setDeletingSavingsTarget(null);
        setSelectedSavingsTarget(null);
        window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
    }

    function openEditSavingsTarget(target: SavingsTarget) {
        setOpenSavingsMenuId(null);
        setEditingSavingsTarget(target);
        setEditSavingsTitle(target.title);
        setEditSavingsTargetAmount(String(target.targetAmount));
    }

    function saveSavingsTargetEdit() {
        if (!editingSavingsTarget) return;
        const cleanTitle = editSavingsTitle.trim();
        const cleanAmount = Number(editSavingsTargetAmount);
        if (!cleanTitle || !Number.isFinite(cleanAmount) || cleanAmount <= 0) return;
        setSavingsTargets((prev) => prev.map((target) => target.id === editingSavingsTarget.id ? { ...target, title: cleanTitle, targetAmount: cleanAmount } : target));
        setSelectedSavingsTarget((target) => target?.id === editingSavingsTarget.id ? { ...target, title: cleanTitle, targetAmount: cleanAmount } : target);
        setEditingSavingsTarget(null);
        window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
    }

    const totalSaved = savingsTargets.reduce((sum, target) => sum + getSavedAmount(target), 0);
    const totalSavingsTarget = savingsTargets.reduce((sum, target) => sum + target.targetAmount, 0);

    return (
        <Layout>
            <section className="w-full">
                <div className="mb-4 flex rounded-2xl border border-pink/30 bg-pink/10 p-1 text-pink">
                    <button
                        type="button"
                        onClick={() => setActiveTab("savings")}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm uppercase tracking-widest transition-all ${activeTab === "savings" ? "bg-pink text-claret" : "hover:bg-pink/10"}`}
                    >
                        <PiggyBank className="size-4" /> Savings
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("spending")}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm uppercase tracking-widest transition-all ${activeTab === "spending" ? "bg-pink text-claret" : "hover:bg-pink/10"}`}
                    >
                        <Wallet className="size-4" /> Spending
                    </button>
                </div>

                {activeTab === "savings" ? (
                    <section className="space-y-6">
                        <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold uppercase md:text-5xl">Savings</h1>
                                    <p className="mt-2 text-lg md:text-2xl">Set targets, pay yourself first, and withdraw when life asks nicely.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="rounded-xl border border-claret/20 px-4 py-3">
                                        <p className="text-2xl font-bold">N{totalSaved.toLocaleString()}</p>
                                        <p className="text-xs uppercase tracking-widest">Saved</p>
                                    </div>
                                    <div className="rounded-xl border border-claret/20 px-4 py-3">
                                        <p className="text-2xl font-bold">N{totalSavingsTarget.toLocaleString()}</p>
                                        <p className="text-xs uppercase tracking-widest">Target</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <section className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    addSavingsTarget();
                                }}
                                className="rounded-2xl bg-pink p-5 text-claret shadow-xl"
                            >
                                <h2 className="text-2xl font-bold uppercase">New Target</h2>
                                <label className="mt-4 block space-y-1">
                                    <span className="text-sm uppercase tracking-widest">Title</span>
                                    <input value={savingsTitle} onChange={(event) => setSavingsTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. December trip" />
                                </label>
                                <label className="mt-4 block space-y-1">
                                    <span className="text-sm uppercase tracking-widest">Target Amount</span>
                                    <input value={savingsTargetAmount} onChange={(event) => setSavingsTargetAmount(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="0" />
                                </label>
                                <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                                    <Plus className="size-4" /> Add Target
                                </button>
                            </form>

                            <div className="space-y-4">
                                {savingsTargets.length === 0 ? (
                                    <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl">
                                        <p className="text-xl">No savings targets yet. Give your next big want a name.</p>
                                    </div>
                                ) : (
                                    savingsTargets.map((target) => {
                                        const savedAmount = getSavedAmount(target);
                                        const percent = Math.min(100, Math.round((savedAmount / target.targetAmount) * 100));
                                        return (
                                            <article
                                                key={target.id}
                                                onClick={() => setSelectedSavingsTarget(target)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        setSelectedSavingsTarget(target);
                                                    }
                                                }}
                                                tabIndex={0}
                                                role="button"
                                                aria-label={`Open ${target.title} savings history`}
                                                className="cursor-pointer rounded-2xl bg-pink p-5 text-claret shadow-xl transition-all hover:shadow-2xl"
                                            >
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <h3 className="text-2xl font-bold">{target.title}</h3>
                                                        <p className="mt-1 text-sm uppercase tracking-widest opacity-80">N{savedAmount.toLocaleString()} / N{target.targetAmount.toLocaleString()}</p>
                                                    </div>
                                                    <div className="relative flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                                                        <input
                                                            value={savingsAmounts[target.id] || ""}
                                                            onChange={(event) => setSavingsAmounts((prev) => ({ ...prev, [target.id]: event.target.value.replace(/[^0-9]/g, "") }))}
                                                            inputMode="numeric"
                                                            className="w-28 rounded-xl border border-claret/30 bg-pink px-3 py-2"
                                                            placeholder="Amount"
                                                        />
                                                        <button type="button" onClick={() => updateSavings(target.id, "deposit")} className="rounded-xl border border-claret bg-claret px-3 py-2 text-sm uppercase tracking-widest text-pink">Save</button>
                                                        <button type="button" onClick={() => updateSavings(target.id, "withdraw")} className="rounded-xl border border-claret px-3 py-2 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink">Withdraw</button>
                                                        <button type="button" onClick={() => setOpenSavingsMenuId((current) => current === target.id ? null : target.id)} aria-label="Savings target menu" title="Savings target menu" className="inline-flex items-center justify-center rounded-xl border border-claret px-3 py-2 hover:bg-claret hover:text-pink">
                                                            <MoreVertical className="size-4" />
                                                        </button>
                                                        {openSavingsMenuId === target.id && (
                                                            <div className="absolute right-0 top-12 z-10 w-36 rounded-xl border border-claret/20 bg-pink p-2 shadow-xl">
                                                                <button type="button" onClick={() => openEditSavingsTarget(target)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-claret hover:text-pink"><Pencil className="size-4" /> Edit</button>
                                                                <button type="button" onClick={() => { setOpenSavingsMenuId(null); setDeletingSavingsTarget(target); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-claret hover:text-pink"><Trash2 className="size-4" /> Delete</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-4">
                                                    <div className="mb-2 flex justify-between text-sm uppercase tracking-widest">
                                                        <span>{percent}%</span>
                                                        <span>N{Math.max(0, target.targetAmount - savedAmount).toLocaleString()} left</span>
                                                    </div>
                                                    <div className="h-3 overflow-hidden rounded-full bg-claret/20">
                                                        <div className="h-full rounded-full bg-claret" style={{ width: `${percent}%` }} />
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    </section>
                ) : (
                    <>
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

                <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold uppercase">Budget History</h2>
                            <p className="mt-1 text-lg">Recall previous monthly spend without changing this month’s reset totals.</p>
                        </div>
                        <label className="space-y-1">
                            <span className="text-sm uppercase tracking-widest">Month</span>
                            <input
                                type="month"
                                value={budgetHistoryMonth}
                                onChange={(event) => setBudgetHistoryMonth(event.target.value)}
                                className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                            />
                        </label>
                    </div>
                    {budgetHistory ? (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-claret/20 p-4">
                                    <p className="text-sm uppercase tracking-widest opacity-80">Spent</p>
                                    <p className="mt-2 text-3xl font-bold">N{budgetHistory.totalSpent.toLocaleString()}</p>
                                </div>
                                <div className="rounded-xl border border-claret/20 p-4">
                                    <p className="text-sm uppercase tracking-widest opacity-80">Budgeted</p>
                                    <p className="mt-2 text-3xl font-bold">N{budgetHistory.totalBudgeted.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {budgetHistory.categories.map((category) => (
                                    <div key={category._id || category.name} className="rounded-xl border border-claret/20 p-4">
                                        <p className="text-xl font-bold">{category.name}</p>
                                        <p className="mt-2 text-sm uppercase tracking-widest opacity-80">N{Number(category.spentAmount || 0).toLocaleString()} / N{category.monthlyBudget.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-lg">No history available for this month.</p>
                    )}
                </section>

                <RecentExpenses expenses={expenseItems} showActions actionLabel="View all" />
                {expensesMeta?.total && Math.ceil(expensesMeta.total / (expensesMeta.limit || 6)) > 1 ? (
                    <div className="mt-4 flex items-center gap-4 justify-center">
                        <button
                            type="button"
                            disabled={expensePage <= 1}
                            onClick={() => setExpensePage((p) => Math.max(1, p - 1))}
                            className="rounded-md border px-3 py-2 bg-claret text-pink disabled:opacity-40"
                            aria-label="Previous page"
                        >
                            <ChevronLeft />
                        </button>
                        <div className="text-claret">Page {expensePage} / {Math.ceil(expensesMeta.total / (expensesMeta.limit || 6))}</div>
                        <button
                            type="button"
                            disabled={expensePage >= Math.ceil(expensesMeta.total / (expensesMeta.limit || 6))}
                            onClick={() => setExpensePage((p) => p + 1)}
                            className="rounded-md border px-3 py-2 bg-claret text-pink disabled:opacity-40"
                            aria-label="Next page"
                        >
                            <ChevronRight />
                        </button>
                    </div>
                ) : null}
                    </>
                )}
            </section>

            <NewExpenseModal open={isNewExpenseOpen} onClose={() => setIsNewExpenseOpen(false)} />
            <EditBudgetsModal
                open={isEditBudgetsOpen}
                onClose={() => setIsEditBudgetsOpen(false)}
                budgets={budgetCategories}
            />
            {selectedSavingsTarget && (
                <ModalFrame onClose={() => setSelectedSavingsTarget(null)}>
                    <ModalHead>{selectedSavingsTarget.title}</ModalHead>
                    <ModalBody>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-claret/20 p-3">
                                <p className="text-sm uppercase tracking-widest opacity-80">Saved</p>
                                <p className="text-2xl font-bold">N{getSavedAmount(selectedSavingsTarget).toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl border border-claret/20 p-3">
                                <p className="text-sm uppercase tracking-widest opacity-80">Target</p>
                                <p className="text-2xl font-bold">N{selectedSavingsTarget.targetAmount.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm uppercase tracking-widest">History</p>
                            {(selectedSavingsTarget.transactions || []).length === 0 ? (
                                <p>No savings activity yet.</p>
                            ) : (
                                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                                    {[...(selectedSavingsTarget.transactions || [])].reverse().map((transaction) => (
                                        <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-claret/20 p-3">
                                            <div>
                                                <p className="font-bold uppercase">{transaction.type === "deposit" ? "Saved" : "Withdrawn"}</p>
                                                <p className="text-sm opacity-70">{new Date(`${transaction.date}T00:00:00`).toLocaleDateString()}</p>
                                            </div>
                                            <p className="text-xl font-bold">{transaction.type === "deposit" ? "+" : "-"}N{transaction.amount.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ModalBody>
                </ModalFrame>
            )}
            {editingSavingsTarget && (
                <ModalFrame
                    onClose={() => setEditingSavingsTarget(null)}
                    shouldConfirmClose={() => editSavingsTitle.trim() !== editingSavingsTarget.title || Number(editSavingsTargetAmount) !== editingSavingsTarget.targetAmount}
                >
                    <ModalHead>Edit Savings Target</ModalHead>
                    <ModalBody>
                        <label className="block space-y-1">
                            <span className="text-sm uppercase tracking-widest">Title</span>
                            <input value={editSavingsTitle} onChange={(event) => setEditSavingsTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-sm uppercase tracking-widest">Target Amount</span>
                            <input value={editSavingsTargetAmount} onChange={(event) => setEditSavingsTargetAmount(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                        </label>
                    </ModalBody>
                    <ModalFooter>
                        <button type="button" onClick={saveSavingsTargetEdit} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                            <Save className="size-4" /> Save
                        </button>
                    </ModalFooter>
                </ModalFrame>
            )}
            <DeleteConfirmationModal
                open={Boolean(deletingSavingsTarget)}
                onClose={() => setDeletingSavingsTarget(null)}
                itemName={deletingSavingsTarget?.title || ""}
                itemType="savings target"
                onConfirm={() => {
                    if (deletingSavingsTarget) deleteSavingsTarget(deletingSavingsTarget.id);
                }}
            />
        </Layout>
    );
}
