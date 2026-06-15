import Layout from "@/components/Layout";
import { createTheOneItem, deleteTheOneItem, getTheOneItems, type TheOneItemDto } from "@/lib/api";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type LocalTheOneItem = {
  id: string;
  title: string;
  note?: string;
};
type TheOneItem = TheOneItemDto;

const STORAGE_KEY = "heph_man_list";
const MIGRATION_KEY = "heph_man_list_server_migrated";

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

export default function TheOne() {
  const [items, setItems] = useState<TheOneItem[]>(loadCachedItems);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [deletingItem, setDeletingItem] = useState<TheOneItem | null>(null);
  const [syncError, setSyncError] = useState("");

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
        return nextItems;
      });
      setSyncError("");
    } catch {
      setSyncError("Could not save that item to your account. Please try again.");
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
    } catch {
      setSyncError("Could not delete that item. Please try again.");
    }
  }

  return (
    <Layout>
      <section className="w-full">
        <div className="rounded-2xl bg-pink p-6 text-claret shadow-xl md:p-8">
          <h1 className="text-3xl font-bold uppercase md:text-5xl">Things I Want In A Man</h1>
          <p className="mt-2 text-lg md:text-2xl">A numbered list, because standards deserve order.</p>
        </div>

        <section className="my-6 grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addItem();
            }}
            className="rounded-2xl bg-pink p-5 text-claret shadow-xl"
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
                {items.map((item, index) => (
                  <li key={item._id} className="grid grid-cols-[2rem_1fr_auto] gap-3 rounded-xl border border-claret/20 p-3">
                    <span className="text-2xl font-bold">{index + 1}.</span>
                    <div>
                      <h3 className="text-2xl font-bold">{item.title}</h3>
                      {item.note && <p className="mt-1 text-lg opacity-80">{item.note}</p>}
                    </div>
                    <button type="button" onClick={() => setDeletingItem(item)} aria-label="Delete item" title="Delete item" className="inline-flex size-9 items-center justify-center rounded-md hover:bg-claret hover:text-pink">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
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
    </Layout>
  );
}
