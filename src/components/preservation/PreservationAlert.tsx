import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldWarning, ArrowRight, BellSlash } from '@phosphor-icons/react'
import { db } from '../../db/database'
import type { Preservation, LawCase } from '../../types'
import { daysUntil, fmtDate, todayStamp } from '../../utils/dates'
import { useApp } from '../../store/AppContext'

export function PreservationAlert() {
  const { navigate } = useApp()
  const [dismissedFor, setDismissedFor] = useState<number>(0)

  const preservations = useLiveQuery(() => db.preservations.where('deleted').equals(0).toArray(), []) as
    | Preservation[]
    | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined

  const urgent = (preservations ?? []).filter((p) => {
    if (p.status === 'handled' || p.status === 'released' || p.status === 'expired-unrenewed') return false
    const d = daysUntil(p.endDate)
    return d <= 7
  })

  const today = todayStamp()
  const shouldShow = urgent.length > 0 && dismissedFor !== today

  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [shouldShow])

  if (!shouldShow) return null

  const caseName = (id?: number) => cases?.find((c) => c.id === id)?.name ?? ''

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="animate-fade-in w-[520px] max-h-[80vh] overflow-hidden rounded-card bg-bg-card shadow-pop">
        <div className="bg-danger px-6 py-5 text-white">
          <div className="flex items-center gap-2">
            <ShieldWarning size={22} weight="fill" />
            <h2 className="text-lg font-semibold">保全到期紧急提醒</h2>
          </div>
          <p className="mt-1 text-sm text-white/85">以下保全已到期或即将到期，请立即处理，防止执业风险</p>
        </div>
        <div className="max-h-[45vh] overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {urgent.map((p) => {
              const d = daysUntil(p.endDate)
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-btn border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-main">{caseName(p.caseId)}</p>
                    <p className="truncate text-xs text-text-muted">
                      {p.type} · {p.target}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-text-muted">{fmtDate(p.endDate)}</p>
                    <p className="text-sm font-semibold tabular-nums text-danger">
                      {d < 0 ? `已过期${-d}天` : `还有${d}天`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            className="btn-ghost"
            onClick={() => setDismissedFor(today)}
          >
            <BellSlash size={15} /> 稍后提醒
          </button>
          <button
            className="btn-danger"
            onClick={() => navigate({ page: 'preservation' })}
          >
            跳转处理 <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
