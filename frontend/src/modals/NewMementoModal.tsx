import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Plus } from "lucide-react";
import { useState } from "react";
import { createMemento } from "@/lib/api";
import { useToast } from "@/components/Toast";

type NewMementoModalProps = { open: boolean; onClose: () => void }

export default function NewMementoModal({ open, onClose }: NewMementoModalProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const toast = useToast()

  if (!open) return null

  async function handleCreate() {
    if (!title) return
    try {
      await createMemento({ title, content })
      toast.push({ type: 'success', message: 'Memento created' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'memento' } }))
      onClose()
    } catch (err) { console.error(err) }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>New Memento</ModalHead>
      <ModalBody>
        <label className="block space-y-1">
          <span className="text-sm uppercase tracking-widest">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
        <label className="block space-y-1 mt-3">
          <span className="text-sm uppercase tracking-widest">Content</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
        </label>
      </ModalBody>
      <ModalFooter>
        <button onClick={handleCreate} className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"><Plus className="size-4" /> Create</button>
      </ModalFooter>
    </ModalFrame>
  )
}
