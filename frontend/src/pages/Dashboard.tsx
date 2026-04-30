import Layout from "@/components/Layout";
import MonthlyOverview from "@/components/MonthlyOverview";
import RecentExpenses from "@/components/RecentExpenses";
import RecentMementos from "@/components/RecentMementos";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardOverview, getRecentDashboardExpenses, getRecentDashboardMementos, getBudgets } from "@/lib/api";
import NewExpenseModal from "@/modals/NewExpenseModal";
import NewMementoModal from "@/modals/NewMementoModal";
import NewRecipeModal from "@/modals/NewRecipeModal";
import NewWeightModal from "@/modals/NewWeightModal";
import EditBudgetsModal from "@/modals/EditBudgetsModal";

export default function Dashboard() {
    const [greeting, setGreeting] = useState("");
    const [nickname, setNickname] = useState("princess");
    const [showQuickActions, setShowQuickActions] = useState(false);

    useEffect(() => {
        const formatter = new Intl.DateTimeFormat("en-NG", {
            timeZone: "Africa/Lagos",
            hour: "2-digit",
            hour12: false,
        });

        const setGreetingByWatHour = () => {
            const hour = Number(formatter.format(new Date()));

            if (hour < 12) {
                setGreeting("Good morning");
            } else if (hour < 18) {
                setGreeting("Good afternoon");
            } else if (hour < 22) {
                setGreeting("Good evening");
            } else {
                setGreeting("Hi")
                setNickname("night owl");
            }
        };

        setGreetingByWatHour();
        const id = window.setInterval(setGreetingByWatHour, 60_000);

        return () => window.clearInterval(id);
    }, []);

    const [summary, setSummary] = useState<{ totalSpent: number; totalBudgeted: number; mementosAdded: number; weightProgressKg: number; newRecipes: number }>({ totalSpent: 0, totalBudgeted: 0, mementosAdded: 0, weightProgressKg: 0, newRecipes: 0 })
    const [recentExpenses, setRecentExpenses] = useState<Array<any>>([])
    const [recentMementos, setRecentMementos] = useState<Array<any>>([])
    const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false)
    const [isNewMementoOpen, setIsNewMementoOpen] = useState(false)
    const [isNewRecipeOpen, setIsNewRecipeOpen] = useState(false)
    const [isNewWeightOpen, setIsNewWeightOpen] = useState(false)
    const [isEditBudgetsOpen, setIsEditBudgetsOpen] = useState(false)
    const [budgetsForEdit, setBudgetsForEdit] = useState<Array<any>>([])
        const navigate = useNavigate()

        function RecipeButton() {
            return (
                <button type="button" onClick={() => navigate('/ounje')} className="border border-claret rounded-2xl p-2 md:p-4 focus:outline-none focus:ring-offset-2 focus:ring-offset-pink focus:ring-2 focus:ring-claret bg-claret text-pink uppercase tracking-widest md:text-lg hover:bg-claret/90 transition-all">Check a Recipe</button>
            )
        }

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const overview = await getDashboardOverview()
                if (!mounted) return
                setGreeting((g) => g)
                setSummary({
                    totalSpent: overview.totalSpent,
                    totalBudgeted: overview.totalBudgeted,
                    mementosAdded: overview.mementosAdded,
                    weightProgressKg: overview.weightProgressKg,
                    newRecipes: overview.newRecipes,
                })

                const expenses = await getRecentDashboardExpenses(10)
                if (!mounted) return
                // fetch budgets to map categoryId to name
                const budgets = await getBudgets()
                if (!mounted) return
                const map = new Map<string, string>()
                budgets.forEach((b: any) => map.set(b._id, b.name))
                setRecentExpenses(expenses.map((e: any) => ({
                    title: e.title,
                    date: new Date(e.expenseDate).toLocaleDateString(),
                    amount: (e.amount || 0).toString(),
                    category: e.categoryId ? map.get(e.categoryId) ?? null : null,
                })))

                const mementos = await getRecentDashboardMementos(3)
                if (!mounted) return
                setRecentMementos(mementos)
            } catch (err) {
                // ignore for now
            }
        }

        load()
            const handler = () => { load().catch(() => {}) }
            const dataHandler = (ev: Event) => {
                const detail = (ev as CustomEvent)?.detail
                if (!detail || !detail.resource) return load().catch(() => {})
                if (detail.resource === 'memento' || detail.resource === 'expense' || detail.resource === 'budget') return load().catch(() => {})
            }
            window.addEventListener('heph:expense:created', handler as EventListener)
            window.addEventListener('heph:data:changed', dataHandler as EventListener)
                return () => { mounted = false; window.removeEventListener('heph:expense:created', handler as EventListener); window.removeEventListener('heph:data:changed', dataHandler as EventListener) }
    }, [])

    return (
        <Layout>
            <div className="w-full overflow-y-auto">
                <div className="min-h-16 rounded-2xl p-4 md:p-8 bg-pink text-claret w-full cursor-pointer transition-all duration-300" onClick={() => setShowQuickActions((prev) => !prev)}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl md:text-4xl font-bold uppercase md:mb-4">{greeting}, {nickname}!</h3>
                            <p className="text-lg md:text-2xl">I am so glad to see you. <br className="md:hidden" />What are we doing today?</p>    
                        </div>
                        <div className="flex items-center justify-center shrink-0 pl-4">
                            {showQuickActions ? <><ChevronUp className="size-4 md:hidden" /><ChevronUp className="size-6 hidden md:flex" /></> : <><ChevronDown className="size-4 md:hidden" /><ChevronDown className="size-6 hidden md:flex" /></>}
                        </div>
                            
                    </div>
                    
                    <div
                        className={`grid overflow-hidden transition-all duration-500 ease-in-out ${
                            showQuickActions ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
                        }`}
                    >
                        <div className="min-h-0">
                            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                <button type="button" onClick={() => setIsNewExpenseOpen(true)} className="border border-claret rounded-2xl p-2 md:p-4 focus:outline-none focus:ring-offset-2 focus:ring-offset-pink focus:ring-2 focus:ring-claret bg-claret text-pink uppercase tracking-widest md:text-lg hover:bg-claret/90 transition-all ">Create an Expense</button>
                                <button type="button" onClick={() => setIsNewMementoOpen(true)} className="border border-claret rounded-2xl p-2 md:p-4 focus:outline-none focus:ring-offset-2 focus:ring-offset-pink focus:ring-2 focus:ring-claret bg-claret text-pink uppercase tracking-widest md:text-lg hover:bg-claret/90 transition-all">Add a Memento</button>
                                <RecipeButton />
                                <button type="button" onClick={() => setIsNewWeightOpen(true)} className="border border-claret rounded-2xl p-2 md:p-4 focus:outline-none focus:ring-offset-2 focus:ring-offset-pink focus:ring-2 focus:ring-claret bg-claret text-pink uppercase tracking-widest md:text-lg hover:bg-claret/90 transition-all">Log Weight</button>
                                <button type="button" onClick={async () => { try { const b = await getBudgets(); setBudgetsForEdit(b); setIsEditBudgetsOpen(true) } catch (err) { console.error(err) } }} className="border border-claret rounded-2xl p-2 md:p-4 focus:outline-none focus:ring-offset-2 focus:ring-offset-pink focus:ring-2 focus:ring-claret bg-claret text-pink uppercase tracking-widest md:text-lg hover:bg-claret/90 transition-all">Edit Budgets</button>
                            </div>
                        </div>
                    </div>
                </div>

                <MonthlyOverview totalSpent={summary.totalSpent} totalBudgeted={summary.totalBudgeted} mementosAdded={summary.mementosAdded} weightProgressKg={summary.weightProgressKg} newRecipes={summary.newRecipes} />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <RecentExpenses expenses={recentExpenses} />
                    <RecentMementos mementos={recentMementos.map((m: any) => ({ title: m.title, preview: m.content.slice(0, 120), date: new Date(m.createdAt).toLocaleDateString() }))} />
                </div>

                <NewExpenseModal open={isNewExpenseOpen} onClose={() => setIsNewExpenseOpen(false)} />
                <NewMementoModal open={isNewMementoOpen} onClose={() => setIsNewMementoOpen(false)} />
                <NewRecipeModal open={isNewRecipeOpen} onClose={() => setIsNewRecipeOpen(false)} />
                <NewWeightModal open={isNewWeightOpen} onClose={() => setIsNewWeightOpen(false)} />
                <EditBudgetsModal open={isEditBudgetsOpen} onClose={() => setIsEditBudgetsOpen(false)} budgets={budgetsForEdit} />

                <div className="h-10"></div>
            </div>
        </Layout>
    )
}