import Layout from "@/components/Layout";
import CustomDateInput from "@/components/CustomDateInput";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import PaginationControls from "@/components/PaginationControls";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Flame, Pencil, Plus, Save, Trash2 } from "lucide-react";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/Toast";
import {
  createFoodPlanEntry,
  deleteFoodPlanEntry,
  getFoodPlanEntries,
  getFoodPlanSettings,
  getRecipes,
  getWeights,
  updateFoodPlanSettings,
  type FoodPlanEntryDto,
  type MealType,
} from "@/lib/api";
import NewRecipeModal from "@/modals/NewRecipeModal";
import EditRecipeModal from "@/modals/EditRecipeModal";
import NewWeightModal from "@/modals/NewWeightModal";
import EditWeightModal from "@/modals/EditWeightModal";

type Recipe = {
  _id: string
  title: string;
  servings: number;
  caloriesPerServing: number;
  steps?: string[];
  notes?: string;
  link?: string;
};

type WeightEntry = {
  _id: string
  weightKg: number;
  entryDate: string;
  changeKg?: number;
  note?: string;
};

const MEAL_TYPES: MealType[] = ["breakfast", "brunch", "lunch", "preworkout", "snack", "dinner"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(dateKey = todayKey()) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return toDateKey(date);
}

function getWeekDates(weekStart: string) {
  const start = parseDateKey(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateKey(date);
  });
}

