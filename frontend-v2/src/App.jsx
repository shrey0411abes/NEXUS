import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import MobileBottomNav from './components/MobileBottomNav.jsx'
import AuthModal from './components/AuthModal.jsx'
import { PageSuspenseFallback } from './components/Skeleton.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ToastContainer } from './components/Toast.jsx'
import {
  fetchCurrentUser,
  fetchRiskPriorities,
  getCachedUserContext,
  hasAuthToken,
  logoutUser,
} from './api.js'

// Route-level code splitting for performance and fast initial paint
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const RiskQueue = lazy(() => import('./pages/RiskQueue.jsx'))
const Products = lazy(() => import('./pages/Products.jsx'))
const Inventory = lazy(() => import('./pages/Inventory.jsx'))
const Transactions = lazy(() => import('./pages/Transactions.jsx'))
const Investigations = lazy(() => import('./pages/Investigations.jsx'))
const Financial = lazy(() => import('./pages/Financial.jsx'))
const Resources = lazy(() => import('./pages/Resources.jsx'))
const ActivityPage = lazy(() => import('./pages/ActivityPage.jsx'))
const SavedInvestigations = lazy(() => import('./pages/SavedInvestigations.jsx'))
import Landing from './pages/Landing.jsx'

export default function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeRiskCount, setActiveRiskCount] = useState(0)
  const [tenantContext, setTenantContext] = useState(getCachedUserContext())
  const [authState, setAuthState] = useState(() => ({
    status: hasAuthToken() ? 'loading' : 'unauthenticated',
    user: null,
  }))

  const restoreSession = useCallback(async () => {
    if (!hasAuthToken()) {
      setAuthState({ status: 'unauthenticated', user: null })
      setTenantContext(null)
      setActiveRiskCount(0)
      return
    }

    try {
      const me = await fetchCurrentUser()
      setTenantContext(me)
      setAuthState({
        status: 'authenticated',
        user: me.user,
      })

      // Fetch risk priorities for shell badge once authenticated
      try {
        const risks = await fetchRiskPriorities(30, false)
        if (Array.isArray(risks)) {
          const active = risks.filter(
            (r) => r.current_state === 'OPEN' || r.current_state === 'ACKNOWLEDGED'
          )
          setActiveRiskCount(active.length)
        }
      } catch {
        // Non-critical badge count failure
      }
    } catch (err) {
      logoutUser()
      setTenantContext(null)
      setAuthState({ status: 'unauthenticated', user: null })
      setActiveRiskCount(0)
    }
  }, [])

  useEffect(() => {
    restoreSession()

    const handleAuthChange = (event) => {
      if (event.detail?.token) {
        restoreSession()
      } else {
        setTenantContext(null)
        setAuthState({ status: 'unauthenticated', user: null })
        setActiveRiskCount(0)
      }
    }

    window.addEventListener('nexus-auth-state-changed', handleAuthChange)
    return () => window.removeEventListener('nexus-auth-state-changed', handleAuthChange)
  }, [restoreSession])

  const handleAuthSuccess = () => {
    restoreSession()
  }

  const handleLogout = () => {
    logoutUser()
    setTenantContext(null)
    setAuthState({ status: 'unauthenticated', user: null })
    setActiveRiskCount(0)
  }

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileSidebarOpen])

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => !prev)
  }

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false)
  }

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <Routes>
        {/* Standalone Landing Page Route (Public, No operational sidebar required) */}
        <Route path="/landing" element={<Landing />} />

        {/* Operational Workspace Routes (Protected by Auth Gate) */}
        <Route
          path="/*"
          element={
            authState.status === 'loading' ? (
              <PageSuspenseFallback />
            ) : authState.status === 'unauthenticated' ? (
              <div className="auth-gate-wrapper" style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>
                <AuthModal isOpen={true} onAuthSuccess={handleAuthSuccess} />
              </div>
            ) : (
              <div className={`app-shell ${isSidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
                <Sidebar
                  isOpen={isMobileSidebarOpen}
                  onClose={closeMobileSidebar}
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={toggleSidebarCollapse}
                  tenantContext={tenantContext}
                  onLogout={handleLogout}
                />

                <div className="main-area">
                  <ErrorBoundary>
                    <Routes>
                      <Route
                        path="/"
                        element={<Dashboard onToggleMobileMenu={toggleMobileSidebar} tenantContext={tenantContext} />}
                      />
                      <Route
                        path="/risk-queue"
                        element={<RiskQueue onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/products"
                        element={<Products onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/inventory"
                        element={<Inventory onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/transactions"
                        element={<Transactions onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/investigations"
                        element={<Investigations onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/financial"
                        element={<Financial onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/resources"
                        element={<Resources onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/activity"
                        element={<ActivityPage onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                      <Route
                        path="/saved-investigations"
                        element={<SavedInvestigations onToggleMobileMenu={toggleMobileSidebar} />}
                      />
                    </Routes>
                  </ErrorBoundary>
                </div>

                {/* Mobile Bottom Navigation (Visible on <= 768px) */}
                <MobileBottomNav
                  activeRiskCount={activeRiskCount}
                  tenantContext={tenantContext}
                />
              </div>
            )
          }
        />
      </Routes>
      <ToastContainer />
    </Suspense>
  )
}
