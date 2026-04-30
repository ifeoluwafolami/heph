import { useState, useMemo, useRef, useEffect } from "react"

type Props = {
  options: string[]
  value?: string
  placeholder?: string
  onChange: (val: string) => void
  onCreateOption?: (val: string) => void
}

export default function SearchableSelect({ options, value, placeholder, onChange, onCreateOption }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  useEffect(() => {
    if (typeof value === 'string') setQuery(value)
  }, [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const val = query.trim()
            if (!val) return
            const match = options.find(o => o.toLowerCase() === val.toLowerCase())
            if (match) {
              onChange(match)
              setQuery(match)
              setOpen(false)
            } else {
              onCreateOption?.(val)
              onChange(val)
              setQuery(val)
              setOpen(false)
            }
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-claret/30 bg-pink px-3 py-2"
      />

      {open && query.trim() !== "" && (
        <div className="absolute z-20 mt-2 max-h-52 w-full overflow-auto rounded-xl border border-claret/30 bg-claret/95 p-2">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setQuery(opt); setOpen(false) }}
              className="w-full text-left px-3 py-2 rounded hover:bg-pink/10 text-pink"
            >
              {opt}
            </button>
          ))}

          {query && !options.some(o => o.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="mt-2 border-t border-claret/20 pt-2">
              <button
                type="button"
                onClick={() => { onCreateOption?.(query.trim()); onChange(query.trim()); setOpen(false) }}
                className="w-full text-left px-3 py-2 rounded bg-pink/5 hover:bg-pink/10 text-pink"
              >
                Create "{query.trim()}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
