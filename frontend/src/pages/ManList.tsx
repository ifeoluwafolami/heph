import Layout from "@/components/Layout";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type ManListItem = {
  id: string;
  title: string;
  note?: string;
};

const STORAGE_KEY = "heph_man_list";

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ManListItem[]) : [];
  } catch {
    return [];
  }
}

export default function ManList() {
  const [items, setItems] = useState<ManListItem[]>(loadItems);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function addItem() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setItems((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: cleanTitle, note: note.trim() || undefined }]);
    setTitle("");
    setNote("");
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
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
                  <li key={item.id} className="grid grid-cols-[2rem_1fr_auto] gap-3 rounded-xl border border-claret/20 p-3">
                    <span className="text-2xl font-bold">{index + 1}.</span>
                    <div>
                      <h3 className="text-2xl font-bold">{item.title}</h3>
                      {item.note && <p className="mt-1 text-lg opacity-80">{item.note}</p>}
                    </div>
                    <button type="button" onClick={() => deleteItem(item.id)} aria-label="Delete item" title="Delete item" className="inline-flex size-9 items-center justify-center rounded-md hover:bg-claret hover:text-pink">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </section>
    </Layout>
  );
}
