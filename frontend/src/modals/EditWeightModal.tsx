import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import CustomDateInput from "@/components/CustomDateInput";
import { updateWeight } from "@/lib/api";
import { useToast } from "@/components/Toast";

type Weight = { _id?: string; weightKg: number; entryDate: string; note?: string }
type EditWeightModalProps = { open: boolean; onClose: () => void; weight: Weight | null }

export default function EditWeightModal({ open, onClose, weight }: EditWeightModalProps) {
  const [weightKg, setWeightKg] = useState<string>(String(weight?.weightKg ?? ""))
  const [entryDate, setEntryDate] = useState(weight?.entryDate ?? "")
  const [note, setNote] = useState(weight?.note ?? "")
  const toast = useToast()

  useEffect(() => {
    if (!weight) return
    setWeightKg(String(weight.weightKg ?? ""))
    setEntryDate(weight.entryDate ?? "")
    setNote(weight.note ?? "")
  }, [weight])

  if (!open || !weight) return null

  function sanitizeNumberInput(v: string) {
    let s = v.replace(/[^0-9.]/g, '')
    const parts = s.split('.')
    if (parts.length > 2) s = parts.shift() + '.' + parts.join('')
    return s
  }

  async function handleUpdate() {
    if (!weight._id) return
    try {
      await updateWeight(weight._id, { weightKg: Number(weightKg || 0), entryDate, note: note || undefined })
      toast.push({ type: 'success', message: 'Weight updated' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'weight' } }))
      onClose()
    } catch (err) { console.error(err); toast.push({ type: 'error', message: 'Failed to update weight' }) }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit Weight</ModalHead>
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
        <button onClick={handleUpdate} disabled={!(Number(weightKg || 0) > 0) || !entryDate} className="flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center disabled:opacity-40 disabled:cursor-not-allowed"><Pencil className="size-4" /> Update</button>
      </ModalFooter>
    </ModalFrame>
  )
}
