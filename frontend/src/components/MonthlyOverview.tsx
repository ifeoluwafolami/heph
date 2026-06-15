import { useNavigate } from "react-router-dom";

type MonthlyOverviewProps = {
  totalSpent?: number;
  totalBudgeted?: number;
  totalSavedThisMonth?: number;
  mementosAdded?: number;
  weightProgressKg?: number;
  newRecipes?: number;
  totalSidequests?: number;
};

export default function MonthlyOverview({
  totalSpent = 0,
  totalBudgeted = 0,
  totalSavedThisMonth = 0,
  mementosAdded = 0,
  weightProgressKg = 0,
  newRecipes = 0,
  totalSidequests = 0,
}: MonthlyOverviewProps) {
  const weightDirection = weightProgressKg > 0 ? "+" : "";
  const navigate = useNavigate();
  const cardClass = "rounded-xl border border-claret/30 p-4 md:py-8 flex flex-col gap-4 bg-claret/95 text-pink w-full md:w-[31%] text-left hover:scale-[1.01] transition-transform";

  return (
    <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
      <h4 className="text-2xl md:text-3xl font-bold uppercase mb-4">Overview</h4>

      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
        <button type="button" onClick={() => navigate("/owo")} className={cardClass}>
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Total Spent This Month</p>
          <p className="text-2xl md:text-3xl font-bold">N{totalSpent.toLocaleString()} <span className="text-sm md:text-lg font-bold">/N{totalBudgeted.toLocaleString()}</span></p>
        </button>

        <button type="button" onClick={() => navigate("/owo")} className={cardClass}>
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Total Saved This Month</p>
          <p className="text-2xl md:text-3xl font-bold">N{totalSavedThisMonth.toLocaleString()}</p>
        </button>

        <button type="button" onClick={() => navigate("/mementos")} className={cardClass}>
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Total Mementos</p>
          <p className="text-2xl md:text-3xl font-bold">{mementosAdded}</p>
        </button>

        <button type="button" onClick={() => navigate("/ounje")} className={cardClass}>
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Total Recipes</p>
          <p className="text-2xl md:text-3xl font-bold">{newRecipes}</p>
        </button>

        <button type="button" onClick={() => navigate("/odyssey")} className={cardClass}>
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Total Sidequests</p>
          <p className="text-2xl md:text-3xl font-bold">{totalSidequests}</p>
        </button>

        <button type="button" onClick={() => navigate("/ounje")} className={cardClass}>
          <p className="text-sm md:text-base uppercase tracking-wider opacity-80">Weight Progress</p>
          <p className="text-2xl md:text-3xl font-bold">{weightDirection}{weightProgressKg} kg</p>
        </button>
      </div>
    </section>
  );
}
