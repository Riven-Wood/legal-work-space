import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ensureSettings } from '../db/database'
import {
  elapsedTimerSeconds,
  pauseTimer,
  resumeTimer,
  restoreConsultationTimer,
  startOfLocalDay,
  type ConsultationTimerState,
} from '../utils/consultationTimer'
import { saveTimerConsultation } from '../utils/consultationTimerPersistence'
import { createTimerStopCoordinator, type TimerEndResult } from '../utils/consultationTimerLifecycle'

// ===== 导航 =====
export type PageKey =
  | 'dashboard'
  | 'cases'
  | 'clients'
  | 'retainers'
  | 'docs'
  | 'calendar'
  | 'billing'
  | 'consultation'
  | 'preservation'
  | 'settings'

export interface NavState {
  page: PageKey
  caseId?: number
  clientId?: number
  retainerId?: number
  billingTab?: 'invoice' | 'revenue'
}

// ===== 计时器（法律咨询计时） =====
export type TimerState = ConsultationTimerState

const TIMER_STORAGE_KEY = 'lawyer-workbench:consultation-timer'

function restoreTimer(): TimerState | null {
  return restoreConsultationTimer(localStorage.getItem(TIMER_STORAGE_KEY))
}

interface AppContextType {
  nav: NavState
  navigate: (patch: Partial<NavState>) => void
  timer: TimerState | null
  runningSeconds: number
  timerSaving: boolean
  startTimer: (opts?: { caseId?: number; clientId?: number; consultant?: string; content?: string }) => Promise<TimerStartResult>
  endTimer: () => Promise<TimerEndResult | { status: 'no-timer'; timer: null }>
  toggleTimer: () => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  refreshKey: number
  bumpRefresh: () => void
}

export type TimerStartResult = { status: 'started' } | { status: 'failed'; error: string }

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<NavState>({ page: 'dashboard' })
  const [timer, setTimer] = useState<TimerState | null>(restoreTimer)
  const [searchOpen, setSearchOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [runningSeconds, setRunningSeconds] = useState(0)
  const [timerSaving, setTimerSaving] = useState(false)
  const stopTimer = useRef(createTimerStopCoordinator(saveTimerConsultation))

  const navigate = useCallback((patch: Partial<NavState>) => {
    setNav((prev) => {
      const next = { ...prev, ...patch }
      // 清除未显式传入的详情参数，避免残留 caseId/retainerId 导致
      // 「返回列表」或侧边栏切换后仍停留在详情页（无法返回上一界面）
      if (!('caseId' in patch)) next.caseId = undefined
      if (!('clientId' in patch)) next.clientId = undefined
      if (!('retainerId' in patch)) next.retainerId = undefined
      if (!('billingTab' in patch)) next.billingTab = undefined
      return next
    })
  }, [])

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // 首次启动初始化默认设置
  useEffect(() => {
    ensureSettings().catch(() => {})
  }, [])

  useEffect(() => {
    if (timer) localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer))
    else localStorage.removeItem(TIMER_STORAGE_KEY)
  }, [timer])

  // 运行中的计时器每秒刷新显示
  useEffect(() => {
    if (!timer?.running) return
    const iv = setInterval(() => {
      setRunningSeconds(elapsedTimerSeconds(timer, Date.now()))
    }, 1000)
    return () => clearInterval(iv)
  }, [timer])

  const persistStop = useCallback((t: TimerState, stoppedAt: number) => {
    return stopTimer.current(t, stoppedAt)
  }, [])

  const startTimer = useCallback(
    async (opts?: { caseId?: number; clientId?: number; consultant?: string; content?: string }): Promise<TimerStartResult> => {
      const now = Date.now()
      if (timer) {
        const frozen = pauseTimer(timer, now)
        setTimer(frozen)
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(frozen))
        setTimerSaving(true)
        const previous = await persistStop(frozen, now)
        setTimerSaving(false)
        if (previous.status === 'failed') {
          setTimer(frozen)
          return { status: 'failed', error: previous.error }
        }
        if (previous.status === 'saved') bumpRefresh()
      }
      const t: TimerState = {
          id: crypto.randomUUID(),
          running: true,
          startedAt: now,
          caseId: opts?.caseId,
          clientId: opts?.clientId,
          consultant: opts?.consultant,
          description: opts?.content,
          accumulated: 0,
          lastTick: now,
          startDate: startOfLocalDay(now),
        }
      setRunningSeconds(0)
      setTimer(t)
      return { status: 'started' }
    },
    [bumpRefresh, persistStop, timer],
  )

  // 结束时先同步冻结并保留恢复状态；真实落库成功后才清理。
  const endTimer = useCallback(async () => {
    if (!timer) return { status: 'no-timer' as const, timer: null }
    const stoppedAt = Date.now()
    const frozen = pauseTimer(timer, stoppedAt)
    setRunningSeconds(frozen.accumulated)
    setTimer(frozen)
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(frozen))
    setTimerSaving(true)
    const result = await persistStop(frozen, stoppedAt)
    setTimerSaving(false)
    if (result.status === 'failed') {
      setTimer((current) => current?.id === frozen.id ? result.timer : current)
      return result
    }
    setRunningSeconds(0)
    setTimer((current) => current?.id === frozen.id ? null : current)
    if (result.status === 'saved') bumpRefresh()
    return result
  }, [bumpRefresh, persistStop, timer])

  const toggleTimer = useCallback(() => {
    if (!timer) return
    const now = Date.now()
    if (timer.running) {
      const paused = pauseTimer(timer, now)
      setRunningSeconds(paused.accumulated)
      setTimer(paused)
    } else {
      setRunningSeconds(timer.accumulated)
      setTimer(resumeTimer(timer, now))
    }
  }, [timer])

  return (
    <AppContext.Provider
      value={{
        nav,
        navigate,
        timer,
        runningSeconds,
        timerSaving,
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