function formatMealLabel(meal: MealType) {
  if (meal === "preworkout") return "Preworkout";
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

function formatWeekRange(weekDates: string[]) {
  const start = weekDates[0];
  const end = weekDates[weekDates.length - 1];
  if (!start || !end) return "";
  return `${new Date(`${start}T00:00:00`).toLocaleDateString("en-NG", { month: "short", day: "numeric" })} - ${new Date(`${end}T00:00:00`).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function Ounje() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeForDelete, setSelectedRecipeForDelete] = useState<Recipe | null>(null);
  const [selectedRecipeForEdit, setSelectedRecipeForEdit] = useState<Recipe | null>(null);
  const [selectedWeightEntry, setSelectedWeightEntry] = useState<WeightEntry | null>(null);
  const [selectedWeightForDelete, setSelectedWeightForDelete] = useState<WeightEntry | null>(null);
  const [selectedWeightForEdit, setSelectedWeightForEdit] = useState<WeightEntry | null>(null);
  const [isNewRecipeOpen, setIsNewRecipeOpen] = useState(false)
  const [isNewWeightOpen, setIsNewWeightOpen] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [recipesPage, setRecipesPage] = useState(1)
  const [recipesLimit] = useState(12)
  const [recipesMeta, setRecipesMeta] = useState<{ total: number; page: number; limit: number } | null>(null)
  const [weightsPage, setWeightsPage] = useState(1)
  const [weightsLimit] = useState(12)
  const [weightsMeta, setWeightsMeta] = useState<{ total: number; page: number; limit: number } | null>(null)
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState("2000")
  const [weeklyMeals, setWeeklyMeals] = useState<FoodPlanEntryDto[]>([])
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [mealDate, setMealDate] = useState(todayKey())
  const [mealType, setMealType] = useState<MealType>("breakfast")
  const [mealFood, setMealFood] = useState("")
  const [mealCalories, setMealCalories] = useState("")
  const [mealRecipeId, setMealRecipeId] = useState("")
  const toast = useToast()
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const visibleWeeklyMeals = useMemo(
    () => weeklyMeals.filter((entry) => weekDates.includes(entry.date)),
    [weekDates, weeklyMeals]
  )
  const weeklyCaloriesByDate = useMemo(() => {
    return visibleWeeklyMeals.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.date] = (totals[entry.date] || 0) + entry.calories;
      return totals;
    }, {});
  }, [visibleWeeklyMeals])
  const dailyTargetNumber = Number(dailyCalorieTarget) || 0
  const weeklyCalorieTotal = visibleWeeklyMeals.reduce((sum, entry) => sum + entry.calories, 0)
  const weekTargetTotal = dailyTargetNumber * weekDates.length

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await getRecipes(recipesLimit, recipesPage)
        const w = await getWeights(weightsLimit, weightsPage)
        if (!mounted) return
        setRecipes(r)
        // @ts-ignore
        if ((r as any)._meta) setRecipesMeta((r as any)._meta)
        setWeightEntries(w)
        // @ts-ignore
        if ((w as any)._meta) setWeightsMeta((w as any)._meta)
      } catch (err) {
        // ignore for now
      }
    }
    load()
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail
      if (!detail || !detail.resource) return load()
      if (detail.resource === 'recipe' || detail.resource === 'weight') load()
    }
    window.addEventListener('heph:data:changed', handler)
    return () => { mounted = false; window.removeEventListener('heph:data:changed', handler) }
  }, [recipesPage, recipesLimit, weightsPage, weightsLimit])

  useEffect(() => {
    let mounted = true
    async function loadMealPlan() {
      try {
        const [settings, entries] = await Promise.all([
          getFoodPlanSettings(),
          getFoodPlanEntries(weekDates[0], weekDates[weekDates.length - 1]),
        ])
        if (!mounted) return
        setDailyCalorieTarget(String(settings.dailyCalorieTarget ?? 2000))
        setWeeklyMeals(entries)
      } catch (err) {
        console.error(err)
        if (mounted) toast.push({ type: "error", message: "Could not load meal plan." })
      }
    }
    loadMealPlan()
    return () => { mounted = false }
  }, [toast, weekDates])

  useEffect(() => {
    if (!weekDates.includes(mealDate)) setMealDate(weekDates[0] || todayKey())
  }, [mealDate, weekDates])

  function moveFoodWeek(direction: -1 | 1) {
    const next = parseDateKey(weekStart)
    next.setDate(next.getDate() + direction * 7)
    setWeekStart(toDateKey(next))
  }

  function reviewCurrentWeek() {
    setWeekStart(getWeekStart())
  }

  async function saveDailyCalorieTarget() {
    const target = Number(dailyCalorieTarget)
    if (!Number.isFinite(target) || target < 0) return
    try {
      const settings = await updateFoodPlanSettings({ dailyCalorieTarget: target })
      setDailyCalorieTarget(String(settings.dailyCalorieTarget))
      toast.push({ type: "success", message: "Calorie target saved." })
    } catch (err) {
      console.error(err)
      toast.push({ type: "error", message: "Could not save calorie target." })
    }
  }

  function handleRecipeChoice(recipeId: string) {
    setMealRecipeId(recipeId)
    const recipe = recipes.find((item) => item._id === recipeId)
    if (!recipe) return
    setMealFood(recipe.title)
    setMealCalories(String(recipe.caloriesPerServing || 0))
  }

  async function addMealEntry() {
    const food = mealFood.trim()
    const calories = Number(mealCalories)
    if (!food || !Number.isFinite(calories) || calories < 0) return
    try {
      const created = await createFoodPlanEntry({
        date: mealDate,
        meal: mealType,
        food,
        calories,
        recipeId: mealRecipeId || undefined,
      })
      setWeeklyMeals((current) => [...current, created])
      setMealFood("")
      setMealCalories("")
      setMealRecipeId("")
      toast.push({ type: "success", message: "Meal added." })
    } catch (err) {
      console.error(err)
      toast.push({ type: "error", message: "Could not add meal." })
    }
  }

  async function removeMealEntry(id: string) {
    try {
      await deleteFoodPlanEntry(id)
      setWeeklyMeals((current) => current.filter((entry) => entry._id !== id))
      toast.push({ type: "success", message: "Meal removed." })
    } catch (err) {
      console.error(err)
      toast.push({ type: "error", message: "Could not remove meal." })
    }
  }

  return (
    <Layout>
      <section className="w-full">
        <div className="rounded-2xl bg-pink text-claret p-6 md:p-8 shadow-xl border border-claret/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl md:text-5xl font-bold uppercase">My Recipes</h1>
            <button
              type="button"
              onClick={() => setIsNewRecipeOpen(true)}
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
            >
              <Plus className="size-4 md:size-5" />
              Add Recipe
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
            <article
              key={recipe._id}
              className="cursor-pointer rounded-2xl border border-claret/30 bg-pink text-claret p-6 md:p-8 shadow-xl transition-all hover:shadow-2xl focus-within:ring-2 focus-within:ring-claret focus-within:ring-offset-2 focus-within:ring-offset-pink"
              onClick={() => setSelectedRecipe(recipe)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedRecipe(recipe);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open details for ${recipe.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold">{recipe.title}</h2>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedRecipeForEdit(recipe) }}
                    aria-label={`Edit ${recipe.title}`}
                    title={`Edit ${recipe.title}`}
                    className="text-xs md:text-sm uppercase tracking-wider hover:bg-pink hover:text-claret hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                  >
                    <Pencil className="size-4 md:size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedRecipeForDelete(recipe) }}
                    aria-label={`Delete ${recipe.title}`}
                    title={`Delete ${recipe.title}`}
                    className="text-xs md:text-sm uppercase tracking-wider hover:bg-pink hover:text-claret hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                  >
                    <Trash2 className="size-4 md:size-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 tracking-normal">
                <p className="text-base md:text-lg">Servings: {recipe.servings}</p>
                <p className="text-base md:text-lg">Calories: {recipe.caloriesPerServing} per serving</p>
                {recipe.steps?.length ? (
                  <p className="text-sm md:text-base uppercase tracking-widest opacity-75">{recipe.steps.length} Steps</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {recipesMeta && (
          <PaginationControls
            page={recipesMeta.page}
            totalPages={Math.max(1, Math.ceil(recipesMeta.total / recipesMeta.limit))}
            onPageChange={setRecipesPage}
            label="Recipes"
            className="text-pink"
          />
        )}

        <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-6" />
                <h2 className="text-2xl md:text-3xl font-bold uppercase">Weekly Food Timetable</h2>
              </div>
              <p className="mt-2 max-w-3xl text-base md:text-lg tracking-normal">
                Plan meals by day, review saved past weeks, and track estimated calories against your daily target.
              </p>
            </div>
            <div className="grid w-full gap-3 md:grid-cols-2 xl:max-w-xl">
              <div className="rounded-xl border border-claret/20 p-3">
                <p className="text-sm uppercase tracking-widest opacity-75">Reviewing</p>
                <p className="mt-1 text-xl font-bold">{formatWeekRange(weekDates)}</p>
              </div>
              <div className="rounded-xl border border-claret/20 p-3">
                <p className="text-sm uppercase tracking-widest opacity-75">Week Calories</p>
                <p className="mt-1 text-xl font-bold">{weeklyCalorieTotal.toLocaleString()} / {weekTargetTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,360px)_1fr]">
            <div className="rounded-xl border border-claret/30 p-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => moveFoodWeek(-1)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-claret px-3 py-2 text-xs uppercase tracking-widest hover:bg-claret hover:text-pink"
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={reviewCurrentWeek}
                    className="rounded-xl border border-claret px-3 py-2 text-xs uppercase tracking-widest hover:bg-claret hover:text-pink"
                  >
                    Current
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFoodWeek(1)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-claret px-3 py-2 text-xs uppercase tracking-widest hover:bg-claret hover:text-pink"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <label className="space-y-1">
                  <span className="text-sm uppercase tracking-widest">Week Of</span>
                  <CustomDateInput
                    value={weekStart}
                    onChange={(value) => setWeekStart(getWeekStart(value || todayKey()))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm uppercase tracking-widest">Day</span>
                  <select value={mealDate} onChange={(e) => setMealDate(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                    {weekDates.map((date) => (
                      <option key={date} value={date}>{new Date(`${date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm uppercase tracking-widest">Meal</span>
                  <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                    {MEAL_TYPES.map((meal) => (
                      <option key={meal} value={meal}>{formatMealLabel(meal)}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm uppercase tracking-widest">Recipe</span>
                  <select value={mealRecipeId} onChange={(e) => handleRecipeChoice(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2">
                    <option value="">Custom food</option>
                    {recipes.map((recipe) => (
                      <option key={recipe._id} value={recipe._id}>{recipe.title}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm uppercase tracking-widest">Food</span>
                  <input value={mealFood} onChange={(e) => setMealFood(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
                </label>
                <label className="space-y-1">
                  <span className="text-sm uppercase tracking-widest">Estimated Calories</span>
                  <input
                    type="text"
                    value={mealCalories}
                    onChange={(e) => setMealCalories(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={addMealEntry}
                  disabled={!mealFood.trim() || !(Number(mealCalories) >= 0)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="size-4" />
                  Add Meal
                </button>
                <label className="block space-y-1">
                  <span className="text-sm uppercase tracking-widest">Daily Calorie Target</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dailyCalorieTarget}
                      onChange={(e) => setDailyCalorieTarget(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={saveDailyCalorieTarget}
                      aria-label="Save calorie target"
                      title="Save calorie target"
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-claret bg-claret text-pink hover:bg-claret/90"
                    >
                      <Save className="size-4" />
                    </button>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
              {weekDates.map((date) => {
                const dayMeals = visibleWeeklyMeals.filter((entry) => entry.date === date);
                const total = weeklyCaloriesByDate[date] || 0;
                const remaining = dailyTargetNumber - total;
                return (
                  <article key={date} className="rounded-xl border border-claret/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold uppercase">{new Date(`${date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long" })}</p>
                        <p className="text-sm uppercase tracking-widest opacity-75">{new Date(`${date}T00:00:00`).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</p>
                      </div>
                      <div className="text-right">
                        <p className="inline-flex items-center gap-1 text-lg font-bold"><Flame className="size-4" />{total}</p>
                        <p className={`text-xs uppercase tracking-widest ${remaining < 0 ? "text-red-700" : "opacity-75"}`}>
                          {dailyTargetNumber ? (remaining >= 0 ? `${remaining} Left` : `${Math.abs(remaining)} Over`) : "Set Target"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {dayMeals.length ? dayMeals.map((entry) => (
                        <div key={entry._id} className="rounded-lg bg-claret/95 p-3 text-pink">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase tracking-widest opacity-75">{formatMealLabel(entry.meal)}</p>
                              <p className="text-lg leading-tight">{entry.food}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMealEntry(entry._id)}
                              aria-label={`Remove ${entry.food}`}
                              title={`Remove ${entry.food}`}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-pink hover:text-claret"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          <p className="mt-1 text-sm uppercase tracking-widest opacity-80">{entry.calories} Calories</p>
                        </div>
                      )) : (
                        <p className="rounded-lg border border-dashed border-claret/30 p-3 text-sm uppercase tracking-widest opacity-70">No meals planned</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl md:text-3xl font-bold uppercase">Weight Loss Journal</h2>
            <button
              type="button"
              onClick={() => setIsNewWeightOpen(true)}
              className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink w-fit"
            >
              Log Weight
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {weightEntries.map((entry) => (
              <article
                key={entry._id}
                className="cursor-pointer rounded-xl border border-claret/30 p-5 bg-claret/95 text-pink transition-all hover:shadow-xl focus-within:ring-2 focus-within:ring-claret focus-within:ring-offset-2 focus-within:ring-offset-pink"
                onClick={() => setSelectedWeightEntry(entry)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedWeightEntry(entry);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open details for weight entry on ${entry.entryDate}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl md:text-3xl font-bold">{entry.weightKg} kg</p>
                    <p className="mt-2 text-xs md:text-sm uppercase tracking-wider opacity-75">{new Date(entry.entryDate).toLocaleDateString()}</p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedWeightForEdit(entry) }}
                      aria-label={`Edit weight entry for ${entry.entryDate}`}
                      title={`Edit ${entry.entryDate} entry`}
                      className="text-xs md:text-sm uppercase tracking-wider hover:bg-pink hover:text-claret hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                    >
                      <Pencil className="size-4 md:size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedWeightForDelete(entry) }}
                      aria-label={`Delete weight entry for ${entry.entryDate}`}
                      title={`Delete ${entry.entryDate} entry`}
                      className="text-xs md:text-sm uppercase tracking-wider hover:bg-pink hover:text-claret hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(255,189,197,0.45)]"
                    >
                      <Trash2 className="size-4 md:size-5" />
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-base md:text-lg tracking-normal">{entry.note}</p>
              </article>
            ))}
          </div>
        </section>

        {weightsMeta && (
          <PaginationControls
            page={weightsMeta.page}
            totalPages={Math.max(1, Math.ceil(weightsMeta.total / weightsMeta.limit))}
            onPageChange={setWeightsPage}
            label="Weights"
            className="text-pink"
          />
        )}

        {selectedRecipe ? (
          <ModalFrame onClose={() => setSelectedRecipe(null)}>
            <ModalHead>{selectedRecipe.title}</ModalHead>
            <ModalBody>
              <div className="flex h-full gap-2">
                <div className="rounded-xl border border-claret/20 bg-claret/95 p-4 text-pink w-1/2">
                  <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Servings</p>
                  <p className="text-2xl md:text-3xl font-bold">{selectedRecipe.servings}</p>
                </div>

                <div className="rounded-xl border border-claret/20 bg-claret/95 p-4 text-pink w-1/2">
                  <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Calories</p>
                  <p className="text-2xl md:text-3xl font-bold">{selectedRecipe.caloriesPerServing} <span className="text-lg md:text-xl">per serving</span></p>
                </div>  
              </div>
              

              <div className="mt-5">
                <p className="text-xl md:text-2xl uppercase tracking-widest opacity-80">Steps</p>
                {selectedRecipe.steps?.length ? (
                  <ol className="mt-2 space-y-3">
                    {selectedRecipe.steps.map((step, index) => (
                      <li key={`${selectedRecipe._id}-step-${index}`} className="flex gap-3 rounded-xl border border-claret/20 p-3 tracking-normal">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-claret text-sm text-pink">{index + 1}</span>
                        <span className="text-lg md:text-xl">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-lg md:text-xl tracking-normal opacity-75">No steps added yet.</p>
                )}
              </div>

              <div className="mt-5">
                <p className="text-xl md:text-2xl uppercase tracking-widest opacity-80">Notes</p>
                <p className="mt-1 text-lg md:text-xl tracking-normal whitespace-pre-wrap">{selectedRecipe.notes || "No notes added yet."}</p>
              </div>

              {selectedRecipe.link ? (
                <a
                  href={selectedRecipe.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-claret px-4 py-3 text-sm uppercase tracking-widest hover:bg-claret hover:text-pink"
                >
                  <ExternalLink className="size-4" />
                  Open Recipe Link
                </a>
              ) : null}
            </ModalBody>

            <ModalFooter>
              <div className="flex w-full justify-center gap-4 px-4">
                <button
                  type="button"
                  onClick={() => { setSelectedRecipeForEdit(selectedRecipe); setSelectedRecipe(null) }}
                  aria-label={`Edit ${selectedRecipe.title}`}
                  title={`Edit ${selectedRecipe.title}`}
                  className="inline-flex items-center gap-1.5 justify-center rounded-2xl border border-claret bg-claret px-12 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                >
                  <Pencil className="size-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedRecipeForDelete(selectedRecipe); setSelectedRecipe(null) }}
                  aria-label={`Delete ${selectedRecipe.title}`}
                  title={`Delete ${selectedRecipe.title}`}
                  className="inline-flex items-center gap-1.5 justify-center rounded-2xl border border-claret bg-pink px-12 py-3 text-sm md:text-base uppercase tracking-widest text-claret hover:bg-claret/80 hover:text-pink transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>  
              </div>
              

            </ModalFooter>
          </ModalFrame>
        ) : null}

        <DeleteConfirmationModal
          open={Boolean(selectedRecipeForDelete)}
          onClose={() => setSelectedRecipeForDelete(null)}
          itemName={selectedRecipeForDelete?.title ?? ""}
          itemType="recipe"
          onConfirm={async () => {
            if (!selectedRecipeForDelete?._id) return
            try {
              const { deleteRecipe } = await import('@/lib/api')
              await deleteRecipe(selectedRecipeForDelete._id)
              toast.push({ type: 'success', message: 'Recipe deleted' })
              window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'recipe' } }))
            } catch (err) {
              console.error(err)
              toast.push({ type: 'error', message: 'Failed to delete recipe' })
            }
          }}
        />

        <DeleteConfirmationModal
          open={Boolean(selectedWeightForDelete)}
          onClose={() => setSelectedWeightForDelete(null)}
          itemName={selectedWeightForDelete?.entryDate ?? ""}
          itemType="weight entry"
          onConfirm={async () => {
            if (!selectedWeightForDelete?._id) return
            try {
              const { deleteWeight } = await import('@/lib/api')
              await deleteWeight(selectedWeightForDelete._id)
              toast.push({ type: 'success', message: 'Weight entry deleted' })
              window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'weight' } }))
            } catch (err) {
              console.error(err)
              toast.push({ type: 'error', message: 'Failed to delete weight entry' })
            }
          }}
        />
        <NewRecipeModal open={isNewRecipeOpen} onClose={() => setIsNewRecipeOpen(false)} />
        <EditRecipeModal open={Boolean(selectedRecipeForEdit)} onClose={() => setSelectedRecipeForEdit(null)} recipe={selectedRecipeForEdit} />
        <NewWeightModal open={isNewWeightOpen} onClose={() => setIsNewWeightOpen(false)} />
        <EditWeightModal open={Boolean(selectedWeightForEdit)} onClose={() => setSelectedWeightForEdit(null)} weight={selectedWeightForEdit} />

        {selectedWeightEntry ? (
          <ModalFrame onClose={() => setSelectedWeightEntry(null)}>
            <ModalHead>Weight Entry — {new Date(selectedWeightEntry.entryDate).toLocaleDateString()}</ModalHead>
            <ModalBody>
              <div className="flex justify-center h-full gap-2">
                <div className="rounded-xl border border-claret/20 bg-claret/95 p-4 text-pink w-1/2">
                  <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Weight</p>
                  <p className="text-2xl md:text-3xl font-bold">{selectedWeightEntry.weightKg}</p>
                </div>

                {selectedWeightEntry.changeKg ? (
                  <div className="rounded-xl border border-claret/20 bg-claret/95 p-4 text-pink w-1/2">
                    <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Change</p>
                    <p className="text-2xl md:text-3xl font-bold">{selectedWeightEntry.changeKg}</p>
                  </div>
                ) : null}
              </div>
              

              <div>
                <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Notes</p>
                <p className="mt-2 text-base md:text-lg tracking-normal">{selectedWeightEntry.note}</p>
              </div>
            </ModalBody>

            <ModalFooter>
              <div className="flex w-full justify-center gap-4 px-4">
                <button
                  type="button"
                  onClick={() => { setSelectedWeightForEdit(selectedWeightEntry); setSelectedWeightEntry(null) }}
                  aria-label={`Edit weight entry for ${selectedWeightEntry.entryDate}`}
                  title={`Edit weight entry for ${selectedWeightEntry.entryDate}`}
                  className="inline-flex items-center gap-1.5 justify-center rounded-2xl border border-claret bg-claret px-12 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                >
                  <Pencil className="size-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedWeightForDelete(selectedWeightEntry); setSelectedWeightEntry(null) }}
                  aria-label={`Delete weight entry for ${selectedWeightEntry.entryDate}`}
                  title={`Delete weight entry for ${selectedWeightEntry.entryDate}`}
                  className="inline-flex items-center gap-1.5 justify-center rounded-2xl border border-claret bg-pink px-12 py-3 text-sm md:text-base uppercase tracking-widest text-claret hover:bg-claret/80 hover:text-pink transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>  
              </div>
            </ModalFooter>
          </ModalFrame>
        ) : null}
      </section>
    </Layout>
  );
}
