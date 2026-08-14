"use client"

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, MotionConfig } from "framer-motion"

import { cn } from "@/lib/utils"
import { useScrollLock } from "@/lib/use-scroll-lock"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

const emptySubscribe = () => () => {}

/** True only after hydration: guards `createPortal(document.body)` from SSR. */
function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

interface ModalShellProps {
  open: boolean
  onClose?: () => void
  labelledBy: string
  /** When false, ESC and backdrop click do not close (mandatory choice dialogs). */
  dismissible?: boolean
  className?: string
  children: ReactNode
}

/**
 * Unified modal frame: portal + AnimatePresence + focus trap + ESC close +
 * backdrop click close + scroll lock + safe-area padding.
 *
 * The consumer controls visibility via `open` and must keep the component
 * mounted (do not conditionally unmount it, or exit animations are skipped).
 */
export function ModalShell({ open, onClose, labelledBy, dismissible = true, className, children }: ModalShellProps) {
  const mounted = useIsMounted()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)

  useScrollLock(open)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  }, [onClose, dismissible])

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (dismissibleRef.current) {
          event.preventDefault()
          onCloseRef.current?.()
        }
        return
      }
      if (event.key !== "Tab") return

      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const isInside = active instanceof Node && panel.contains(active)

      // If focus escaped the panel (e.g. the view content swapped under it and
      // activeElement fell back to <body>), pull it back inside the dialog.
      if (!isInside) {
        event.preventDefault()
        if (event.shiftKey) last.focus()
        else first.focus()
        return
      }

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-[var(--safe-x)] pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={dismissible ? onClose : undefined}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              tabIndex={-1}
              className={cn(
                "relative w-full max-w-sm max-h-full overflow-y-auto outline-none",
                className
              )}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  )
}