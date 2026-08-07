import { AppProvider } from './store/AppContext'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { GlobalSearch } from './components/layout/GlobalSearch'
import { useApp } from './store/AppContext'
import Dashboard from './pages/Dashboard'
import CaseList from './pages/cases/CaseList'
import CaseDetail from './pages/cases/CaseDetail'
import ClientList from './pages/clients/ClientList'
import RetainerList from './pages/retainers/RetainerList'
import RetainerDetail from './pages/retainers/RetainerDetail'
import DocsPage from './pages/docs/DocsPage'
import CalendarPage from './pages/calendar/CalendarPage'
import BillingPage from './pages/billing/BillingPage'
import PreservationCenter from './pages/preservation/PreservationCenter'
import SettingsPage from './pages/settings/SettingsPage'
import { PreservationAlert } from './components/preservation/PreservationAlert'

function Router() {
  const { nav } = useApp()
  switch (nav.page) {
    case 'dashboard':
      return <Dashboard />
    case 'cases':
      return nav.caseId ? <CaseDetail /> : <CaseList />
    case 'clients':
      return <ClientList />
    case 'retainers':
      return nav.retainerId ? <RetainerDetail /> : <RetainerList />
    case 'docs':
      return <DocsPage />
    case 'calendar':
      return <CalendarPage />
    case 'billing':
      return <BillingPage />
    case 'preservation':
      return <PreservationCenter />
    case 'settings':
      return <SettingsPage />
    default:
      return <Dashboard />
  }
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
