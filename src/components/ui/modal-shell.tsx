"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"

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

/** Durata (ms) del fade-out dell'overlay; deve restare > della durata CSS (200ms). */
const EXIT_FADE_MS = 220

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
 * Unified modal frame: portal + CSS enter/exit animations + focus trap + ESC
 * close + backdrop click close + scroll lock + safe-area padding.
 *
 * The consumer controls visibility via `open` and must keep the component
 * mounted. The portal stays mounted: when `open` is false the overlay keeps a
 * `visible` state for the 220ms exit fade, then is fully hidden.
 */
export function ModalShell({ open, onClose, labelledBy, dismissible = true, className, children }: ModalShellProps) {
  const mounted = useIsMounted()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  const [visible, setVisible] = useState(false)
  const [openSeq, setOpenSeq] = useState(0)
  const [prevOpen, setPrevOpen] = useState(open)

  useScrollLock(open)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  }, [onClose, dismissible])

  // Adjust state during render (pattern documentato da React, niente effect):
  // appena `open` diventa true, `visible` segue e `openSeq` incrementa. La key
  // del pannello usa `openSeq`: il remount (che ri-avvia l'enter) avviene solo
  // quando `openSeq` cambia, cioè a ogni apertura — NON durante l'exit.
  if (open && !prevOpen) {
    setOpenSeq((s) => s + 1)
    setPrevOpen(true)
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }
  if (open && !visible) {
    setVisible(true)
  }

  // Quando `open` scende a false, `visible` resta true per EXIT_FADE_MS (exit fade),
  // poi il timer lo porta a false e l'overlay viene nascosto del tutto.
  useEffect(() => {
    if (open) return
    const t = window.setTimeout(() => setVisible(false), EXIT_FADE_MS)
    return () => window.clearTimeout(t)
  }, [open])

  // focus trap
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
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center px-[var(--safe-x)] pt-[var(--safe-top)] pb-[var(--safe-bottom)] transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
        !open && !visible && "hidden"
      )}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        key={openSeq}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-sm max-h-full overflow-y-auto outline-none modal-shell-enter",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}