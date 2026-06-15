import Layout from "@/components/Layout";
import { useState, useEffect, useCallback } from "react";
import { getSidequests, deleteSidequest, updateSidequest } from "@/lib/api";
import NewSidequestModal from "@/modals/NewSidequestModal";
import EditSidequestModal from "@/modals/EditSidequestModal";
import DeleteConfirmationModal from "@/modals/DeleteConfirmationModal";
import { Edit2, Trash2, Shuffle, CheckCircle2, Circle } from "lucide-react";
import type { SidequestDto } from "@/lib/api";

type UiMilestone = { id: string; title: string; done: boolean; cost?: number }

function normalizeMilestones(raw: unknown): UiMilestone[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m: any, index) => {
      if (typeof m === 'string') {
        const text = m.trim()
        if (!text) return null
        return { id: `ms-${index}-${text}`, title: text, done: false }
      }
      const title = String(m?.title ?? m?.name ?? m?.text ?? '').trim()
      if (!title) return null
      return {
        id: String(m?.id ?? `ms-${index}-${title}`),
        title,
        done: Boolean(m?.done),
        cost: m?.cost === undefined ? undefined : Math.max(0, Number(m.cost) || 0),
      }
    })
    .filter((m): m is UiMilestone => Boolean(m))
}

function getDisplayedCost(sq: SidequestDto) {
  const milestones = normalizeMilestones((sq as any).milestones)
  const hasMilestoneCosts = milestones.some((m) => m.cost !== undefined)
  return hasMilestoneCosts ? milestones.reduce((sum, milestone) => sum + (milestone.cost || 0), 0) : sq.cost
}

function isCompletedSidequest(sq: SidequestDto): boolean {
  const milestones = normalizeMilestones((sq as any).milestones)
  if (milestones.length > 0) return milestones.every((m) => m.done)
  return Boolean(sq.completed)
}

function getSidequestStatus(sq: SidequestDto): 'Queued' | 'Ongoing' | 'Completed' {
  if (isCompletedSidequest(sq)) return 'Completed'
  const milestones = normalizeMilestones((sq as any).milestones)
  if (milestones.length === 0) return 'Queued'
  const doneCount = milestones.filter((m) => m.done).length
  return doneCount === 0 ? 'Queued' : 'Ongoing'
}

