import { ModalBody, ModalFrame, ModalHead } from "@/components/Modal";

type ExpenseItem = {
  title: string;
  date: string;
  amount: string;
};

type ViewAllExpensesModalProps = {
  open: boolean;
  onClose: () => void;
  expenses: ExpenseItem[];
};

export default function ViewAllExpensesModal({ open, onClose, expenses }: ViewAllExpensesModalProps) {
  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>All Recent Expenses</ModalHead>
      <ModalBody>
        <div className="space-y-3">
          {expenses.map((expense) => (
            <article
              key={`${expense.title}-${expense.date}`}
              className="rounded-xl border border-claret/30 bg-claret/95 p-4 text-pink"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg md:text-xl font-bold">{expense.title}</p>
                  <p className="mt-1 text-xs md:text-sm uppercase tracking-wider opacity-80">{expense.date}</p>
                </div>
                <p className="text-lg md:text-2xl font-bold">N{expense.amount}</p>
              </div>
            </article>
          ))}
        </div>
      </ModalBody>
    </ModalFrame>
  );
}
