import BudgetCategories from "@/components/BudgetCategories";
import Layout from "@/components/Layout";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import PaginationControls from "@/components/PaginationControls";
import RecentExpenses from "@/components/RecentExpenses";
import { useToast } from "@/components/Toast";
import EditBudgetsModal from "@/modals/EditBudgetsModal";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import NewExpenseModal from "@/modals/NewExpenseModal";
import { useState, useEffect, useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, MoreVertical, Pencil, PiggyBank, Plus, Save, Trash2, Wallet } from "lucide-react";
import {
    createSavingsTarget,
    createSavingsTransaction,
    createExtraIncome,
    deleteExtraIncome,
    deleteSavingsTarget as deleteSavingsTargetApi,
    getBudgetHistory,
    getExpenses,
    getMonthlyIncome,
    getSavingsTargets,
    updateMonthlySalary,
    updateSavingsTarget,
    type BudgetDto,
    type ExpenseDto,
    type MonthlyIncomeDto,
    type SavingsTargetDto,
} from "@/lib/api";

// Example data removed — real data is loaded from API and kept in component state
type OwoTab = "savings" | "spending";
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
    dateKey?: string;
    amount: string;
    category?: string | null;
};
type BudgetHistory = {
    month: string;
    totalSpent: number;
    totalBudgeted: number;
    categories: Array<BudgetDto & { spentAmount: number }>;
};

const SAVINGS_TARGETS_PER_PAGE = 4;

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month: string) {
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0);
    return {
        from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
        to: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
    };
}

function getDefaultExpenseDate(month: string) {
    const currentMonth = monthKey();
    if (month === currentMonth) return todayKey();
    return `${month}-01`;
}

function getSavedAmount(target: SavingsTargetDto) {
    return (target.transactions || []).reduce((sum, transaction) => sum + (transaction.type === "deposit" ? transaction.amount : -transaction.amount), 0);
}

