import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import EditBudgetModal from "@/modals/EditBudgetModal";
import LogExpenseModal from "@/modals/LogExpenseModal";
import NewBudgetModal from "@/modals/NewBudgetModal";

type BudgetCategory = {
  _id?: string;
  name: string;
  spent: number;
  budget: number;
};

type BudgetCategoriesProps = {
  categories?: BudgetCategory[];
};

const defaultCategories: BudgetCategory[] = [
  { name: "Groceries", spent: 320, budget: 500 },
  { name: "Utilities", spent: 185, budget: 200 },
  { name: "Entertainment", spent: 95, budget: 150 },
  { name: "Transportation", spent: 280, budget: 300 },
  { name: "Dining Out", spent: 220, budget: 200 },
  { name: "Health & Fitness", spent: 45, budget: 150 },
];

export default function BudgetCategories({ categories = defaultCategories }: BudgetCategoriesProps) {
  const [isNewBudgetOpen, setIsNewBudgetOpen] = useState(false);
  const [selectedEditCategory, setSelectedEditCategory] = useState<BudgetCategory | null>(null);
  const [selectedDeleteCategory, setSelectedDeleteCategory] = useState<BudgetCategory | null>(null);
  const [selectedLogCategory, setSelectedLogCategory] = useState<BudgetCategory | null>(null);
  const toast = useToast()

  return (
    <>
      <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl md:text-3xl font-bold uppercase">Budget Categories</h2>
          <button
            type="button"
            onClick={() => setIsNewBudgetOpen(true)}
            className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
          >
            New Budget
          </button>
        </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {categories.map((category) => {
          // support backend BudgetDto shape: { name, monthlyBudget, spentAmount }
          const name = (category.name ?? category.name) as string
          const spent = Number(category.spentAmount ?? category.spent ?? 0)
          const budget = Number(category.monthlyBudget ?? category.budget ?? 0)
          const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0
          const isOverspent = spent > budget
          const remaining = budget - spent
          const progressWidth = Math.min(percentage, 100)

          return (
            <article
              key={category.name}
              className="rounded-xl border border-claret/30 bg-claret/95 text-pink p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold">{name}</h3>
                  <p className="mt-2 text-lg md:text-xl font-semibold">
                    N{spent.toFixed(0)}  <span className="text-xs md:text-sm">/N{budget.toFixed(0)}</span>
                  </p>
                </div>

                <div className="flex gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEditCategory({ _id: (category as any)._id, name, spent, budget })}
                    className="text-xs md:text-sm uppercase tracking-wider hover:text-pink/90 hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                    aria-label={`Edit ${category.name} budget`}
                    title={`Edit ${category.name}`}
                  >
                    <Pencil className="size-4 md:size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDeleteCategory(category)}
                    className="text-xs md:text-sm uppercase tracking-wider hover:text-pink/90 hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                    aria-label={`Delete ${category.name} budget`}
                    title={`Delete ${category.name}`}
                  >
                    <Trash2 className="size-4 md:size-5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm md:text-base">
                  <span>{percentage}%</span>
                  <span className={isOverspent ? "text-pink uppercase font-black" : "text-pink/80"}>
                    {isOverspent ? `Overspent by N${Math.abs(remaining).toFixed(2)}` : `N${remaining.toFixed(2)} remaining`}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-pink/25">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isOverspent ? "bg-pink" : "bg-pink/80"}`}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLogCategory(category)}
                className="mt-2 rounded-2xl border border-pink/40 bg-pink px-4 py-3 text-sm md:text-base uppercase tracking-widest text-claret hover:bg-pink/90 transition-all focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-claret"
              >
                Log Expense
              </button>
            </article>
          );
        })}
        </div>
      </section>

      <NewBudgetModal open={isNewBudgetOpen} onClose={() => setIsNewBudgetOpen(false)} />
      <EditBudgetModal
        open={Boolean(selectedEditCategory)}
        onClose={() => setSelectedEditCategory(null)}
        category={selectedEditCategory}
      />
      <DeleteConfirmationModal
        open={Boolean(selectedDeleteCategory)}
        onClose={() => setSelectedDeleteCategory(null)}
        itemName={selectedDeleteCategory?.name ?? ""}
        itemType="budget category"
            onConfirm={async () => {
          try {
            if (!selectedDeleteCategory?._id) return
            const { deleteBudget } = await import('@/lib/api')
            await deleteBudget(selectedDeleteCategory._id)
            toast.push({ type: 'success', message: 'Category deleted' })
            window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'budget' } }))
          } catch (err) {
            console.error(err)
            toast.push({ type: 'error', message: 'Failed to delete' })
          }
        }}
      />
      <LogExpenseModal
        open={Boolean(selectedLogCategory)}
        onClose={() => setSelectedLogCategory(null)}
        categoryName={selectedLogCategory?.name ?? ""}
        categoryId={selectedLogCategory?._id}
      />
    </>
  );
}
