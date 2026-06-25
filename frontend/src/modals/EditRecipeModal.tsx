import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { updateRecipe } from "@/lib/api";
import { useToast } from "@/components/Toast";

type Recipe = { _id?: string; title: string; servings: number; caloriesPerServing: number; steps?: string[]; notes?: string; link?: string }
type EditRecipeModalProps = { open: boolean; onClose: () => void; recipe: Recipe | null }

export default function EditRecipeModal({ open, onClose, recipe }: EditRecipeModalProps) {
  const [title, setTitle] = useState("")
  const [servings, setServings] = useState("1")
  const [calories, setCalories] = useState("0")
  const [steps, setSteps] = useState<string[]>([""])
  const [notes, setNotes] = useState("")
  const [link, setLink] = useState("")
  const toast = useToast()

  useEffect(() => {
    if (!recipe) return
    setTitle(recipe.title ?? "")
    setServings(String(recipe.servings ?? 1))
    setCalories(String(recipe.caloriesPerServing ?? 0))
    setSteps(recipe.steps && recipe.steps.length > 0 ? recipe.steps : [""])
    setNotes(recipe.notes ?? "")
    setLink(recipe.link ?? "")
  }, [recipe])

  if (!open || !recipe) return null

  async function handleUpdate() {
    const id = recipe?._id
    if (!id) return
    try {
      await updateRecipe(id, {
        title,
        servings: Number(servings) || 0,
        caloriesPerServing: Number(calories) || 0,
        steps: steps.map((step) => step.trim()).filter(Boolean),
        notes: notes || undefined,
        link: link || undefined,
      })
      toast.push({ type: 'success', message: 'Recipe updated' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'recipe' } }))
      onClose()
    } catch (err) { console.error(err); toast.push({ type: 'error', message: 'Failed to update recipe' }) }
  }

  function updateStep(index: number, value: string) {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? value : step)))
  }

  function removeStep(index: number) {
    setSteps((current) => (current.length === 1 ? [""] : current.filter((_, stepIndex) => stepIndex !== index)))
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit {recipe.title}</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Servings</span>
            <input type="text" value={servings} onChange={(e) => setServings(e.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Calories / Serving</span>
            <input type="text" value={calories} onChange={(e) => setCalories(e.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
          </label>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-widest">Recipe Steps</p>
            <button
              type="button"
              onClick={() => setSteps((current) => [...current, ""])}
              className="inline-flex items-center gap-2 rounded-xl border border-claret px-3 py-2 text-xs uppercase tracking-widest hover:bg-claret hover:text-pink"
            >
              <Plus className="size-4" />
              Step
            </button>
          </div>
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-2 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-claret text-sm text-pink">{index + 1}</span>
              <textarea
                value={step}
                onChange={(e) => updateStep(index, e.target.value)}
                rows={2}
                className="min-h-20 w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
              />
              <button
                type="button"
                onClick={() => removeStep(index)}
                aria-label={`Remove step ${index + 1}`}
                title={`Remove step ${index + 1}`}
                className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-claret/40 hover:bg-claret hover:text-pink"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <label className="block space-y-1 mt-3">
          <span className="text-sm uppercase tracking-widest">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Link</span>
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={handleUpdate} disabled={!title || !(Number(servings) > 0) || !(Number(calories) >= 0)} className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
          <Pencil className="size-4" /> Update Recipe
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}
