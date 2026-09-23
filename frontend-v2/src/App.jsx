import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RiskQueue from './pages/RiskQueue.jsx'
import Inventory from './pages/Inventory.jsx'
import Transactions from './pages/Transactions.jsx'
import Investigations from './pages/Investigations.jsx'
import Financial from './pages/Financial.jsx'
import Resources from './pages/Resources.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import SavedInvestigations from './pages/SavedInvestigations.jsx'
import Landing from './pages/Landing.jsx'

export default function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

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

  return (
    <Routes>
      {/* Standalone Landing Page Route (No operational sidebar) */}
      <Route path="/landing" element={<Landing />} />

      {/* Operational Workspace Routes (Inside App Shell) */}
      <Route
        path="/*"
        element={
          <div className="app-shell">
            <Sidebar isOpen={isMobileSidebarOpen} onClose={closeMobileSidebar} />
            <div className="main-area">
              <Routes>
                <Route
                  path="/"
                  element={<Dashboard onToggleMobileMenu={toggleMobileSidebar} />}
                />
                <Route
                  path="/risk-queue"
                  element={<RiskQueue onToggleMobileMenu={toggleMobileSidebar} />}
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
            </div>
          </div>
        }
      />
    </Routes>
  )
}

