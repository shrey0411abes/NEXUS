import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  AlertTriangle,
  Package,
  TrendingUp,
  Receipt,
  MessageSquareText,
  History,
  FolderOpen,
  Archive,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { t } = useI18n()

  const staticCommands = useMemo(() => [
    {
      id: 'cmd-dashboard',
      label: t('sidebar.commandCenter'),
      category: t('sidebar.commandSection'),
      icon: LayoutDashboard,
      to: '/',
      shortcut: 'G D',
    },
    {
      id: 'cmd-risk',
      label: t('sidebar.riskIntelligence'),
      category: t('sidebar.intelligenceSection'),
      icon: AlertTriangle,
      to: '/risk-queue',
      shortcut: 'G R',
    },
    {
      id: 'cmd-financial',
      label: t('sidebar.financialIntelligence'),
      category: t('sidebar.intelligenceSection'),
      icon: TrendingUp,
      to: '/financial',
      shortcut: 'G F',
    },
    {
      id: 'cmd-inventory',
      label: t('sidebar.inventoryIntelligence'),
      category: t('sidebar.intelligenceSection'),
      icon: Package,
      to: '/inventory',
      shortcut: 'G I',
    },
    {
      id: 'cmd-transactions',
      label: t('sidebar.transactionIntelligence'),
      category: t('sidebar.intelligenceSection'),
      icon: Receipt,
      to: '/transactions',
      shortcut: 'G T',
    },
    {
      id: 'cmd-investigations',
      label: t('sidebar.investigations'),
      category: t('sidebar.intelligenceSection'),
      icon: MessageSquareText,
      to: '/investigations',
      shortcut: 'G N',
    },
    {
      id: 'cmd-activity',
      label: t('sidebar.riskActivity'),
      category: t('sidebar.resourcesSection'),
      icon: History,
      to: '/activity',
      shortcut: 'G A',
    },
    {
      id: 'cmd-resources',
      label: t('sidebar.businessData'),
      category: t('sidebar.resourcesSection'),
      icon: FolderOpen,
      to: '/resources',
      shortcut: '',
    },
    {
      id: 'cmd-saved',
      label: t('sidebar.savedInvestigations'),
      category: t('sidebar.intelligenceSection'),
      icon: Archive,
      to: '/saved-investigations',
      shortcut: '',
    },
  ], [t])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Key combination listener for global two-key chords (e.g., G then D)
  useEffect(() => {
    let lastKey = ''
    let keyTimeout = null

    const handleKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      if (e.key.toLowerCase() === 'g') {
        lastKey = 'g'
        clearTimeout(keyTimeout)
        keyTimeout = setTimeout(() => { lastKey = '' }, 800)
        return
      }

      if (lastKey === 'g') {
        const next = e.key.toLowerCase()
        lastKey = ''
        clearTimeout(keyTimeout)
        if (next === 'd') { e.preventDefault(); navigate('/') }
        else if (next === 'r') { e.preventDefault(); navigate('/risk-queue') }
        else if (next === 'f') { e.preventDefault(); navigate('/financial') }
        else if (next === 'i') { e.preventDefault(); navigate('/inventory') }
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

  const filteredCommands = staticCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  )

  const hasDirectQuestion = query.trim().length > 0

  const handleSelect = (cmd) => {
    onClose()
    navigate(cmd.to)
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
      const max = hasDirectQuestion ? filteredCommands.length : filteredCommands.length - 1
      setSelectedIndex((prev) => (prev < max ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const max = hasDirectQuestion ? filteredCommands.length : filteredCommands.length - 1
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : max))
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
      <div className="palette-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="palette-input-wrap">
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder={t('commandPalette.placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="topbar-kbd">ESC</kbd>
        </div>

        <div className="palette-list">
          {/* Ask AI prompt option if user typed something */}
          {hasDirectQuestion && (
            <div
              className={`palette-item ${selectedIndex === 0 ? 'selected' : ''}`}
              onClick={handleAskQuestion}
            >
              <div className="palette-item-left">
                <Sparkles size={15} color="var(--brand-light)" />
                <span>
                  {t('dashboard.askNexus')}: <strong style={{ color: '#fff' }}>“{query}”</strong>
                </span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {t('commandPalette.pressEnterToAsk')}
              </span>
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
                  <Icon size={15} color="var(--text-muted)" />
                  <span>{cmd.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {cmd.category}
                  </span>
                  {cmd.shortcut && (
                    <kbd className="topbar-kbd">{cmd.shortcut}</kbd>
                  )}
                </div>
              </div>
            )
          })}

          {!hasDirectQuestion && filteredCommands.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('commandPalette.noResults', { query })}
            </div>
          )}
        </div>

        <div className="palette-footer">
          <span>{t('commandPalette.shortcutHint')}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--brand-light)' }}>{t('global.appName')} {t('global.codeCalculatesAiExplains')}</span>
        </div>
      </div>
    </div>
  )
}
