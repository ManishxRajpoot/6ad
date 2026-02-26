'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: ((value: boolean) => void) | null
  }>({
    open: false,
    options: { title: '', message: '' },
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state.resolve?.(true)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }

  const handleCancel = () => {
    state.resolve?.(false)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }

  const { open, options } = state
  const variant = options.variant || 'default'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {open && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />

          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-[400px] max-w-[90vw] p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-2">{options.title}</h3>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">{options.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {options.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                  variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : variant === 'warning'
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return context.confirm
}
