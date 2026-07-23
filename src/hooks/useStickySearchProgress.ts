import { useEffect, useRef, useState } from 'react'

interface StickySearchProgressOptions {
  distance?: number
  compactThreshold?: number
  paused?: boolean
}

const PROGRESS_PROPERTY = '--sticky-search-progress'

function clampProgress(scrollTop: number, distance: number) {
  return Math.min(1, Math.max(0, scrollTop / distance))
}

export function useStickySearchProgress(
  scrollContainer: HTMLElement | null,
  toolbar: HTMLElement | null,
  {
    distance = 112,
    compactThreshold = 0.96,
    paused = false,
  }: StickySearchProgressOptions = {},
) {
  const [compact, setCompact] = useState(false)
  const compactRef = useRef(false)
  const progressRef = useRef<number | null>(null)
  const progressToolbarRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let frameId: number | null = null

    const updateCompact = (nextCompact: boolean) => {
      if (nextCompact === compactRef.current) return
      compactRef.current = nextCompact
      setCompact(nextCompact)
    }

    const writeProgress = (progress: number) => {
      if (!toolbar) {
        progressRef.current = null
        progressToolbarRef.current = null
      } else if (
        toolbar !== progressToolbarRef.current ||
        progress !== progressRef.current
      ) {
        toolbar.style.setProperty(PROGRESS_PROPERTY, String(progress))
        progressRef.current = progress
        progressToolbarRef.current = toolbar
      }
      updateCompact(!paused && progress >= compactThreshold)
    }

    const commitProgress = () => {
      frameId = null
      const nextProgress =
        paused || !scrollContainer
          ? 0
          : clampProgress(scrollContainer.scrollTop, Math.max(1, distance))
      writeProgress(nextProgress)
    }

    const scheduleProgress = () => {
      if (frameId !== null) return
      frameId = requestAnimationFrame(commitProgress)
    }

    if (paused || !scrollContainer) {
      writeProgress(0)
    } else {
      scheduleProgress()
    }

    scrollContainer?.addEventListener('scroll', scheduleProgress, {
      passive: true,
    })
    return () => {
      scrollContainer?.removeEventListener('scroll', scheduleProgress)
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [compactThreshold, distance, paused, scrollContainer, toolbar])

  return compact
}
