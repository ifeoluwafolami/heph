type MonthlyOverviewProps = {
  totalSpent?: number;
  totalBudgeted?: number;
  mementosAdded?: number;
  weightProgressKg?: number;
  newRecipes?: number;
};

export default function MonthlyOverview({
  totalSpent = 0,
  totalBudgeted = 0,
  mementosAdded = 0,
  weightProgressKg = 0,
  newRecipes = 0,
}: MonthlyOverviewProps) {
  const weightDirection = weightProgressKg > 0 ? "+" : "";

  return (
    <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
      <h4 className="text-2xl md:text-3xl font-bold uppercase mb-4">Monthly Overview</h4>

      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
        <div className="rounded-xl border border-claret/30 p-4 md:py-8 flex flex-col gap-4 bg-claret/95 text-pink w-full md:w-[24%]">
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Total Spent</p>
          <p className="text-2xl md:text-3xl font-bold">N{totalSpent.toLocaleString()} <span className="text-sm md:text-lg font-bold">/N{totalBudgeted.toLocaleString()}</span></p>
        </div>

        <div className="rounded-xl border border-claret/30 p-4 md:py-8 flex flex-col gap-4 bg-claret/95 text-pink w-full md:w-[24%]">
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Mementos Added</p>
          <p className="text-2xl md:text-3xl font-bold">{mementosAdded}</p>
        </div>

        <div className="rounded-xl border border-claret/30 p-4 md:py-8 flex flex-col gap-4 bg-claret/95 text-pink w-full md:w-[24%]">
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Weight Progress</p>
          <p className="text-2xl md:text-3xl font-bold">{weightDirection}{weightProgressKg} kg</p>
        </div>

        <div className="rounded-xl border border-claret/30 p-4 md:py-8 flex flex-col gap-4 bg-claret/95 text-pink w-full md:w-[24%]">
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">New Recipes</p>
          <p className="text-2xl md:text-3xl font-bold">{newRecipes}</p>
        </div>
      </div>
    </section>
  );
}
