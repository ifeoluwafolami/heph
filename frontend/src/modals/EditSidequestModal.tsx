import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Save, Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { updateSidequest, type SidequestDto } from "@/lib/api";
import { useToast } from "@/components/Toast";

type EditSidequestModalProps = { 
  open: boolean
  onClose: () => void
  sidequest?: SidequestDto
}

export default function EditSidequestModal({ open, onClose, sidequest }: EditSidequestModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [cost, setCost] = useState("")
  const [milestoneTitle, setMilestoneTitle] = useState("")
  const [milestones, setMilestones] = useState<Array<{ id: string; title: string; done: boolean }>>([])
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open && sidequest) {
      setTitle(sidequest.title)
      setDescription(sidequest.description)
      setCost(sidequest.cost.toString())
      setMilestones(sidequest.milestones || [])
    } else if (!open) {
      setTitle("")
      setDescription("")
      setCost("")
      setMilestoneTitle("")
      setMilestones([])
      setLoading(false)
    }
  }, [open, sidequest])

  if (!open || !sidequest) return null

  async function handleSave() {
    if (!title || !description || !cost || !sidequest) return
    setLoading(true)
    try {
      await updateSidequest(sidequest._id, { 
        title, 
        description, 
        cost: Number(cost),
        milestones,
      })
      toast.push({ type: 'success', message: 'Sidequest updated' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'sidequest' } }))
      onClose()
    } catch (err) { 
      console.error(err)
      toast.push({ type: 'error', message: 'Failed to update sidequest' })
    }
    finally {
      setLoading(false)
    }
  }

  function addMilestone() {
    const text = milestoneTitle.trim()
    if (!text) return
    setMilestones((prev) => [...prev, { id: `ms-${Date.now()}-${prev.length}`, title: text, done: false }])
    setMilestoneTitle("")
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit Sidequest</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <label className="block space-y-1 mt-3">
          <span className="text-sm uppercase tracking-widest">Description</span>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
          />
        </label>
        <label className="block space-y-1 mt-3">
          <span className="text-sm uppercase tracking-widest">Cost</span>
          <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))} type="text" inputMode="numeric" className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <div className="mt-4 space-y-2">
          <span className="text-sm uppercase tracking-widest">Milestones (Optional)</span>
          {milestones.length > 0 && (
            <ul className="space-y-2">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-xl border border-claret/20 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={m.done}
                    onChange={(e) => setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, done: e.target.checked } : x))}
                  />
                  <input
                    value={m.title}
                    onChange={(e) => setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, title: e.target.value } : x))}
                    className="w-full rounded-lg border border-claret/20 bg-pink px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => setMilestones((prev) => prev.filter((x) => x.id !== m.id))}
                    aria-label="Remove milestone"
                    title="Remove milestone"
                    className="inline-flex items-center justify-center rounded-md p-1 hover:bg-claret hover:text-pink transition-all"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
              placeholder="Add milestone"
            />
            <button type="button" onClick={addMilestone} aria-label="Add milestone" title="Add milestone" className="inline-flex items-center justify-center rounded-xl border border-claret px-3 py-2 uppercase tracking-widest text-xs hover:bg-claret hover:text-pink transition-all"><Plus className="size-4" /></button>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button onClick={handleSave} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center disabled:opacity-50 disabled:cursor-not-allowed"><Save className="size-4" /> Save</button>
      </ModalFooter>
    </ModalFrame>
  )
}
