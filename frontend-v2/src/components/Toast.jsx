import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

// Global event bus for decoupled toast dispatching
const TOAST_EVENT = 'nexus-toast-dispatch'

export const toast = {
  success: (message, title = 'Success') => {
    dispatchToast({ type: 'success', title, message })
  },
  error: (message, title = 'Error') => {
    dispatchToast({ type: 'error', title, message })
  },
  info: (message, title = 'Notice') => {
    dispatchToast({ type: 'info', title, message })
  },
  warning: (message, title = 'Warning') => {
    dispatchToast({ type: 'warning', title, message })
  },
}

function dispatchToast(toastData) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: {
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...toastData,
        },
      })
    )
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    // Mark as exiting first to trigger fade-only out animation (160ms)
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 160)
  }, [])

  useEffect(() => {
    const handleDispatch = (event) => {
      const newToast = event.detail
      setToasts((prev) => [...prev, newToast])

      // Auto-dismiss after 3600ms
      setTimeout(() => {
        removeToast(newToast.id)
      }, 3600)
    }

    window.addEventListener(TOAST_EVENT, handleDispatch)
    return () => window.removeEventListener(TOAST_EVENT, handleDispatch)
  }, [removeToast])

  if (toasts.length === 0) return null

  return (
    <div className="nexus-toast-container" aria-live="polite">
      {toasts.map((item) => {
        const isError = item.type === 'error'
        const isSuccess = item.type === 'success'
        const isWarning = item.type === 'warning'

        return (
          <div
            key={item.id}
            className={`nexus-toast-item variant-${item.type || 'info'} ${
              item.isExiting ? 'exiting' : ''
            }`}
            role="status"
          >
            <div className="nexus-toast-icon">
              {isSuccess && <CheckCircle2 size={16} color="#2E9E83" />}
              {isError && <AlertTriangle size={16} color="#f43f5e" />}
              {isWarning && <AlertTriangle size={16} color="#f59e0b" />}
              {!isSuccess && !isError && !isWarning && (
                <Info size={16} color="#06b6d4" />
              )}
            </div>

            <div className="nexus-toast-content">
              {item.title && <div className="nexus-toast-title">{item.title}</div>}
              {item.message && (
                <div className="nexus-toast-message">{item.message}</div>
              )}
            </div>

            <button
              type="button"
              className="nexus-toast-close"
              onClick={() => removeToast(item.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ToastContainer
