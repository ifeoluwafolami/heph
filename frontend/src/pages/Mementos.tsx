import Layout from "@/components/Layout";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import { Pencil, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { getMementos } from "@/lib/api";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import NewMementoModal from "@/modals/NewMementoModal";
import EditMementoModal from "@/modals/EditMementoModal";

type Memento = {
  _id: string
  title: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
}

export default function Mementos() {
  const [selectedMemento, setSelectedMemento] = useState<Memento | null>(null);
  const [selectedMementoForDelete, setSelectedMementoForDelete] = useState<Memento | null>(null);
  const [selectedMementoForEdit, setSelectedMementoForEdit] = useState<Memento | null>(null);
  const [isNewMementoOpen, setIsNewMementoOpen] = useState(false)
  const [mementos, setMementos] = useState<Memento[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(12)
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number } | null>(null)
  const toast = useToast()

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const items = await getMementos(limit, page)
        if (!mounted) return
        setMementos(items)
        // attach pagination meta when available
        // @ts-ignore
        if ((items as any)._meta) setMeta((items as any)._meta)
      } catch (_err) {
        // ignore
      }
    }
    load()
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail
      if (!detail || !detail.resource || detail.resource === 'memento') load()
    }
    window.addEventListener('heph:data:changed', handler)
    return () => { mounted = false; window.removeEventListener('heph:data:changed', handler) }
  }, [page, limit])

  return (
    <Layout>
      <section className="w-full">
        <div className="rounded-2xl bg-pink text-claret p-6 md:p-8 shadow-xl border border-claret/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-3xl md:text-5xl font-bold uppercase">Memento</h1>
                <p className="mt-2 text-lg md:text-2xl">Need to yap? I am always here to listen! What's on your mind, my dearest?</p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewMementoOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink w-fit"
            >
              <Plus className="size-4 md:size-5" />
              Add a Memento
            </button>
          </div>
        </div>

        {meta && Math.max(1, Math.ceil(meta.total / meta.limit)) > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border px-3 py-2 bg-claret text-pink"
              aria-label="Previous page"
            >
              <ChevronLeft />
            </button>
            <div className="text-claret">Page {meta.page} / {Math.max(1, Math.ceil(meta.total / meta.limit))}</div>
            <button
              type="button"
              disabled={meta.page >= Math.ceil(meta.total / meta.limit)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border px-3 py-2 bg-claret text-pink"
              aria-label="Next page"
            >
              <ChevronRight />
            </button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-4">
          {mementos.map((memento) => (
            <article
              key={memento._id}
              className="w-full lg:w-[calc((100%-2rem)/3)] cursor-pointer rounded-2xl border border-claret/30 bg-pink text-claret p-6 md:p-8 shadow-xl transition-all hover:shadow-2xl focus-within:ring-2 focus-within:ring-claret focus-within:ring-offset-2 focus-within:ring-offset-pink"
              onClick={() => setSelectedMemento(memento)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedMemento(memento);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open details for ${memento.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl md:text-3xl font-bold">{memento.title}</h2>

                <div className="flex gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedMementoForEdit(memento) }}
                    aria-label={`Edit ${memento.title}`}
                    title={`Edit ${memento.title}`}
                    className="text-xs md:text-sm uppercase tracking-wider hover:bg-pink hover:text-claret hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(103,6,38,0.45)]"
                  >
                    <Pencil className="size-4 md:size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedMementoForDelete(memento) }}
                    aria-label={`Delete ${memento.title}`}
                    title={`Delete ${memento.title}`}
                    className="text-xs md:text-sm uppercase tracking-wider hover:bg-pink hover:text-claret hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(103,6,38,0.45)]"
                  >
                    <Trash2 className="size-4 md:size-5" />
                  </button>
                </div>
              </div>

              <p className="mt-4 text-lg md:text-xl tracking-normal">{memento.content}</p>

              <div className="mt-6 flex flex-col gap-1 text-sm md:text-base uppercase tracking-wider opacity-80">
                <p>Created: {new Date(memento.createdAt).toLocaleDateString()}</p>
                {memento.editedAt ? <p>Edited: {new Date(memento.editedAt).toLocaleDateString()}</p> : null}
              </div>
            </article>
          ))}
        </div>

        {selectedMemento ? (
          <ModalFrame onClose={() => setSelectedMemento(null)}>
            <ModalHead>{selectedMemento.title}</ModalHead>
            <ModalBody>
              <div>
                <p className="mt-2 text-xl md:text-2xl tracking-normal">{selectedMemento.content}</p>
              </div>

              <div
                className={`flex gap-2 px-12 text-center ${
                  selectedMemento.editedAt ? "justify-between" : "justify-center"
                }`}
              >
                <div className="text-claret">
                  <p className="text-xs md:text-sm uppercase tracking-widest opacity-80">Created</p>
                  <p className="text-sm md:text-base font-bold">{new Date(selectedMemento.createdAt).toLocaleDateString()}</p>
                </div>

                {selectedMemento.editedAt ? (
                  <div className="text-claret">
                    <p className="text-xs md:text-sm uppercase tracking-widest opacity-80">Edited</p>
                    <p className="text-sm md:text-base font-bold">{new Date(selectedMemento.editedAt).toLocaleDateString()}</p>
                  </div>
                ) : null}
              </div>
              
            </ModalBody>

            <ModalFooter>
              <div className="flex w-full justify-center gap-4 px-4">
                <button
                  type="button"
                  onClick={() => { setSelectedMementoForEdit(selectedMemento); setSelectedMemento(null) }}
                  aria-label={`Edit ${selectedMemento.title}`}
                  title={`Edit ${selectedMemento.title}`}
                  className="inline-flex items-center gap-1.5 justify-center rounded-2xl border border-claret bg-claret px-12 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
                >
                  <Pencil className="size-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedMementoForDelete(selectedMemento); setSelectedMemento(null) }}
                  aria-label={`Delete ${selectedMemento.title}`}
                  title={`Delete ${selectedMemento.title}`}
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
          open={Boolean(selectedMementoForDelete)}
          onClose={() => setSelectedMementoForDelete(null)}
          itemName={selectedMementoForDelete?.title ?? ""}
          itemType="memento"
          onConfirm={async () => {
            if (!selectedMementoForDelete?._id) return
            try {
              const { deleteMemento } = await import('@/lib/api')
              await deleteMemento(selectedMementoForDelete._id)
              toast.push({ type: 'success', message: 'Memento deleted' })
              window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'memento' } }))
            } catch (err) {
              console.error(err)
              toast.push({ type: 'error', message: 'Failed to delete' })
            }
          }}
        />

        <NewMementoModal open={isNewMementoOpen} onClose={() => setIsNewMementoOpen(false)} />
        <EditMementoModal open={Boolean(selectedMementoForEdit)} onClose={() => setSelectedMementoForEdit(null)} memento={selectedMementoForEdit} />
      </section>
    </Layout>
  );
}