export default function Odyssey() {
  const [allSidequests, setAllSidequests] = useState<SidequestDto[]>([])
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedSidequest, setSelectedSidequest] = useState<SidequestDto | null>(null)
  const [viewDetailsSidequest, setViewDetailsSidequest] = useState<SidequestDto | null>(null)
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false)
  const [randomSidequest, setRandomSidequest] = useState<SidequestDto | null>(null)
  const [isRandomOpen, setIsRandomOpen] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const all = await getSidequests(1000, 1)
      setAllSidequests(all)
    } catch (_err) { /* ignore */ }
  }, [])

  useEffect(() => {
    loadAll()
    const dataHandler = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail
      if (!detail || !detail.resource) return loadAll().catch(() => {})
      if (detail.resource === 'sidequest') return loadAll().catch(() => {})
    }
    window.addEventListener('heph:data:changed', dataHandler as EventListener)
    return () => {
      window.removeEventListener('heph:data:changed', dataHandler as EventListener)
    }
  }, [loadAll])

  const totalCount = allSidequests.length
  const completedCount = allSidequests.filter((sq) => isCompletedSidequest(sq)).length
  const queuedSidequests = allSidequests.filter((sq) => {
    if (isCompletedSidequest(sq)) return false
    const milestones = normalizeMilestones((sq as any).milestones)
    if (milestones.length === 0) return true // non-milestone unfinished quests are queued
    const doneCount = milestones.filter((m) => m.done).length
    return doneCount === 0
  })
  const ongoingSidequests = allSidequests.filter((sq) => {
    if (isCompletedSidequest(sq)) return false
    return !queuedSidequests.some((q) => q._id === sq._id)
  })
  const completedSidequests = allSidequests.filter((sq) => isCompletedSidequest(sq))

  const handleToggleComplete = async (sq: SidequestDto) => {
    try {
      const targetCompleted = !sq.completed
      const milestones = normalizeMilestones((sq as any).milestones)
      if (milestones.length > 0) {
        await updateSidequest(sq._id, {
          completed: targetCompleted,
          milestones: milestones.map((m) => ({ ...m, done: targetCompleted })),
        })
      } else {
        await updateSidequest(sq._id, { completed: targetCompleted })
      }
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'sidequest' } }))
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleMilestone = async (sq: SidequestDto, milestoneId: string) => {
    const previous = allSidequests
    const optimistic = allSidequests.map((item) => {
      if (item._id !== sq._id) return item
      const milestones = normalizeMilestones((item as any).milestones)
      const nextMilestones = milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m))
      const completed = nextMilestones.length > 0 ? nextMilestones.every((m) => m.done) : item.completed
      return { ...item, milestones: nextMilestones, completed }
    })

    setAllSidequests(optimistic)

    try {
      const optimisticSq = optimistic.find((item) => item._id === sq._id) || sq
      const next = normalizeMilestones((optimisticSq as any).milestones)
      await updateSidequest(sq._id, { milestones: next })
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'sidequest' } }))
    } catch (err) {
      setAllSidequests(previous)
      console.error(err)
    }
  }

  const getMilestoneProgress = (sq: SidequestDto) => {
    const milestones = normalizeMilestones((sq as any).milestones)
    if (milestones.length === 0) return { total: 0, done: 0, percent: sq.completed ? 100 : 0 }
    const done = milestones.filter((m) => m.done).length
    return { total: milestones.length, done, percent: Math.round((done / milestones.length) * 100) }
  }

  const handleRandomSidequest = () => {
    const uncompleted = allSidequests.filter((sq) => !isCompletedSidequest(sq))
    if (uncompleted.length === 0) return
    const pick = uncompleted[Math.floor(Math.random() * uncompleted.length)]
    setRandomSidequest(pick)
    setIsRandomOpen(true)
  }

  const handleEdit = (sq: SidequestDto) => {
    setSelectedSidequest(sq)
    setIsEditOpen(true)
  }

  const handleDelete = (sq: SidequestDto) => {
    setSelectedSidequest(sq)
    setIsDeleteOpen(true)
  }

  const handleViewDetails = (sq: SidequestDto) => {
    setViewDetailsSidequest(sq)
    setIsViewDetailsOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedSidequest) return
    try {
      await deleteSidequest(selectedSidequest._id)
      window.dispatchEvent(new CustomEvent('heph:data:changed', { detail: { resource: 'sidequest' } }))
    } catch (err) {
      console.error(err)
    }
  }

  function renderGroup(title: string, items: SidequestDto[]) {
    return (
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-bold uppercase text-pink">{title}</h2>
          <span className="rounded-full bg-pink/10 border border-pink/20 px-3 py-1 text-sm text-pink">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-pink/20 bg-claret/30 p-4 text-pink/70">No sidequests here yet.</div>
        ) : (
          <div className="grid gap-4">
            {items.map((sq) => {
              const progress = getMilestoneProgress(sq)
              const milestones = normalizeMilestones((sq as any).milestones)
              return (
                <div
                  key={sq._id}
                  className={`rounded-2xl border bg-pink p-4 md:p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer ${sq.completed ? 'border-claret/40 opacity-80' : 'border-claret/20'}`}
                  onClick={() => handleViewDetails(sq)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleViewDetails(sq)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open details for ${sq.title}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start md:items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleComplete(sq)
                          }}
                          title={sq.completed ? "Mark incomplete" : "Mark complete"}
                          className="shrink-0 text-claret hover:scale-110 transition-transform mt-1"
                        >
                          {sq.completed
                            ? <CheckCircle2 className="size-6 fill-claret text-pink" />
                            : <Circle className="size-6" />
                          }
                        </button>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                          <h3 className={`text-lg capitalize md:text-2xl font-bold text-claret ${sq.completed ? 'line-through opacity-60' : ''}`}>{sq.title}</h3>
                          <p className="text-xs md:text-base font-black bg-claret w-fit p-2 text-pink">COST: {getDisplayedCost(sq)}</p>
                        </div>
                        
                      </div>
                      <p className="text-base md:text-lg text-claret/70 mt-2 ml-9">{sq.description}</p>


                      {milestones.length > 0 && (
                        <div className="ml-9 mt-4 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm uppercase tracking-widest text-claret/70">Milestone Progress</p>
                            <p className="text-sm font-bold text-claret">{progress.done}/{progress.total} ({progress.percent}%)</p>
                          </div>
                          <div className="h-2 w-full rounded-full bg-claret/20 overflow-hidden">
                            <div
                              className="h-full bg-claret transition-[width] duration-500 ease-out"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <ul className="space-y-1 pt-1">
                            {milestones.map((m) => (
                              <li key={m.id}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleMilestone(sq, m.id)
                                  }}
                                  className="flex items-center gap-2 text-left text-claret hover:underline"
                                >
                                  {m.done ? <CheckCircle2 className="size-4 text-claret" /> : <Circle className="size-4 text-claret/60" />}
                                  <span className={`text-sm text-claret ${m.done ? 'line-through opacity-60' : ''}`}>{m.title}</span>
                                  {m.cost !== undefined && <span className="text-xs font-bold text-claret/70">N{m.cost.toLocaleString()}</span>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(sq)
                        }}
                        title="Edit"
                        className="text-xs md:text-sm uppercase tracking-wider p-2 text-claret hover:bg-claret hover:rounded-full hover:text-pink hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(103,6,38,0.45)]"
                      >
                        <Edit2 className="size-4 md:size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(sq)
                        }}
                        title="Delete"
                        className="text-xs md:text-sm uppercase tracking-wider p-2 text-claret hover:bg-claret hover:rounded-full hover:text-pink hover:scale-110 transition-transform duration-300 ease-in-out drop-shadow-[0_2px_6px_rgba(103,6,38,0.45)]"
                      >
                        <Trash2 className="size-4 md:size-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  return (
    <Layout>
      <section className="w-full">
        {/* Header */}
        <div className="rounded-2xl bg-pink text-claret p-6 md:p-8 shadow-xl border border-claret/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-full">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold uppercase">ODYSSEY</h1>
              <p className="mt-2 text-lg md:text-2xl">Choose your sidequests and level up!</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleRandomSidequest}
                disabled={allSidequests.filter((sq) => !isCompletedSidequest(sq)).length === 0}
                className="rounded-2xl border border-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest hover:bg-claret hover:text-pink transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Shuffle className="size-4" />
                Choose a Sidequest
              </button>
              <button
                type="button"
                onClick={() => setIsNewOpen(true)}
                className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm md:text-base uppercase tracking-widest text-pink hover:bg-claret/90 transition-all focus:outline-none focus:ring-2 focus:ring-claret focus:ring-offset-2 focus:ring-offset-pink"
              >
                New Sidequest
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <section className="my-6 flex flex-wrap justify-center gap-4">
          <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
            <p className="text-3xl md:text-4xl font-bold">{totalCount}</p>
            <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Total Sidequests</p>
          </article>
          <article className="w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
            <p className="text-3xl md:text-4xl font-bold">{completedCount}</p>
            <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Completed</p>
          </article>
          <article className="w-full md:w-[calc((100%-2rem)/3)] rounded-2xl border border-claret/20 bg-pink p-6 md:p-8 text-claret shadow-xl">
            <p className="text-3xl md:text-4xl font-bold">{totalCount - completedCount}</p>
            <p className="mt-2 text-base md:text-xl uppercase tracking-wider opacity-80">Remaining</p>
          </article>
        </section>

        {allSidequests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-pink opacity-70">No sidequests yet. Create one to get started!</p>
          </div>
        ) : (
          <>
            {renderGroup("Queued", queuedSidequests)}
            {renderGroup("Ongoing", ongoingSidequests)}
            {renderGroup("Completed", completedSidequests)}
          </>
        )}
      </section>

      <NewSidequestModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
      <EditSidequestModal open={isEditOpen} onClose={() => { setIsEditOpen(false); setSelectedSidequest(null) }} sidequest={selectedSidequest || undefined} />
      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setSelectedSidequest(null) }}
        itemName={selectedSidequest?.title || ""}
        itemType="Sidequest"
        onConfirm={confirmDelete}
      />

      {/* View Details Modal */}
      {isViewDetailsOpen && viewDetailsSidequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-pink rounded-2xl max-w-md w-full p-6 border border-claret/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {viewDetailsSidequest.completed
                ? <CheckCircle2 className="size-6 fill-claret text-pink shrink-0" />
                : <Circle className="size-6 text-claret shrink-0" />
              }
              <h2 className="text-2xl font-bold text-claret">{viewDetailsSidequest.title}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-claret/60">Description</p>
                <p className="text-lg text-claret mt-2">{viewDetailsSidequest.description}</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-claret/60">Cost</p>
                <p className="text-2xl font-bold text-claret mt-2">{getDisplayedCost(viewDetailsSidequest)}</p>
              </div>
              {normalizeMilestones((viewDetailsSidequest as any).milestones).length > 0 && (
                <div>
                  <p className="text-sm uppercase tracking-widest text-claret/60">Milestones</p>
                  <ul className="mt-2 space-y-2">
                    {normalizeMilestones((viewDetailsSidequest as any).milestones).map((m) => (
                      <li key={m.id} className="flex items-center gap-2">
                        {m.done ? <CheckCircle2 className="size-4 text-claret" /> : <Circle className="size-4 text-claret/60" />}
                        <span className={`text-claret ${m.done ? 'line-through opacity-60' : ''}`}>{m.title}</span>
                        {m.cost !== undefined && <span className="ml-auto text-sm font-bold text-claret/70">N{m.cost.toLocaleString()}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-sm uppercase tracking-widest text-claret/60">Status</p>
                <p className="text-base text-claret mt-2 font-bold">{getSidequestStatus(viewDetailsSidequest)}</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-claret/60">Created</p>
                <p className="text-base text-claret mt-2">{new Date(viewDetailsSidequest.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsViewDetailsOpen(false)}
              className="w-full mt-6 rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Random Sidequest Modal */}
      {isRandomOpen && randomSidequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-pink rounded-2xl max-w-md w-full p-6 border border-claret/20 shadow-2xl text-center">
            <p className="text-sm uppercase tracking-widest text-claret/60 mb-2">Your Quest Awaits</p>
            <h2 className="text-2xl md:text-3xl font-bold text-claret mb-4">{randomSidequest.title}</h2>
            <p className="text-lg text-claret/80 mb-4">{randomSidequest.description}</p>
            <p className="text-xl font-bold text-claret mb-6">Cost: {getDisplayedCost(randomSidequest)}</p>
            {normalizeMilestones((randomSidequest as any).milestones).length > 0 && (
              <p className="text-sm text-claret/70 mb-6">Milestones left: {normalizeMilestones((randomSidequest as any).milestones).filter((m) => !m.done).length}</p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={handleRandomSidequest}
                className="inline-flex items-center gap-2 rounded-2xl border border-claret px-4 py-3 text-sm uppercase tracking-widest text-claret hover:bg-claret/10 transition-all"
              >
                <Shuffle className="size-4" />
                Reroll
              </button>
              <button
                type="button"
                onClick={() => setIsRandomOpen(false)}
                className="rounded-2xl border border-claret bg-claret px-4 py-3 text-sm uppercase tracking-widest text-pink hover:bg-claret/90 transition-all"
              >
                Accept Quest
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