export default function ExpenseTracker() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<OwoTab>("savings");
    const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
    const [isEditBudgetsOpen, setIsEditBudgetsOpen] = useState(false);
    const [isIncomeOpen, setIsIncomeOpen] = useState(false);
    const [summary, setSummary] = useState<{ totalSpent: number; totalBudgeted: number; remaining: number }>({ totalSpent: 0, totalBudgeted: 0, remaining: 0 })
    const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryItem[]>([])
    const [expenseItems, setExpenseItems] = useState<ExpenseListItem[]>([])
    const [spendingMonth, setSpendingMonth] = useState(monthKey)
    const [budgetHistory, setBudgetHistory] = useState<BudgetHistory | null>(null)
    const [monthlyIncome, setMonthlyIncome] = useState<MonthlyIncomeDto | null>(null)
    const [salaryInput, setSalaryInput] = useState("")
    const [extraIncomeTitle, setExtraIncomeTitle] = useState("")
    const [extraIncomeAmount, setExtraIncomeAmount] = useState("")
    const [extraIncomeDate, setExtraIncomeDate] = useState("")
    const [extraIncomeNote, setExtraIncomeNote] = useState("")
    const [savingsTargets, setSavingsTargets] = useState<SavingsTargetDto[]>([])
    const [savingsTitle, setSavingsTitle] = useState("")
    const [savingsTargetAmount, setSavingsTargetAmount] = useState("")
    const [savingsAmounts, setSavingsAmounts] = useState<Record<string, string>>({})
    const [selectedSavingsTarget, setSelectedSavingsTarget] = useState<SavingsTargetDto | null>(null)
    const [openSavingsMenuId, setOpenSavingsMenuId] = useState<string | null>(null)
    const [editingSavingsTarget, setEditingSavingsTarget] = useState<SavingsTargetDto | null>(null)
    const [editSavingsTitle, setEditSavingsTitle] = useState("")
    const [editSavingsTargetAmount, setEditSavingsTargetAmount] = useState("")
    const [deletingSavingsTarget, setDeletingSavingsTarget] = useState<SavingsTargetDto | null>(null)
    const [savingsPage, setSavingsPage] = useState(1)
    const expenseDefaultDate = getDefaultExpenseDate(spendingMonth);
    const extraIncomeTotal = useMemo(() => (monthlyIncome?.extraIncomes || []).reduce((sum, item) => sum + item.amount, 0), [monthlyIncome]);
    const totalIncome = (monthlyIncome?.salary || 0) + extraIncomeTotal;
    const cashLeft = totalIncome - summary.totalSpent;

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const [history, income] = await Promise.all([
                    getBudgetHistory(spendingMonth),
                    getMonthlyIncome(spendingMonth),
                ])
                if (!mounted) return
                setBudgetHistory(history);
                setMonthlyIncome(income);
                setSalaryInput(String(income.salary || ""));
                setSummary({
                    totalSpent: history.totalSpent,
                    totalBudgeted: history.totalBudgeted,
                    remaining: history.totalBudgeted - history.totalSpent,
                })

                getSavingsTargets()
                    .then((savings) => {
                        if (mounted) setSavingsTargets(savings)
                    })
                    .catch(() => {})

                setBudgetCategories(history.categories.map((budget: BudgetDto & { spentAmount: number }) => ({
                    _id: budget._id,
                    name: budget.name,
                    spentAmount: budget.spentAmount ?? 0,
                    monthlyBudget: budget.monthlyBudget,
                    spent: budget.spentAmount ?? 0,
                    budget: budget.monthlyBudget,
                })))

                const expenses = await getExpenses(6, 1, getMonthRange(spendingMonth))
                if (!mounted) return
                // map categoryId -> name using budgets
                const map = new Map<string, string>()
                history.categories.forEach((b: BudgetDto) => map.set(b._id, b.name))
                setExpenseItems(expenses.map((e: ExpenseDto) => ({
                    _id: e._id,
                    title: e.title,
                    date: new Date(e.expenseDate).toLocaleDateString(),
                    dateKey: e.expenseDate.slice(0, 10),
                    amount: (e.amount || 0).toString(),
                    category: e.categoryId ? map.get(e.categoryId) ?? null : null,
                })))
            } catch {
                if (!mounted) return
                setSummary({ totalSpent: 0, totalBudgeted: 0, remaining: 0 })
                setBudgetCategories([])
                setBudgetHistory(null)
                setMonthlyIncome(null)
                setSalaryInput("")
                setExpenseItems([])
            }
        }

        load()
        const handler = () => { load().catch(() => {}) }
        const dataHandler = (ev: Event) => {
            const detail = (ev as CustomEvent)?.detail
            if (!detail || !detail.resource) return load().catch(() => {})
            if (detail.resource === 'budget' || detail.resource === 'expense' || detail.resource === 'savings' || detail.resource === 'income') return load().catch(() => {})
        }
        window.addEventListener('heph:expense:created', handler as EventListener)
        window.addEventListener('heph:data:changed', dataHandler as EventListener)
        return () => { mounted = false; window.removeEventListener('heph:expense:created', handler as EventListener); window.removeEventListener('heph:data:changed', dataHandler as EventListener) }
    }, [spendingMonth])

    useEffect(() => {
        setExtraIncomeDate(getDefaultExpenseDate(spendingMonth));
    }, [spendingMonth]);

    async function saveSalary() {
        const salary = Number(salaryInput || 0);
        if (!Number.isFinite(salary) || salary < 0) return;
        try {
            const updated = await updateMonthlySalary({ month: spendingMonth, salary });
            setMonthlyIncome(updated);
            setSalaryInput(String(updated.salary || ""));
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'income' } }))
            toast.push({ type: "success", message: "Salary saved." });
        } catch {
            toast.push({ type: "error", message: "Could not save salary." });
        }
    }

    async function addExtraIncome() {
        const cleanTitle = extraIncomeTitle.trim();
        const amount = Number(extraIncomeAmount);
        if (!cleanTitle || !Number.isFinite(amount) || amount <= 0 || !extraIncomeDate) return;
        try {
            const updated = await createExtraIncome({
                month: spendingMonth,
                title: cleanTitle,
                amount,
                date: extraIncomeDate,
                note: extraIncomeNote.trim() || undefined,
            });
            setMonthlyIncome(updated);
            setExtraIncomeTitle("");
            setExtraIncomeAmount("");
            setExtraIncomeDate(expenseDefaultDate);
            setExtraIncomeNote("");
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'income' } }))
            toast.push({ type: "success", message: "Extra income logged." });
        } catch {
            toast.push({ type: "error", message: "Could not log extra income." });
        }
    }

    async function removeExtraIncome(extraId: string) {
        try {
            const updated = await deleteExtraIncome(spendingMonth, extraId);
            setMonthlyIncome(updated);
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'income' } }))
            toast.push({ type: "success", message: "Extra income removed." });
        } catch {
            toast.push({ type: "error", message: "Could not remove extra income." });
        }
    }

    function openIncomeModal() {
        setSalaryInput(String(monthlyIncome?.salary || ""));
        setExtraIncomeDate((date) => date || expenseDefaultDate);
        setIsIncomeOpen(true);
    }

    async function addSavingsTarget() {
        const cleanTitle = savingsTitle.trim();
        const cleanAmount = Number(savingsTargetAmount);
        if (!cleanTitle || !Number.isFinite(cleanAmount) || cleanAmount <= 0) return;
        try {
            const created = await createSavingsTarget({ title: cleanTitle, targetAmount: cleanAmount, transactions: [] });
            setSavingsTargets((prev) => [created, ...prev]);
            setSavingsTitle("");
            setSavingsTargetAmount("");
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
            toast.push({ type: "success", message: "Savings target added." });
        } catch {
            toast.push({ type: "error", message: "Could not add that savings target." });
        }
    }

    async function updateSavings(targetId: string, direction: "deposit" | "withdraw") {
        const amount = Number(savingsAmounts[targetId] || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        try {
            const updated = await createSavingsTransaction(targetId, { type: direction, amount, date: todayKey() });
            setSavingsTargets((prev) => prev.map((target) => target._id === targetId ? updated : target));
            setSelectedSavingsTarget((target) => target?._id === targetId ? updated : target);
            setSavingsAmounts((prev) => ({ ...prev, [targetId]: "" }));
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
            toast.push({ type: "success", message: direction === "deposit" ? "Savings updated." : "Withdrawal recorded." });
        } catch {
            toast.push({ type: "error", message: direction === "deposit" ? "Could not save that money." : "Could not record that withdrawal." });
        }
    }

    async function deleteSavingsTarget(targetId: string) {
        try {
            await deleteSavingsTargetApi(targetId);
            setSavingsTargets((prev) => prev.filter((target) => target._id !== targetId));
            setDeletingSavingsTarget(null);
            setSelectedSavingsTarget(null);
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
            toast.push({ type: "success", message: "Savings target deleted." });
        } catch {
            toast.push({ type: "error", message: "Could not delete that savings target." });
        }
    }

    function openEditSavingsTarget(target: SavingsTargetDto) {
        setOpenSavingsMenuId(null);
        setEditingSavingsTarget(target);
        setEditSavingsTitle(target.title);
        setEditSavingsTargetAmount(String(target.targetAmount));
    }

    async function saveSavingsTargetEdit() {
        if (!editingSavingsTarget) return;
        const cleanTitle = editSavingsTitle.trim();
        const cleanAmount = Number(editSavingsTargetAmount);
        if (!cleanTitle || !Number.isFinite(cleanAmount) || cleanAmount <= 0) return;
        try {
            const updated = await updateSavingsTarget(editingSavingsTarget._id, { title: cleanTitle, targetAmount: cleanAmount });
            setSavingsTargets((prev) => prev.map((target) => target._id === editingSavingsTarget._id ? updated : target));
            setSelectedSavingsTarget((target) => target?._id === editingSavingsTarget._id ? updated : target);
            setEditingSavingsTarget(null);
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'savings' } }))
            toast.push({ type: "success", message: "Savings target updated." });
        } catch {
            toast.push({ type: "error", message: "Could not update that savings target." });
        }
    }

    const totalSaved = savingsTargets.reduce((sum, target) => sum + getSavedAmount(target), 0);
    const totalSavingsTarget = savingsTargets.reduce((sum, target) => sum + target.targetAmount, 0);
    const savingsTotalPages = Math.max(1, Math.ceil(savingsTargets.length / SAVINGS_TARGETS_PER_PAGE));
    const paginatedSavingsTargets = savingsTargets.slice((savingsPage - 1) * SAVINGS_TARGETS_PER_PAGE, savingsPage * SAVINGS_TARGETS_PER_PAGE);

    useEffect(() => {
        setSavingsPage((page) => Math.min(page, savingsTotalPages));
    }, [savingsTotalPages]);

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
                                    <p className="mt-2 text-lg md:text-2xl">Save for a rainy day, and withdraw when it starts pouring!</p>
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

                        <section className="grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    addSavingsTarget();
                                }}
                                className="min-h-[280px] self-start rounded-2xl bg-pink p-5 text-claret shadow-xl"
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
                                    paginatedSavingsTargets.map((target) => {
                                        const savedAmount = getSavedAmount(target);
                                        const percent = Math.min(100, Math.round((savedAmount / target.targetAmount) * 100));
                                        return (
                                            <article
                                                key={target._id}
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
                                                    <div className="flex justify-between">
                                                        <div>
                                                            <h3 className="text-2xl font-bold">{target.title}</h3>
                                                            <p className="mt-1 text-sm uppercase tracking-widest opacity-80">N{savedAmount.toLocaleString()} / N{target.targetAmount.toLocaleString()}</p>  
                                                        </div>
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); setOpenSavingsMenuId((current) => current === target._id ? null : target._id); }} aria-label="Savings target menu" title="Savings target menu" className="inline-flex size-9 items-center justify-center rounded-xl md:hidden hover:bg-claret hover:text-pink">
                                                            <MoreVertical className="size-4" />
                                                        </button>
                                                    </div>
                                                    <div className="relative flex w-full items-center gap-2 md:w-auto md:flex-wrap" onClick={(event) => event.stopPropagation()}>
                                                        <input
                                                            value={savingsAmounts[target._id] || ""}
                                                            onChange={(event) => setSavingsAmounts((prev) => ({ ...prev, [target._id]: event.target.value.replace(/[^0-9]/g, "") }))}
                                                            inputMode="numeric"
                                                            className="min-w-0 flex-1 rounded-xl border border-claret/30 bg-pink px-3 py-2 md:w-28 md:flex-none"
                                                            placeholder="Amount"
                                                        />
                                                        <button type="button" onClick={() => updateSavings(target._id, "deposit")} aria-label="Save toward target" title="Save toward target" className="inline-flex size-10 items-center justify-center rounded-xl border border-claret bg-claret text-pink hover:bg-claret/90">
                                                            <ArrowDownToLine className="size-4" />
                                                        </button>
                                                        <button type="button" onClick={() => updateSavings(target._id, "withdraw")} aria-label="Withdraw from target" title="Withdraw from target" className="inline-flex size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink">
                                                            <ArrowUpFromLine className="size-4" />
                                                        </button>
                                                        <button type="button" onClick={() => setOpenSavingsMenuId((current) => current === target._id ? null : target._id)} aria-label="Savings target menu" title="Savings target menu" className="hidden size-10 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink md:inline-flex lg:border-0">
                                                            <MoreVertical className="size-4" />
                                                        </button>
                                                        {openSavingsMenuId === target._id && (
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
                                <PaginationControls
                                    page={savingsPage}
                                    totalPages={savingsTotalPages}
                                    onPageChange={setSavingsPage}
                                    label="Targets"
                                    className="text-pink"
                                />
                            </div>
                        </section>
                    </section>
                ) : (
                    <>
                <div className="rounded-2xl bg-pink text-claret p-6 md:p-8 shadow-xl border border-claret/20">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-full">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold uppercase">Expenses</h1>
                            <p className="mt-2 text-lg md:text-2xl">Keep track of all your expenses here, baller!</p>
                        </div>
                        <div className="flex w-full flex-wrap items-center justify-center gap-3 md:w-auto md:justify-end">
                            <label className="w-full space-y-1 sm:w-auto">
                                <span className="text-sm uppercase tracking-widest">Month</span>
                                <input
                                    type="month"
                                    value={spendingMonth}
                                    onChange={(event) => setSpendingMonth(event.target.value)}
                                    className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsNewExpenseOpen(true)}
                                className="order-first inline-flex w-full flex-1 items-center justify-center rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink transition-all hover:bg-claret/90 focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink md:order-none md:w-auto md:flex-none md:text-base"
                            >
                                New Expense
                            </button>
                            <button
                                type="button"
                                onClick={openIncomeModal}
                                className="rounded-2xl border border-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest hover:bg-claret/80 hover:text-pink transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                            >
                                Monthly Income
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
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/5)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{summary.totalSpent.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Total Spent</p>
                    </article>
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/5)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{totalIncome.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Income</p>
                    </article>
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/5)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{cashLeft.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Cash Left</p>
                    </article>
                    <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/5)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
                        <p className="text-3xl md:text-4xl font-bold">N{summary.totalBudgeted.toLocaleString()}</p>
                        <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Total Budget</p>
                    </article>
                </section>

                <BudgetCategories categories={budgetCategories} expenseDefaultDate={expenseDefaultDate} />

                <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold uppercase">Month Breakdown</h2>
                            <p className="mt-1 text-lg">Review and edit spend for the selected month.</p>
                        </div>
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
                            <div className="hide-scrollbar mt-4 max-h-80 overflow-y-auto pr-1">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {budgetHistory.categories.map((category) => (
                                        <div key={category._id || category.name} className="rounded-xl border border-claret/20 p-4">
                                            <p className="text-xl font-bold">{category.name}</p>
                                            <p className="mt-2 text-sm uppercase tracking-widest opacity-80">N{Number(category.spentAmount || 0).toLocaleString()} / N{category.monthlyBudget.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-lg">No history available for this month.</p>
                    )}
                </section>

                <RecentExpenses expenses={expenseItems} title={`${new Date(`${spendingMonth}-01T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" })} Expenses`} showActions actionLabel="View all" expenseFilters={getMonthRange(spendingMonth)} />
                    </>
                )}
            </section>

            <NewExpenseModal open={isNewExpenseOpen} onClose={() => setIsNewExpenseOpen(false)} defaultDate={expenseDefaultDate} />
            {isIncomeOpen && (
                <ModalFrame
                    onClose={() => setIsIncomeOpen(false)}
                    shouldConfirmClose={() => false}
                >
                    <ModalHead>Monthly Income</ModalHead>
                    <ModalBody>
                        <div>
                            <p className="text-lg">Salary plus any extra money for {new Date(`${spendingMonth}-01T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}.</p>
                            <div className="mt-4 grid gap-3 text-center sm:grid-cols-3">
                                <div className="rounded-xl border border-claret/20 px-4 py-3">
                                    <p className="text-2xl font-bold">N{(monthlyIncome?.salary || 0).toLocaleString()}</p>
                                    <p className="text-xs uppercase tracking-widest">Salary</p>
                                </div>
                                <div className="rounded-xl border border-claret/20 px-4 py-3">
                                    <p className="text-2xl font-bold">N{extraIncomeTotal.toLocaleString()}</p>
                                    <p className="text-xs uppercase tracking-widest">Extra</p>
                                </div>
                                <div className="rounded-xl border border-claret/20 px-4 py-3">
                                    <p className="text-2xl font-bold">N{totalIncome.toLocaleString()}</p>
                                    <p className="text-xs uppercase tracking-widest">Total</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-[minmax(220px,280px)_1fr]">
                            <div>
                                <label className="block space-y-1">
                                    <span className="text-sm uppercase tracking-widest">Monthly Salary</span>
                                    <input
                                        value={salaryInput}
                                        onChange={(event) => setSalaryInput(event.target.value.replace(/[^0-9.]/g, ""))}
                                        inputMode="decimal"
                                        className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                                        placeholder="0"
                                    />
                                </label>
                                <button type="button" onClick={saveSalary} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                                    <Save className="size-4" /> Save Salary
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="space-y-1">
                                        <span className="text-sm uppercase tracking-widest">Extra Income</span>
                                        <input value={extraIncomeTitle} onChange={(event) => setExtraIncomeTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Freelance" />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-sm uppercase tracking-widest">Amount</span>
                                        <input value={extraIncomeAmount} onChange={(event) => setExtraIncomeAmount(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="0" />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-sm uppercase tracking-widest">Date</span>
                                        <input type="date" value={extraIncomeDate} onChange={(event) => setExtraIncomeDate(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                                    </label>
                                    <button type="button" onClick={addExtraIncome} className="inline-flex items-center justify-center gap-2 self-end rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
                                        <Plus className="size-4" /> Log
                                    </button>
                                </div>
                                <label className="block space-y-1">
                                    <span className="text-sm uppercase tracking-widest">Note</span>
                                    <input value={extraIncomeNote} onChange={(event) => setExtraIncomeNote(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="Optional" />
                                </label>
                                {(monthlyIncome?.extraIncomes || []).length ? (
                                    <div className="grid gap-2">
                                        {[...(monthlyIncome?.extraIncomes || [])].reverse().map((income) => (
                                            <article key={income.id} className="flex items-start justify-between gap-3 rounded-xl border border-claret/20 p-3">
                                                <div>
                                                    <p className="text-xl font-bold">{income.title}</p>
                                                    <p className="text-sm uppercase tracking-widest opacity-75">{new Date(`${income.date}T00:00:00`).toLocaleDateString()}</p>
                                                    {income.note ? <p className="mt-1 text-sm tracking-normal opacity-80">{income.note}</p> : null}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <p className="text-xl font-bold">N{income.amount.toLocaleString()}</p>
                                                    <button type="button" onClick={() => removeExtraIncome(income.id)} aria-label={`Delete ${income.title}`} title={`Delete ${income.title}`} className="inline-flex size-9 items-center justify-center rounded-xl border border-claret hover:bg-claret hover:text-pink">
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="rounded-xl border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-75">No extra income logged for this month.</p>
                                )}
                            </div>
                        </div>
                    </ModalBody>
                </ModalFrame>
            )}
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
                    if (deletingSavingsTarget) deleteSavingsTarget(deletingSavingsTarget._id);
                }}
            />
        </Layout>
    );
}
