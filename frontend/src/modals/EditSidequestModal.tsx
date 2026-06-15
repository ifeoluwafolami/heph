import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { ArrowDown, ArrowUp, Save, Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { updateSidequest, type SidequestDto } from "@/lib/api";
import { useToast } from "@/components/Toast";

type EditSidequestModalProps = { 
  open: boolean
  onClose: () => void
  sidequest?: SidequestDto
}
type SidequestMilestone = { id: string; title: string; done: boolean; cost?: number }

export default function EditSidequestModal({ open, onClose, sidequest }: EditSidequestModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [cost, setCost] = useState("")
  const [milestoneTitle, setMilestoneTitle] = useState("")
  const [milestones, setMilestones] = useState<SidequestMilestone[]>([])
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

  const milestoneCostTotal = milestones.reduce((sum, milestone) => sum + (milestone.cost || 0), 0)
  const resolvedCost = milestones.length > 0 ? milestoneCostTotal : Number(cost)

  async function handleSave() {
    if (!title || !description || !Number.isFinite(resolvedCost) || !sidequest) return
    if (milestones.length === 0 && !cost) return
    setLoading(true)
    try {
      await updateSidequest(sidequest._id, { 
        title, 
        description, 
        cost: resolvedCost,
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
    setMilestones((prev) => [...prev, { id: `ms-${Date.now()}-${prev.length}`, title: text, done: false, cost: 0 }])
    setMilestoneTitle("")
  }

  function moveMilestone(index: number, direction: -1 | 1) {
    setMilestones((prev) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const current = next[index]
      const target = next[nextIndex]
      if (!current || !target) return prev
      next[index] = target
      next[nextIndex] = current
      return next
    })
  }

  const hasUnsavedChanges = () => {
    if (!sidequest) return false
    return (
      title.trim() !== sidequest.title ||
      description.trim() !== sidequest.description ||
      resolvedCost !== sidequest.cost ||
      milestoneTitle.trim().length > 0 ||
      JSON.stringify(milestones) !== JSON.stringify(sidequest.milestones || [])
    )
  }

  return (
    <ModalFrame onClose={onClose} shouldConfirmClose={hasUnsavedChanges}>
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
          <input
            value={milestones.length > 0 ? String(milestoneCostTotal) : cost}
            onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))}
            type="text"
            inputMode="numeric"
            readOnly={milestones.length > 0}
            className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2 read-only:opacity-70"
          />
          {milestones.length > 0 && <span className="text-xs uppercase tracking-widest text-claret/70">Calculated from milestone costs</span>}
        </label>
        <div className="mt-4 space-y-2">
          <span className="text-sm uppercase tracking-widest">Milestones (Optional)</span>
          {milestones.length > 0 && (
            <ul className="space-y-2">
              {milestones.map((m, index) => (
                <li key={m.id} className="flex items-center gap-2 rounded-xl border border-claret/20 px-3 py-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveMilestone(index, -1)}
                      disabled={index === 0}
                      aria-label="Move milestone up"
                      title="Move milestone up"
                      className="inline-flex items-center justify-center rounded-md p-1 hover:bg-claret hover:text-pink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-claret"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMilestone(index, 1)}
                      disabled={index === milestones.length - 1}
                      aria-label="Move milestone down"
                      title="Move milestone down"
                      className="inline-flex items-center justify-center rounded-md p-1 hover:bg-claret hover:text-pink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-claret"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
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
                  <input
                    value={String(m.cost ?? 0)}
                    onChange={(e) => setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, cost: Number(e.target.value.replace(/[^0-9]/g, '') || 0) } : x))}
                    inputMode="numeric"
                    aria-label="Milestone cost"
                    title="Milestone cost"
                    className="w-24 rounded-lg border border-claret/20 bg-pink px-2 py-1"
                    placeholder="0"
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
