import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Plus } from "lucide-react";
import { useState } from "react";
import { createRecipe } from "@/lib/api";
import { useToast } from "@/components/Toast";

type NewRecipeModalProps = { open: boolean; onClose: () => void };

export default function NewRecipeModal({ open, onClose }: NewRecipeModalProps) {
  const [title, setTitle] = useState("")
    const [servings, setServings] = useState("1")
    const [calories, setCalories] = useState("0")
  const [notes, setNotes] = useState("")
  const toast = useToast()

  if (!open) return null

  async function handleCreate() {
    if (!title) return
    try {
      await createRecipe({ title, servings: Number(servings) || 0, caloriesPerServing: Number(calories) || 0, notes: notes || undefined })
      toast.push({ type: 'success', message: 'Recipe created' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'recipe' } }))
      onClose()
    } catch (err) {
      console.error(err)
      toast.push({ type: 'error', message: 'Failed to create recipe' })
    }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>New Recipe</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Servings</span>
              <input type="text" value={servings} onChange={(e) => setServings(e.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm uppercase tracking-widest">Calories / Serving</span>
              <input type="text" value={calories} onChange={(e) => setCalories(e.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
          </label>
        </div>
        <label className="block space-y-1 mt-3">
          <span className="text-sm uppercase tracking-widest">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={handleCreate} disabled={!title || !(Number(servings) > 0) || !(Number(calories) >= 0)} className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="size-4" /> Create Recipe
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}
