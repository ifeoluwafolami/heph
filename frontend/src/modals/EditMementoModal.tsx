import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { updateMemento } from "@/lib/api";
import { useToast } from "@/components/Toast";

type Memento = { _id?: string; title: string; content: string }
type EditMementoModalProps = { open: boolean; onClose: () => void; memento: Memento | null }

export default function EditMementoModal({ open, onClose, memento }: EditMementoModalProps) {
  const [title, setTitle] = useState(memento?.title ?? "")
  const [content, setContent] = useState(memento?.content ?? "")
  const toast = useToast()

  if (!open || !memento) return null

  async function handleUpdate() {
    if (!memento._id) return
    try {
      await updateMemento(memento._id, { title, content })
      toast.push({ type: 'success', message: 'Memento updated' })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'memento' } }))
      onClose()
    } catch (err) { console.error(err); toast.push({ type: 'error', message: 'Failed to update' }) }
  }

  return (
    <ModalFrame onClose={onClose}>
      <ModalHead>Edit {memento.title}</ModalHead>
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
        <button onClick={handleUpdate} className="flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 justify-center"><Pencil className="size-4" /> Update</button>
      </ModalFooter>
    </ModalFrame>
  )
}
