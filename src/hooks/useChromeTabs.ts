import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n/i18n'
import type { BrowserWindow, ChromeTabsApi } from '../types'

const EVENT_REFRESH_DELAY_MS = 40
const QUERY_RETRY_DELAY_MS = 250
const SUBSCRIPTION_RETRY_DELAY_MS = 250
const MAX_QUERY_RETRIES = 3
const MAX_SUBSCRIPTION_RETRIES = 3
export type ChromeTabsErrorCode = Extract<
  TranslationKey,
  'queryError' | 'subscriptionError'
>

export interface UseChromeTabsResult {
  windows: BrowserWindow[]
  focusedWindowId?: number
  loading: boolean
  /** Display-safe UI message; never contains raw exception text. */
  error: ChromeTabsErrorCode | null
  refresh(): Promise<void>
}

export function useChromeTabs(api: ChromeTabsApi): UseChromeTabsResult {
  const [windows, setWindows] = useState<BrowserWindow[]>([])
  const [focusedWindowId, setFocusedWindowId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [queryError, setQueryError] = useState<ChromeTabsErrorCode | null>(null)
  const [subscriptionError, setSubscriptionError] = useState<ChromeTabsErrorCode | null>(null)
  const mountedRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const retryAttemptsRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const automaticRetryRef = useRef(false)
  const eventRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const refreshRef = useRef<() => Promise<void>>(async () => {})
  const retrySubscriptionRef = useRef<() => void>(() => {})

  const refresh = useCallback(async () => {
    if (eventRefreshTimerRef.current !== undefined) {
      clearTimeout(eventRefreshTimerRef.current)
      eventRefreshTimerRef.current = undefined
    }

    const automaticRetry = automaticRetryRef.current
    automaticRetryRef.current = false

    if (!automaticRetry) {
      retryAttemptsRef.current = 0
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = undefined
      }
    }

    const requestSequence = ++requestSequenceRef.current

    if (!mountedRef.current) {
      return
    }

    if (!automaticRetry) {
      retrySubscriptionRef.current()
    }

    try {
      const nextWindows = await api.queryWindows()

      if (
        !mountedRef.current ||
        requestSequence !== requestSequenceRef.current
      ) {
        return
      }

      retryAttemptsRef.current = 0
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = undefined
      }
      setWindows(nextWindows)
      setFocusedWindowId(nextWindows.find((window) => window.focused)?.id)
      setQueryError(null)
    } catch {
      if (
        !mountedRef.current ||
        requestSequence !== requestSequenceRef.current
      ) {
        return
      }

      setQueryError('queryError')

      if (
        retryAttemptsRef.current < MAX_QUERY_RETRIES &&
        retryTimerRef.current === undefined
      ) {
        retryAttemptsRef.current += 1
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = undefined
          if (mountedRef.current) {
            automaticRetryRef.current = true
            void refreshRef.current()
          }
        }, QUERY_RETRY_DELAY_MS)
      }
    } finally {
      if (
        mountedRef.current &&
        requestSequence === requestSequenceRef.current
      ) {
        setLoading(false)
      }
    }
  }, [api])
  refreshRef.current = refresh

  useEffect(() => {
    mountedRef.current = true
    let effectActive = true
    let cleanedUp = false
    let unsubscribe: (() => void) | undefined
    let subscriptionRetryAttempts = 0
    let subscriptionRetryTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleRefresh = () => {
      if (!effectActive || !mountedRef.current) {
        return
      }

      if (eventRefreshTimerRef.current !== undefined) {
        clearTimeout(eventRefreshTimerRef.current)
      }

      eventRefreshTimerRef.current = setTimeout(() => {
        eventRefreshTimerRef.current = undefined
        if (effectActive && mountedRef.current) {
          void refresh()
        }
      }, EVENT_REFRESH_DELAY_MS)
    }

    const clearSubscriptionRetryTimer = () => {
      if (subscriptionRetryTimer !== undefined) {
        clearTimeout(subscriptionRetryTimer)
        subscriptionRetryTimer = undefined
      }
    }

    const attemptSubscription = (resetRetryBudget = false) => {
      if (!effectActive || !mountedRef.current || unsubscribe !== undefined) {
        return
      }

      if (resetRetryBudget) {
        subscriptionRetryAttempts = 0
        clearSubscriptionRetryTimer()
      }

      try {
        const nextUnsubscribe = api.subscribe(scheduleRefresh)

        if (!effectActive || !mountedRef.current) {
          try {
            nextUnsubscribe()
          } catch {
            // A subscription established during cleanup must not leak.
          }
          return
        }

        unsubscribe = nextUnsubscribe
        subscriptionRetryAttempts = 0
        clearSubscriptionRetryTimer()
        setSubscriptionError(null)
      } catch {
        if (!effectActive || !mountedRef.current) {
          return
        }

        setSubscriptionError('subscriptionError')
        if (
          subscriptionRetryAttempts < MAX_SUBSCRIPTION_RETRIES &&
          subscriptionRetryTimer === undefined
        ) {
          subscriptionRetryAttempts += 1
          subscriptionRetryTimer = setTimeout(() => {
            subscriptionRetryTimer = undefined
            attemptSubscription()
          }, SUBSCRIPTION_RETRY_DELAY_MS)
        }
      }
    }

    retrySubscriptionRef.current = () => attemptSubscription(true)
    automaticRetryRef.current = true
    void refresh()
    attemptSubscription()

    return () => {
      effectActive = false
      mountedRef.current = false
      requestSequenceRef.current += 1
      retrySubscriptionRef.current = () => {}

      if (eventRefreshTimerRef.current !== undefined) {
        clearTimeout(eventRefreshTimerRef.current)
        eventRefreshTimerRef.current = undefined
      }
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = undefined
      }
      clearSubscriptionRetryTimer()
      automaticRetryRef.current = false
      retryAttemptsRef.current = 0

      if (!cleanedUp) {
        cleanedUp = true
        try {
          unsubscribe?.()
        } catch {
          // Cleanup cannot update state after the hook has unmounted.
        }
        unsubscribe = undefined
      }
    }
  }, [api, refresh])

  return {
    windows,
    focusedWindowId,
    loading,
    error: queryError ?? subscriptionError,
    refresh,
  }
}
