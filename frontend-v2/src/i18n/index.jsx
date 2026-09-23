import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import en from './en'
import hi from './hi'

const translations = { en, hi }
const STORAGE_KEY = 'nexus_lang'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved === 'hi' ? 'hi' : 'en'
    } catch {
      return 'en'
    }
  })

  // Set document language attribute
  useEffect(() => {
    try {
      document.documentElement.lang = lang
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore storage errors
    }
  }, [lang])

  const setLang = useCallback((newLang) => {
    if (newLang === 'en' || newLang === 'hi') {
      setLangState(newLang)
    }
  }, [])

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'hi' : 'en'))
  }, [])

  // Nested key resolver helper
  const resolveKey = useCallback((obj, keyPath) => {
    if (!obj || !keyPath) return undefined
    const parts = keyPath.split('.')
    let current = obj
    for (const part of parts) {
      if (current === undefined || current === null) return undefined
      current = current[part]
    }
    return current
  }, [])

  // Translation function with interpolation and fallback to English
  const t = useCallback((key, params = {}) => {
    const currentDict = translations[lang] || translations.en
    let str = resolveKey(currentDict, key)

    // Fallback to English if missing in target lang
    if (str === undefined && lang !== 'en') {
      str = resolveKey(translations.en, key)
    }

    // Safe return if missing everywhere
    if (str === undefined) {
      return key
    }

    if (typeof str !== 'string') {
      return str
    }

    // Interpolation {param}
    if (params && typeof params === 'object') {
      return str.replace(/\{(\w+)\}/g, (match, paramName) => {
        return params[paramName] !== undefined ? params[paramName] : match
      })
    }

    return str
  }, [lang, resolveKey])

  // Indian Currency Formatter (₹ with Indian digit grouping)
  const formatCurrency = useCallback((value, options = {}) => {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return '₹0'
    }
    const num = Number(value)
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN'
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
        ...options,
      }).format(num)
    } catch {
      return `₹${Math.round(num).toLocaleString('en-IN')}`
    }
  }, [lang])

  // Indian Number Formatter (Indian digit grouping: e.g. 1,25,000)
  const formatNumber = useCallback((value, options = {}) => {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return '0'
    }
    const num = Number(value)
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN'
    try {
      return new Intl.NumberFormat(locale, options).format(num)
    } catch {
      return num.toLocaleString('en-IN')
    }
  }, [lang])

  // Locale-aware Short Date (e.g. 12 Sep 2026 or 12 सित॰ 2026)
  const formatDateShort = useCallback((dateValue) => {
    if (!dateValue) return '—'
    try {
      const d = typeof dateValue === 'string' || typeof dateValue === 'number' ? new Date(dateValue) : dateValue
      if (isNaN(d.getTime())) return String(dateValue)
      const locale = lang === 'hi' ? 'hi-IN' : 'en-IN'
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d)
    } catch {
      return String(dateValue)
    }
  }, [lang])

  // Locale-aware Full Timestamp
  const formatDateTime = useCallback((dateValue) => {
    if (!dateValue) return '—'
    try {
      const d = typeof dateValue === 'string' || typeof dateValue === 'number' ? new Date(dateValue) : dateValue
      if (isNaN(d.getTime())) return String(dateValue)
      const locale = lang === 'hi' ? 'hi-IN' : 'en-IN'
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return String(dateValue)
    }
  }, [lang])

  // Relative Time Formatter (e.g. "2 min ago" / "2 मिनट पहले")
  const formatRelativeTime = useCallback((timestamp) => {
    if (!timestamp) return '—'
    try {
      const d = new Date(timestamp)
      const diffMs = Date.now() - d.getTime()
      const diffSec = Math.floor(diffMs / 1000)
      const diffMin = Math.floor(diffSec / 60)
      const diffHrs = Math.floor(diffMin / 60)
      const diffDays = Math.floor(diffHrs / 24)

      if (lang === 'hi') {
        if (diffSec < 60) return 'अभी'
        if (diffMin < 60) return `${diffMin} मिनट पहले`
        if (diffHrs < 24) return `${diffHrs} घंटे पहले`
        return `${diffDays} दिन पहले`
      } else {
        if (diffSec < 60) return 'just now'
        if (diffMin < 60) return `${diffMin}m ago`
        if (diffHrs < 24) return `${diffHrs}h ago`
        return `${diffDays}d ago`
      }
    } catch {
      return String(timestamp)
    }
  }, [lang])

  const value = useMemo(() => ({
    lang,
    setLang,
    toggleLang,
    t,
    formatCurrency,
    formatNumber,
    formatDateShort,
    formatDateTime,
    formatRelativeTime,
  }), [lang, setLang, toggleLang, t, formatCurrency, formatNumber, formatDateShort, formatDateTime, formatRelativeTime])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

export default {
  I18nProvider,
  useI18n,
}
