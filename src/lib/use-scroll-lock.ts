"use client"

import { useEffect } from "react"

/**
 * Locks page scroll while `locked` is true.
 *
 * The homepage scrolls inside `<main>` (snap sections), while admin pages
 * scroll on `<body>`. Lock both so a modal never leaks scroll behind it.
 * Previous inline styles are restored on unlock.
 *
 * NOTE: single-modal only. If two scroll-locks ever mounted at the same time
 * (e.g. a new "open a second modal" feature), the unlock of the last-closing
 * one wins and the first modal's lock is silently lost — refactor to a
 * counting mechanism before nesting modals.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const main = document.querySelector("main")
    const previous = {
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollX: document.body.style.overscrollBehaviorX,
      bodyOverscrollY: document.body.style.overscrollBehaviorY,
      mainOverflow: main?.style.overflow ?? "",
      mainOverscrollX: main?.style.overscrollBehaviorX ?? "",
      mainOverscrollY: main?.style.overscrollBehaviorY ?? "",
    }

    document.body.style.overflow = "hidden"
    document.body.style.overscrollBehaviorX = "none"
    document.body.style.overscrollBehaviorY = "none"
    if (main) {
      main.style.overflow = "hidden"
      main.style.overscrollBehaviorX = "none"
      main.style.overscrollBehaviorY = "none"
    }

    return () => {
      document.body.style.overflow = previous.bodyOverflow
      document.body.style.overscrollBehaviorX = previous.bodyOverscrollX
      document.body.style.overscrollBehaviorY = previous.bodyOverscrollY
      if (main) {
        main.style.overflow = previous.mainOverflow
        main.style.overscrollBehaviorX = previous.mainOverscrollX
        main.style.overscrollBehaviorY = previous.mainOverscrollY
      }
    }
  }, [locked])
}