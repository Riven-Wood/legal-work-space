import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, ensureSettings } from '../db/database'

// ===== 导航 =====
export type PageKey =
  | 'dashboard'
  | 'cases'
  | 'clients'
  | 'retainers'
  | 'docs'
  | 'calendar'
  | 'billing'
  | 'preservation'
  | 'settings'

export interface NavState {
  page: PageKey
  caseId?: number
  clientId?: number
  retainerId?: number
  docId?: number
  templateId?: number
  billingTab?: 'records' | 'invoice' | 'revenue'
  docsTab?: 'library' | 'templates' | 'editor'
}

// ===== 计时器 =====
export interface TimerState {
  running: boolean
  startedAt: number
  caseId?: number
  description?: string
  accumulated: number // 已累计秒数（不含当前段）
  lastTick: number
  startDate: number // 记录起始日（用于落库日期）
}

interface AppContextType {
  nav: NavState
  navigate: (patch: Partial<NavState>) => void
  timer: TimerState | null
  runningSeconds: number
  startTimer: (caseId: number, description?: string) => void
  endTimer: () => void
  toggleTimer: () => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  refreshKey: number
  bumpRefresh: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<NavState>({ page: 'dashboard' })
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [runningSeconds, setRunningSeconds] = useState(0)

  const navigate = useCallback((patch: Partial<NavState>) => {
    setNav((prev) => ({ ...prev, ...patch }))
  }, [])

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // 首次启动初始化默认设置
  useEffect(() => {
    ensureSettings().catch(() => {})
  }, [])

  // 运行中的计时器每秒刷新显示
  useEffect(() => {
    if (!timer?.running) return
    const iv = setInterval(() => {
      setRunningSeconds(timer.accumulated + Math.floor((Date.now() - timer.lastTick) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [timer])

  const persistStop = useCallback((t: TimerState) => {
    const elapsed = t.accumulated + Math.floor((Date.now() - t.lastTick) / 1000)
    if (elapsed < 10 || !t.caseId) return
    const minutes = Math.round(elapsed / 60)
    db.timeRecords
      .add({
        caseId: t.caseId,
        date: t.startDate,
        start: t.startedAt,
        end: Date.now(),
        minutes: Math.max(1, minutes),
        description: t.description,
        source: 'timer',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .then(() => bumpRefresh())
      .catch(() => {})
  }, [bumpRefresh])

  const startTimer = useCallback(
    (caseId: number, description?: string) => {
      setTimer((prev) => {
        // 已存在计时（无论运行中还是暂停中）：先结束并保存上一段，再开始新计时
        if (prev) {
          persistStop(prev)
        }
        const t: TimerState = {
          running: true,
          startedAt: Date.now(),
          caseId,
          description,
          accumulated: 0,
          lastTick: Date.now(),
          startDate: Date.now(),
        }
        setRunningSeconds(0)
        return t
      })
    },
    [persistStop],
  )

  // 结束计时：保存工时记录并清除计时器状态
  const endTimer = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return prev
      persistStop(prev)
      setRunningSeconds(0)
      return null
    })
  }, [persistStop])

  const toggleTimer = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return prev
      if (prev.running) {
        // 暂停：仅停表，不落库（避免同一段工作重复记账）
        const elapsed = prev.accumulated + Math.floor((Date.now() - prev.lastTick) / 1000)
        setRunningSeconds(0)
        return { ...prev, running: false, accumulated: elapsed, lastTick: Date.now() }
      }
      // 继续
      return { ...prev, running: true, lastTick: Date.now() }
    })
  }, [persistStop])

  return (
    <AppContext.Provider
      value={{
        nav,
        navigate,
        timer,
        runningSeconds,
        startTimer,
        endTimer,
        toggleTimer,
        searchOpen,
        setSearchOpen,
        refreshKey,
        bumpRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
