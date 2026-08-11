import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import type { NavState, PageKey } from './store/AppContext'

type PageModule = Promise<{ default: ComponentType }>
type PageLoader = () => PageModule

export const pageLoaders: Record<PageKey, PageLoader> = {
  dashboard: () => import('./pages/Dashboard'),
  cases: () => import('./pages/cases/CaseList'),
  clients: () => import('./pages/clients/ClientList'),
  retainers: () => import('./pages/retainers/RetainerList'),
  docs: () => import('./pages/docs/DocsPage'),
  calendar: () => import('./pages/calendar/CalendarPage'),
  billing: () => import('./pages/billing/BillingPage'),
  consultation: () => import('./pages/consultation/ConsultationPage'),
  preservation: () => import('./pages/preservation/PreservationCenter'),
  settings: () => import('./pages/settings/SettingsPage'),
}

export const detailLoaders = {
  caseDetail: () => import('./pages/cases/CaseDetail'),
  retainerDetail: () => import('./pages/retainers/RetainerDetail'),
} satisfies Record<string, PageLoader>

export function getPageLoader(nav: NavState): PageLoader {
  if (nav.page === 'cases' && nav.caseId) return detailLoaders.caseDetail
  if (nav.page === 'retainers' && nav.retainerId) return detailLoaders.retainerDetail
  return pageLoaders[nav.page]
}

export function RouteLoading() {
  return (
    <div className="flex min-h-48 items-center justify-center text-sm text-text-muted" role="status">
      正在加载页面…
    </div>
  )
}

interface RouteErrorBoundaryState {
  error: Error | null
}

export class RouteErrorBoundary extends Component<{ children: ReactNode; routeKey: string }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面加载失败', error, info)
  }

  componentDidUpdate(previousProps: { routeKey: string }) {
    if (this.state.error && previousProps.routeKey !== this.props.routeKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-card bg-bg-card p-6 shadow-card" role="alert">
          <h2 className="text-base font-semibold text-text-main">页面加载失败</h2>
          <p className="mt-2 text-sm text-text-muted">请返回其他页面后重试，或重新启动应用。</p>
        </div>
      )
    }
    return this.props.children
  }
}
