import Layout from "@/components/Layout";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Pencil, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { getRecipes, getWeights } from "@/lib/api";
import NewRecipeModal from "@/modals/NewRecipeModal";
import EditRecipeModal from "@/modals/EditRecipeModal";
import NewWeightModal from "@/modals/NewWeightModal";
import EditWeightModal from "@/modals/EditWeightModal";

type Recipe = {
  _id: string
  title: string;
  servings: number;
  caloriesPerServing: number;
  notes?: string;
};

type WeightEntry = {
  _id: string
  weightKg: number;
  entryDate: string;
  changeKg?: number;
  note?: string;
};

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
  const toast = useToast()

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
              </div>
            </article>
          ))}
        </div>

        {recipesMeta && Math.max(1, Math.ceil(recipesMeta.total / recipesMeta.limit)) > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={recipesMeta.page <= 1}
              onClick={() => setRecipesPage((p) => Math.max(1, p - 1))}
              className="rounded-md border px-3 py-2 bg-claret text-pink"
              aria-label="Previous recipes page"
            >
              <ChevronLeft />
            </button>
            <div className="text-claret">Page {recipesMeta.page} / {Math.max(1, Math.ceil(recipesMeta.total / recipesMeta.limit))}</div>
            <button
              type="button"
              disabled={recipesMeta.page >= Math.ceil(recipesMeta.total / recipesMeta.limit)}
              onClick={() => setRecipesPage((p) => p + 1)}
              className="rounded-md border px-3 py-2 bg-claret text-pink"
              aria-label="Next recipes page"
            >
              <ChevronRight />
            </button>
          </div>
        ) : null}

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

        {weightsMeta && Math.max(1, Math.ceil(weightsMeta.total / weightsMeta.limit)) > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={weightsMeta.page <= 1}
              onClick={() => setWeightsPage((p) => Math.max(1, p - 1))}
              className="rounded-md border px-3 py-2 bg-claret text-pink"
              aria-label="Previous weights page"
            >
              <ChevronLeft />
            </button>
            <div className="text-claret">Page {weightsMeta.page} / {Math.max(1, Math.ceil(weightsMeta.total / weightsMeta.limit))}</div>
            <button
              type="button"
              disabled={weightsMeta.page >= Math.ceil(weightsMeta.total / weightsMeta.limit)}
              onClick={() => setWeightsPage((p) => p + 1)}
              className="rounded-md border px-3 py-2 bg-claret text-pink"
              aria-label="Next weights page"
            >
              <ChevronRight />
            </button>
          </div>
        ) : null}

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
                <p className="text-xl md:text-2xl uppercase tracking-widest opacity-80">Notes</p>
                <p className="mt-1 text-lg md:text-xl tracking-normal">{selectedRecipe.notes}</p>
              </div>
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
            <ModalHead>Weight Entry — {selectedWeightEntry.date}</ModalHead>
            <ModalBody>
              <div className="flex justify-center h-full gap-2">
                <div className="rounded-xl border border-claret/20 bg-claret/95 p-4 text-pink w-1/2">
                  <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Weight</p>
                  <p className="text-2xl md:text-3xl font-bold">{selectedWeightEntry.weight}</p>
                </div>

                {selectedWeightEntry.change ? (
                  <div className="rounded-xl border border-claret/20 bg-claret/95 p-4 text-pink w-1/2">
                    <p className="text-sm md:text-base uppercase tracking-widest opacity-80">Change</p>
                    <p className="text-2xl md:text-3xl font-bold">{selectedWeightEntry.change}</p>
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
                  aria-label={`Edit weight entry for ${selectedWeightEntry.date}`}
                  title={`Edit weight entry for ${selectedWeightEntry.date}`}
                  className="inline-flex items-center gap-1.5 justify-center rounded-2xl border border-claret bg-claret px-12 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                >
                  <Pencil className="size-4" />
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete weight entry for ${selectedWeightEntry.date}`}
                  title={`Delete weight entry for ${selectedWeightEntry.date}`}
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