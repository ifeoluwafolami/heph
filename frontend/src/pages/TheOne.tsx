import Layout from "@/components/Layout";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "@/components/Modal";
import PaginationControls from "@/components/PaginationControls";
import { useToast } from "@/components/Toast";
import { createTheOneItem, deleteTheOneItem, getTheOneItems, updateTheOneItem, type TheOneItemDto } from "@/lib/api";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type LocalTheOneItem = {
  id: string;
  title: string;
  note?: string;
};
type TheOneItem = TheOneItemDto;

const STORAGE_KEY = "heph_man_list";
const MIGRATION_KEY = "heph_man_list_server_migrated";
const ITEMS_PER_PAGE = 5;

function loadCachedItems(): TheOneItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<LocalTheOneItem | TheOneItem>) : [];
    return parsed.map((item) => ({
      _id: "_id" in item ? item._id : item.id,
      title: item.title,
      note: item.note || "",
    }));
  } catch {
    return [];
  }
}

function cacheItems(items: TheOneItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((item) => ({
    id: item._id,
    title: item.title,
    note: item.note,
  }))));
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && (error.message.includes("HTTP 404") || error.message.includes("NOT_FOUND"));
}

export default function TheOne() {
  const toast = useToast();
  const [items, setItems] = useState<TheOneItem[]>(loadCachedItems);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [deletingItem, setDeletingItem] = useState<TheOneItem | null>(null);
  const [editingItem, setEditingItem] = useState<TheOneItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [syncError, setSyncError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function loadServerItems() {
      try {
        const remoteItems = await getTheOneItems();
        if (!mounted) return;

        const cachedItems = loadCachedItems();
        const shouldMigrate = !localStorage.getItem(MIGRATION_KEY) && cachedItems.length > 0;
        if (shouldMigrate) {
          const knownTitles = new Set(remoteItems.map((item) => item.title.trim().toLowerCase()));
          const migrated = await Promise.all(cachedItems
            .filter((item) => !knownTitles.has(item.title.trim().toLowerCase()))
            .map((item) => createTheOneItem({ title: item.title, note: item.note || undefined })));
          const nextItems = [...remoteItems, ...migrated];
          if (!mounted) return;
          setItems(nextItems);
          cacheItems(nextItems);
          localStorage.setItem(MIGRATION_KEY, "true");
          setSyncError("");
          return;
        }

        setItems(remoteItems);
        cacheItems(remoteItems);
        localStorage.setItem(MIGRATION_KEY, "true");
        setSyncError("");
      } catch {
        if (!mounted) return;
        setItems(loadCachedItems());
        setSyncError("Could not sync the list yet. Showing the last version saved on this device.");
      }
    }

    loadServerItems();
    return () => { mounted = false };
  }, []);

  async function addItem() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      const created = await createTheOneItem({ title: cleanTitle, note: note.trim() || undefined });
      setItems((prev) => {
        const nextItems = [...prev, created];
        cacheItems(nextItems);
        setPage(Math.max(1, Math.ceil(nextItems.length / ITEMS_PER_PAGE)));
        return nextItems;
      });
      setSyncError("");
      toast.push({ type: "success", message: "Item added to The One." });
    } catch {
      setSyncError("Could not save that item to your account. Please try again.");
      toast.push({ type: "error", message: "Could not save that item." });
      return;
    }
    setTitle("");
    setNote("");
  }

  async function deleteItem(id: string) {
    try {
      await deleteTheOneItem(id);
      setItems((prev) => {
        const nextItems = prev.filter((item) => item._id !== id);
        cacheItems(nextItems);
        return nextItems;
      });
      setDeletingItem(null);
      setSyncError("");
      toast.push({ type: "success", message: "Item deleted." });
    } catch {
      setSyncError("Could not delete that item. Please try again.");
      toast.push({ type: "error", message: "Could not delete that item." });
    }
  }

  function openEditItem(item: TheOneItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditNote(item.note || "");
  }

  async function saveItemEdit() {
    if (!editingItem) return;
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;
    try {
      let updated: TheOneItem;
      try {
        updated = await updateTheOneItem(editingItem._id, { title: cleanTitle, note: editNote.trim() || undefined });
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
        updated = await createTheOneItem({ title: cleanTitle, note: editNote.trim() || undefined });
        await deleteTheOneItem(editingItem._id);
      }
      setItems((prev) => {
        const nextItems = prev.map((item) => (item._id === editingItem._id ? updated : item));
        cacheItems(nextItems);
        return nextItems;
      });
      setEditingItem(null);
      setSyncError("");
      toast.push({ type: "success", message: "Item updated." });
    } catch {
      setSyncError("Could not update that item. Please try again.");
      toast.push({ type: "error", message: "Could not update that item." });
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const paginatedItems = items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <Layout>
      <section className="w-full">
        <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
          <h1 className="text-3xl font-bold uppercase md:text-5xl">Are You The One For Me?</h1>
          <p className="mt-2 text-lg md:text-2xl">My long, long list of things I want in a partner.</p>
        </div>

        <section className="my-6 grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addItem();
            }}
            className="min-h-[380px] self-start rounded-2xl bg-pink p-5 text-claret shadow-xl"
          >
            <h2 className="text-2xl font-bold uppercase">Add To List</h2>
            {syncError && <p className="mt-3 rounded-xl border border-claret/30 p-3 text-sm">{syncError}</p>}
            <label className="mt-4 block space-y-1">
              <span className="text-sm uppercase tracking-widest">Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="e.g. Emotionally mature" />
            </label>
            <label className="mt-4 block space-y-1">
              <span className="text-sm uppercase tracking-widest">Optional Note</span>
              <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" placeholder="Add context if you want" />
            </label>
            <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
              <Plus className="size-4" /> Add Item
            </button>
          </form>

          <div className="rounded-2xl bg-pink p-5 text-claret shadow-xl">
            {items.length === 0 ? (
              <p className="text-xl">Nothing here yet. Start with the non-negotiables.</p>
            ) : (
              <ol className="space-y-3">
                {paginatedItems.map((item, index) => (
                  <li key={item._id} className="grid grid-cols-[2rem_1fr_auto] gap-3 rounded-xl border border-claret/20 p-3">
                    <span className="text-2xl font-bold">{(page - 1) * ITEMS_PER_PAGE + index + 1}.</span>
                    <div>
                      <h3 className="text-2xl font-bold">{item.title}</h3>
                      {item.note && <p className="mt-1 text-lg opacity-80">{item.note}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openEditItem(item)} aria-label="Edit item" title="Edit item" className="inline-flex size-9 items-center justify-center rounded-md hover:bg-claret hover:text-pink">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => setDeletingItem(item)} aria-label="Delete item" title="Delete item" className="inline-flex size-9 items-center justify-center rounded-md hover:bg-claret hover:text-pink">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} label="Items" />
          </div>
        </section>
      </section>
      <DeleteConfirmationModal
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        itemName={deletingItem?.title || ""}
        itemType="list item"
        onConfirm={() => {
          if (deletingItem) deleteItem(deletingItem._id);
        }}
      />
      {editingItem && (
        <ModalFrame
          onClose={() => setEditingItem(null)}
          shouldConfirmClose={() => editTitle.trim() !== editingItem.title || editNote.trim() !== (editingItem.note || "")}
        >
          <ModalHead>Edit Item</ModalHead>
          <ModalBody>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Title</span>
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm uppercase tracking-widest">Optional Note</span>
              <textarea rows={4} value={editNote} onChange={(event) => setEditNote(event.target.value)} className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2" />
            </label>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={saveItemEdit} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90">
              <Save className="size-4" /> Save
            </button>
          </ModalFooter>
        </ModalFrame>
      )}
    </Layout>
  );
}
