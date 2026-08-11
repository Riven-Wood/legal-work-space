import { lazy, Suspense, useMemo } from 'react'
import { AppProvider } from './store/AppContext'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { GlobalSearch } from './components/layout/GlobalSearch'
import { useApp } from './store/AppContext'
import { PreservationAlert } from './components/preservation/PreservationAlert'
import { getPageLoader, RouteErrorBoundary, RouteLoading } from './appRoutes'

function Router() {
  const { nav } = useApp()
  const routeKey = `${nav.page}:${nav.caseId ?? ''}:${nav.retainerId ?? ''}`
  const Page = useMemo(() => lazy(getPageLoader(nav)), [routeKey])

  return (
    <RouteErrorBoundary routeKey={routeKey}>
      <Suspense fallback={<RouteLoading />}>
        <Page />
      </Suspense>
    </RouteErrorBoundary>
  )
}

function Shell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Router />
        </main>
      </div>
      <GlobalSearch />
      <PreservationAlert />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
