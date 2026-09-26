import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  AlertTriangle,
  Boxes,
  Package,
  TrendingUp,
  Receipt,
  MessageSquareText,
  History,
  FolderOpen,
  Archive,
  Sparkles,
  Languages,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()

  const commands = useMemo(() => [
    // 1. COMMAND & OVERVIEW
    {
      id: 'cmd-dashboard',
      label: t('sidebar.commandCenter') || 'Command Center',
      category: t('sidebar.commandSection') || 'COMMAND',
      icon: LayoutDashboard,
      to: '/',
      shortcut: 'G D',
    },
    // 2. OPERATIONS
    {
      id: 'cmd-inventory',
      label: t('sidebar.inventoryIntelligence') || 'Inventory Intelligence',
      category: t('sidebar.operationsSection') || 'OPERATIONS',
      icon: Package,
      to: '/inventory',
      shortcut: 'G I',
    },
    {
      id: 'cmd-products',
      label: t('sidebar.productCatalog') || 'Product Catalog',
      category: t('sidebar.operationsSection') || 'OPERATIONS',
      icon: Boxes,
      to: '/products',
      shortcut: 'G P',
    },
    {
      id: 'cmd-transactions',
      label: t('sidebar.transactionIntelligence') || 'Transaction Intelligence',
      category: t('sidebar.operationsSection') || 'OPERATIONS',
      icon: Receipt,
      to: '/transactions',
      shortcut: 'G T',
    },
    // 3. INTELLIGENCE
    {
      id: 'cmd-risk',
      label: t('sidebar.riskIntelligence') || 'Priority Risk Queue',
      category: t('sidebar.intelligenceSection') || 'INTELLIGENCE',
      icon: AlertTriangle,
      to: '/risk-queue',
      shortcut: 'G R',
    },
    {
      id: 'cmd-financial',
      label: t('sidebar.financialIntelligence') || 'Financial Exposure Terminal',
      category: t('sidebar.intelligenceSection') || 'INTELLIGENCE',
      icon: TrendingUp,
      to: '/financial',
      shortcut: 'G F',
    },
    {
      id: 'cmd-investigations',
      label: t('sidebar.investigations') || 'Grounded AI Investigations',
      category: t('sidebar.intelligenceSection') || 'INTELLIGENCE',
      icon: MessageSquareText,
      to: '/investigations',
      shortcut: 'G N',
    },
    // 4. GOVERNANCE
    {
      id: 'cmd-activity',
      label: t('sidebar.riskActivity') || 'Operational Audit Stream',
      category: t('sidebar.governanceSection') || 'GOVERNANCE',
      icon: History,
      to: '/activity',
      shortcut: 'G A',
    },
    {
      id: 'cmd-saved',
      label: t('sidebar.savedInvestigations') || 'Investigation History',
      category: t('sidebar.governanceSection') || 'GOVERNANCE',
      icon: Archive,
      to: '/saved-investigations',
      shortcut: '',
    },
    {
      id: 'cmd-resources',
      label: t('sidebar.businessData') || 'System Topology & Documentation',
      category: t('sidebar.governanceSection') || 'GOVERNANCE',
      icon: FolderOpen,
      to: '/resources',
      shortcut: '',
    },
    // 5. PREFERENCES
    {
      id: 'cmd-lang-switch',
      label: lang === 'en' ? 'Switch Interface to Hindi (हिन्दी)' : 'Switch Interface to English',
      category: 'PREFERENCES',
      icon: Languages,
      action: () => setLang(lang === 'en' ? 'hi' : 'en'),
      shortcut: 'ALT L',
    },
  ], [t, lang, setLang])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [isOpen])

  // Key combination listener for global two-key chords (e.g. G then D)
  useEffect(() => {
    let lastKey = ''
    let keyTimeout = null

    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      if (e.key?.toLowerCase() === 'g') {
        lastKey = 'g'
        clearTimeout(keyTimeout)
        keyTimeout = setTimeout(() => { lastKey = '' }, 800)
        return
      }

      if (lastKey === 'g') {
        const next = e.key?.toLowerCase()
        lastKey = ''
        clearTimeout(keyTimeout)
        if (next === 'd') { e.preventDefault(); navigate('/') }
        else if (next === 'r') { e.preventDefault(); navigate('/risk-queue') }
        else if (next === 'f') { e.preventDefault(); navigate('/financial') }
        else if (next === 'i') { e.preventDefault(); navigate('/inventory') }
        else if (next === 'p') { e.preventDefault(); navigate('/products') }
        else if (next === 't') { e.preventDefault(); navigate('/transactions') }
        else if (next === 'a') { e.preventDefault(); navigate('/activity') }
        else if (next === 'n') { e.preventDefault(); navigate('/investigations') }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(keyTimeout)
    }
  }, [navigate])

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    )
  }, [commands, query])

  const hasDirectQuestion = query.trim().length > 0

  const handleSelect = (cmd) => {
    onClose()
    if (cmd.action) {
      cmd.action()
    } else if (cmd.to) {
      navigate(cmd.to)
    }
  }

  const handleAskQuestion = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    onClose()
    navigate(`/investigations?q=${encodeURIComponent(trimmed)}`)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const total = hasDirectQuestion ? filteredCommands.length + 1 : filteredCommands.length
      setSelectedIndex((prev) => (prev < total - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const total = hasDirectQuestion ? filteredCommands.length + 1 : filteredCommands.length
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : total - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hasDirectQuestion && selectedIndex === 0) {
        handleAskQuestion()
      } else {
        const cmdIndex = hasDirectQuestion ? selectedIndex - 1 : selectedIndex
        if (filteredCommands[cmdIndex]) {
          handleSelect(filteredCommands[cmdIndex])
        } else if (hasDirectQuestion) {
          handleAskQuestion()
        }
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command Palette">
        <div className="palette-input-wrap">
          <Search size={16} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder={t('commandPalette.placeholder') || 'Type a command, navigate, or ask any business question...'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="topbar-kbd">ESC</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {/* Direct AI Question trigger if query is typed */}
          {hasDirectQuestion && (
            <div
              className={`palette-item palette-item-ai ${selectedIndex === 0 ? 'selected' : ''}`}
              onClick={handleAskQuestion}
              onMouseEnter={() => setSelectedIndex(0)}
            >
              <div className="palette-item-left">
                <div className="palette-item-icon-box ai">
                  <Sparkles size={14} />
                </div>
                <div>
                  <span className="palette-item-title">
                    {t('dashboard.askNexus') || 'Ask NEXUS'}: <strong style={{ color: '#fff' }}>“{query}”</strong>
                  </span>
                  <p className="palette-item-desc">
                    {t('commandPalette.pressEnterToAsk') || 'Press Enter to investigate with deterministic SQL facts'}
                  </p>
                </div>
              </div>
              <span className="palette-badge-kbd">ENTER ↵</span>
            </div>
          )}

          {filteredCommands.map((cmd, idx) => {
            const itemIndex = hasDirectQuestion ? idx + 1 : idx
            const Icon = cmd.icon
            return (
              <div
                key={cmd.id}
                className={`palette-item ${selectedIndex === itemIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(itemIndex)}
              >
                <div className="palette-item-left">
                  <div className="palette-item-icon-box">
                    <Icon size={14} />
                  </div>
                  <span className="palette-item-title">{cmd.label}</span>
                </div>
                <div className="palette-item-right">
                  <span className="palette-item-category">{cmd.category}</span>
                  {cmd.shortcut && (
                    <kbd className="topbar-kbd">{cmd.shortcut}</kbd>
                  )}
                </div>
              </div>
            )
          })}

          {!hasDirectQuestion && filteredCommands.length === 0 && (
            <div className="palette-empty-box">
              {t('commandPalette.noResults', { query })}
            </div>
          )}
        </div>

        <footer className="palette-footer">
          <div className="palette-footer-keys">
            <span><kbd className="topbar-kbd">↑</kbd> <kbd className="topbar-kbd">↓</kbd> navigate</span>
            <span><kbd className="topbar-kbd">↵</kbd> select</span>
            <span><kbd className="topbar-kbd">ESC</kbd> dismiss</span>
          </div>
          <div className="palette-footer-brand">
            <span className="status-dot-pulse" />
            <span>NEXUS WORKSTATION</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
