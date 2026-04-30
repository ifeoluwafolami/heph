import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import EditRecentExpenseModal from "@/modals/EditRecentExpenseModal";
import ViewAllExpensesModal from "@/modals/ViewAllExpensesModal";

type ExpenseItem = {
  _id?: string;
  title: string;
  date: string;
  amount: string;
  category?: string | null;
};

type RecentExpensesProps = {
  expenses?: ExpenseItem[];
  title?: string;
  showActions?: boolean;
  actionLabel?: string;
};

const defaultExpenses: ExpenseItem[] = [
  { title: "Groceries", date: "Mar 30, 2026", amount: "45.50" },
  { title: "Dining Out", date: "Yesterday", amount: "32.75" },
  { title: "Transportation", date: "Mar 20, 2026", amount: "15.00" },
  { title: "Utilities", date: "Mar 19, 2026", amount: "85.00" },
];

export default function RecentExpenses({
  expenses = defaultExpenses,
  title = "Recent Expenses",
  showActions = false,
  actionLabel = "View all",
}: RecentExpensesProps) {
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<ExpenseItem | null>(null);
  const [selectedExpenseForDelete, setSelectedExpenseForDelete] = useState<ExpenseItem | null>(null);
  const toast = useToast()

  return (
    <>
      <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-2xl md:text-3xl font-bold uppercase">{title}</h4>
          <button
            type="button"
            onClick={() => setIsViewAllOpen(true)}
            className="text-sm md:text-base uppercase tracking-widest hover:underline underline-offset-5 hover:scale-105 transition-transform duration-300 cursor-pointer"
          >
            {actionLabel}
          </button>
        </div>

      <div className="flex flex-col gap-3">
        {expenses.map((expense) => (
          <div
            key={expense._id ?? `${expense.title}-${expense.date}`}
            className="rounded-xl border border-claret/30 p-4 bg-claret/95 text-pink flex items-center justify-between"
          >
            <div>
              <p className="text-lg md:text-xl font-bold">
                {expense.title}
                {expense.category ? <span className="ml-2 text-sm font-normal opacity-80">— {expense.category}</span> : null}
              </p>
              <p className="mt-2 text-xs md:text-sm uppercase tracking-wider opacity-75">{expense.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg md:text-2xl font-bold">N{expense.amount}</p>
              {showActions && (
                <div className="flex ml-2 md:ml-12 gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedExpenseForEdit(expense)}
                    className="text-xs md:text-sm uppercase tracking-wider hover:text-pink/90 hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                    aria-label={`Edit ${expense.title} expense`}
                    title={`Edit ${expense.title}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedExpenseForDelete(expense)}
                    className="text-xs md:text-sm uppercase tracking-wider hover:text-pink/90 hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                    aria-label={`Delete ${expense.title} expense`}
                    title={`Delete ${expense.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      </section>

      <ViewAllExpensesModal open={isViewAllOpen} onClose={() => setIsViewAllOpen(false)} expenses={expenses} />
      <EditRecentExpenseModal
        open={Boolean(selectedExpenseForEdit)}
        onClose={() => setSelectedExpenseForEdit(null)}
        expense={selectedExpenseForEdit}
      />
      <DeleteConfirmationModal
        open={Boolean(selectedExpenseForDelete)}
        onClose={() => setSelectedExpenseForDelete(null)}
        itemName={selectedExpenseForDelete?.title ?? ""}
        itemType="expense"
        onConfirm={async () => {
          if (!selectedExpenseForDelete?._id) return
          try {
            const { deleteExpense } = await import('@/lib/api')
            await deleteExpense(selectedExpenseForDelete._id)
            toast.push({ type: 'success', message: 'Expense deleted' })
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'expense' } }))
          } catch (err) {
            console.error(err)
            toast.push({ type: 'error', message: 'Failed to delete expense' })
          }
        }}
      />
    </>
  );
}
