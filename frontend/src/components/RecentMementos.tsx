import { useNavigate } from "react-router-dom";

type MementoItem = {
  title: string;
  preview: string;
  date: string;
};

type RecentMementosProps = {
  mementos?: MementoItem[];
};

const defaultMementos: MementoItem[] = [
  {
    title: "On Personal Growth",
    preview: "Consistency is more important than perfection...",
    date: "Mar 22, 2026",
  },
  {
    title: "Ideas for Q2",
    preview: "Three main areas: health, finances, and learning...",
    date: "Mar 18, 2026",
  },
  {
    title: "Reflection",
    preview: "The value of saying no to misaligned things...",
    date: "Mar 15, 2026",
  },
];

export default function RecentMementos({ mementos = defaultMementos }: RecentMementosProps) {
  return (
    <section className="my-6 rounded-2xl bg-pink text-claret p-6 md:p-8 w-full shadow-xl border border-claret/20">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-2xl md:text-3xl font-bold uppercase">Recent Mementos</h4>
        <button type="button" onClick={() => navigate('/mementos')} className="text-sm md:text-base uppercase tracking-widest hover:underline underline-offset-5 hover:scale-105 transition-transform duration-300 cursor-pointer">
          View all
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {mementos.map((memento) => (
          <article
            key={`${memento.title}-${memento.date}`}
            className="rounded-xl border border-claret/30 p-4 bg-claret/95 text-pink"
          >
            <p className="text-lg md:text-xl font-bold">{memento.title}</p>
            <p className="mt-1 text-sm md:text-base opacity-90">{memento.preview}</p>
            <p className="mt-2 text-xs md:text-sm uppercase tracking-wider opacity-75">{memento.date}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
