import { ModalBody, ModalFrame, ModalHead } from "@/components/Modal";
import PaginationControls from "@/components/PaginationControls";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import EditRecentExpenseModal from "@/modals/EditRecentExpenseModal";
import { useToast } from "@/components/Toast";
import { Pencil, Trash2 } from "lucide-react";
import { deleteExpense, getBudgets, getExpenses, type BudgetDto, type ExpenseDto } from "@/lib/api";
import { useEffect, useState } from "react";

type ExpenseItem = {
  _id?: string;
  title: string;
  date: string;
  dateKey?: string;
  amount: string;
  category?: string | null;
};

type ViewAllExpensesModalProps = {
  open: boolean;
  onClose: () => void;
  expenses: ExpenseItem[];
  filters?: { from?: string; to?: string; categoryId?: string };
  title?: string;
};

const EXPENSES_PER_PAGE = 10;

export default function ViewAllExpensesModal({ open, onClose, expenses, filters, title = "All Recent Expenses" }: ViewAllExpensesModalProps) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ExpenseItem[]>(expenses);
  const [meta, setMeta] = useState<{ total?: number; limit?: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<ExpenseItem | null>(null);
  const [selectedExpenseForDelete, setSelectedExpenseForDelete] = useState<ExpenseItem | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setPage(1);
  }, [filters?.categoryId, filters?.from, filters?.to, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    async function load() {
      try {
        const [expenseResults, budgets] = await Promise.all([
          getExpenses(EXPENSES_PER_PAGE, page, filters),
          getBudgets(),
        ]);
        if (!mounted) return;
        const categoryMap = new Map<string, string>();
        budgets.forEach((budget: BudgetDto) => categoryMap.set(budget._id, budget.name));
        setItems(expenseResults.map((expense: ExpenseDto) => ({
          _id: expense._id,
          title: expense.title,
          date: new Date(expense.expenseDate).toLocaleDateString(),
          dateKey: expense.expenseDate.slice(0, 10),
          amount: (expense.amount || 0).toString(),
          category: expense.categoryId ? categoryMap.get(expense.categoryId) ?? null : null,
        })));
        setMeta((expenseResults as ExpenseDto[] & { _meta?: { total?: number; limit?: number } })._meta || null);
      } catch {
        if (!mounted) return;
        setItems([]);
        setMeta(null);
      }
    }
    load();
    return () => { mounted = false };
  }, [filters, open, page, refreshKey]);

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil((meta?.total || items.length) / (meta?.limit || EXPENSES_PER_PAGE)));

  return (
    <>
      <ModalFrame onClose={onClose}>
        <ModalHead>{title}</ModalHead>
        <ModalBody>
          <div className="space-y-3">
            {items.length ? (
              items.map((expense) => (
                <article
                  key={expense._id ?? `${expense.title}-${expense.date}`}
                  className="rounded-xl border border-claret/30 bg-claret/95 p-4 text-pink"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg md:text-xl font-bold">
                        {expense.title}
                        {expense.category ? <span className="ml-2 text-sm font-normal opacity-80">- {expense.category}</span> : null}
                      </p>
                      <p className="mt-1 text-xs md:text-sm uppercase tracking-wider opacity-80">{expense.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg md:text-2xl font-bold">N{expense.amount}</p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseForEdit(expense)}
                          className="text-xs uppercase tracking-wider hover:text-pink/90 hover:scale-110 transition-transform duration-300 ease-in-out"
                          aria-label={`Edit ${expense.title} expense`}
                          title={`Edit ${expense.title}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseForDelete(expense)}
                          className="text-xs uppercase tracking-wider hover:text-pink/90 hover:scale-110 transition-transform duration-300 ease-in-out"
                          aria-label={`Delete ${expense.title} expense`}
                          title={`Delete ${expense.title}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-claret/30 p-4 text-lg">No expenses found.</p>
            )}
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            label="Expenses"
          />
        </ModalBody>
      </ModalFrame>
      <EditRecentExpenseModal
        open={Boolean(selectedExpenseForEdit)}
        onClose={() => {
          setSelectedExpenseForEdit(null);
          setRefreshKey((key) => key + 1);
        }}
        expense={selectedExpenseForEdit}
      />
      <DeleteConfirmationModal
        open={Boolean(selectedExpenseForDelete)}
        onClose={() => setSelectedExpenseForDelete(null)}
        itemName={selectedExpenseForDelete?.title ?? ""}
        itemType="expense"
        onConfirm={async () => {
          if (!selectedExpenseForDelete?._id) return;
          try {
            await deleteExpense(selectedExpenseForDelete._id);
            toast.push({ type: "success", message: "Expense deleted" });
            setRefreshKey((key) => key + 1);
            window.dispatchEvent(new CustomEvent("heph:data:changed", { detail: { resource: "expense" } }));
          } catch (err) {
            console.error(err);
            toast.push({ type: "error", message: "Failed to delete expense" });
          }
        }}
      />
    </>
  );
}
