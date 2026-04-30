import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Plus } from "lucide-react";
import { useState } from "react";
import CustomDateInput from "@/components/CustomDateInput";
import { createWeight } from "@/lib/api";
import { useToast } from "@/components/Toast";

type NewWeightModalProps = { open: boolean; onClose: () => void }

export default function NewWeightModal({ open, onClose }: NewWeightModalProps) {
  const [weightKg, setWeightKg] = useState("")
  const [entryDate, setEntryDate] = useState("")
  const [note, setNote] = useState("")
  const toast = useToast()

  if (!open) return null

  function sanitizeNumberInput(v: string) {
    // allow digits and at most one dot
    let s = v.replace(/[^0-9.]/g, '')
    const parts = s.split('.')
    if (parts.length > 2) s = parts.shift() + '.' + parts.join('')
    return s
  }

  async function handleCreate() {
    const wt = Number(weightKg || 0)
    if (!wt || !entryDate) return
    try {
      await createWeight({ weightKg: wt, entryDate, note: note || undefined })
      toast.push({ type: 'success', message: 'Weight saved' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'weight' } }))
      onClose()
    } catch (err) { console.error(err); toast.push({ type: 'error', message: 'Failed to save weight' }) }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Log Weight</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Weight (kg)</span>
          <input type="text" value={weightKg} onChange={(e) => setWeightKg(sanitizeNumberInput(e.target.value))} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Date</span>
          <CustomDateInput value={entryDate} onChange={(v) => setEntryDate(v)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Note</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
      </ModalBody>
      <ModalFooter>
        <button onClick={handleCreate} disabled={!(Number(weightKg || 0) > 0) || !entryDate} className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="size-4" /> Save</button>
      </ModalFooter>
    </ModalFrame>
  )
}
