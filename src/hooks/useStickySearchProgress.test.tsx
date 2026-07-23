import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStickySearchProgress } from './useStickySearchProgress'

const PROGRESS_PROPERTY = '--sticky-search-progress'

function createFrameHarness() {
  let nextFrameId = 0
  const frames = new Map<number, FrameRequestCallback>()
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrameId
    frames.set(id, callback)
    return id
  })
  const cancel = vi.fn((id: number) => {
    frames.delete(id)
  })
  return {
    request,
    cancel,
    flush() {
      const pending = [...frames.entries()]
      frames.clear()
      for (const [id, callback] of pending) callback(id)
    },
    pendingCount: () => frames.size,
  }
}

function progressOf(toolbar: HTMLElement) {
  return Number(toolbar.style.getPropertyValue(PROGRESS_PROPERTY))
}

describe('useStickySearchProgress', () => {
  let frameHarness: ReturnType<typeof createFrameHarness>

  beforeEach(() => {
    frameHarness = createFrameHarness()
    vi.stubGlobal('requestAnimationFrame', frameHarness.request)
    vi.stubGlobal('cancelAnimationFrame', frameHarness.cancel)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes clamped progress directly to the toolbar and supports reversing', () => {
    const container = document.createElement('main')
    const toolbar = document.createElement('div')
    const { result, unmount } = renderHook(() =>
      useStickySearchProgress(container, toolbar, { distance: 112 }),
    )

    expect(result.current).toBe(false)
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0)

    container.scrollTop = 56
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0.5)
    expect(result.current).toBe(false)

    container.scrollTop = 500
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(1)
    expect(result.current).toBe(true)

    container.scrollTop = -20
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0)
    expect(result.current).toBe(false)

    container.scrollTop = 40
    act(() => container.dispatchEvent(new Event('scroll')))
    expect(frameHarness.pendingCount()).toBe(1)
    unmount()
    expect(frameHarness.cancel).toHaveBeenCalled()
  })

  it('updates intermediate CSS progress without repeated React semantic renders', () => {
    const container = document.createElement('main')
    const toolbar = document.createElement('div')
    let renderCount = 0
    const { result } = renderHook(() => {
      renderCount += 1
      return useStickySearchProgress(container, toolbar, {
        distance: 100,
        compactThreshold: 0.96,
      })
    })
    act(() => frameHarness.flush())
    const initialRenderCount = renderCount

    for (const scrollTop of [20, 40, 60, 95]) {
      container.scrollTop = scrollTop
      act(() => container.dispatchEvent(new Event('scroll')))
      act(() => frameHarness.flush())
      expect(progressOf(toolbar)).toBe(scrollTop / 100)
      expect(result.current).toBe(false)
      expect(renderCount).toBe(initialRenderCount)
    }

    container.scrollTop = 96
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0.96)
    expect(result.current).toBe(true)
    expect(renderCount).toBe(initialRenderCount + 1)

    container.scrollTop = 100
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(1)
    expect(result.current).toBe(true)
    expect(renderCount).toBe(initialRenderCount + 1)

    container.scrollTop = 95
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(result.current).toBe(false)
    expect(renderCount).toBe(initialRenderCount + 2)
  })

  it('coalesces multiple scroll events into one animation frame', () => {
    const container = document.createElement('main')
    const toolbar = document.createElement('div')
    const setProperty = vi.spyOn(toolbar.style, 'setProperty')
    renderHook(() => useStickySearchProgress(container, toolbar, { distance: 100 }))
    act(() => frameHarness.flush())
    frameHarness.request.mockClear()
    setProperty.mockClear()

    container.scrollTop = 30
    act(() => {
      container.dispatchEvent(new Event('scroll'))
      container.dispatchEvent(new Event('scroll'))
      container.dispatchEvent(new Event('scroll'))
    })
    expect(frameHarness.request).toHaveBeenCalledTimes(1)
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0.3)
    expect(setProperty).toHaveBeenCalledTimes(1)

    setProperty.mockClear()
    container.dispatchEvent(new Event('scroll'))
    act(() => frameHarness.flush())
    expect(setProperty).not.toHaveBeenCalled()
  })

  it('removes the scroll listener so events after unmount cannot schedule another frame', () => {
    const container = document.createElement('main')
    const toolbar = document.createElement('div')
    const removeListener = vi.spyOn(container, 'removeEventListener')
    const { unmount } = renderHook(() =>
      useStickySearchProgress(container, toolbar, { distance: 112 }),
    )
    act(() => frameHarness.flush())
    frameHarness.request.mockClear()

    unmount()
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function))

    container.scrollTop = 112
    container.dispatchEvent(new Event('scroll'))
    expect(frameHarness.request).not.toHaveBeenCalled()
  })

  it('pauses at expanded state and restores from the latest scroll position', () => {
    const container = document.createElement('main')
    const toolbar = document.createElement('div')
    const { result, rerender } = renderHook(
      ({ paused }) =>
        useStickySearchProgress(container, toolbar, {
          distance: 112,
          paused,
        }),
      { initialProps: { paused: false } },
    )
    act(() => frameHarness.flush())

    container.scrollTop = 112
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(1)
    expect(result.current).toBe(true)

    act(() => rerender({ paused: true }))
    expect(progressOf(toolbar)).toBe(0)
    expect(result.current).toBe(false)

    container.scrollTop = 56
    act(() => container.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0)
    expect(result.current).toBe(false)

    act(() => rerender({ paused: false }))
    expect(frameHarness.pendingCount()).toBe(1)
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0.5)
    expect(result.current).toBe(false)
  })

  it('detaches from replaced nodes and binds the new container and toolbar', () => {
    const containerA = document.createElement('main')
    const toolbarA = document.createElement('div')
    const containerB = document.createElement('main')
    const toolbarB = document.createElement('div')
    const removeFromA = vi.spyOn(containerA, 'removeEventListener')
    const addToB = vi.spyOn(containerB, 'addEventListener')
    const { rerender } = renderHook(
      ({ container, toolbar }) =>
        useStickySearchProgress(container, toolbar, { distance: 100 }),
      { initialProps: { container: containerA, toolbar: toolbarA } },
    )
    act(() => frameHarness.flush())

    containerA.scrollTop = 50
    act(() => containerA.dispatchEvent(new Event('scroll')))
    expect(frameHarness.pendingCount()).toBe(1)

    rerender({ container: containerB, toolbar: toolbarB })
    expect(removeFromA).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(addToB).toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
    })
    expect(frameHarness.cancel).toHaveBeenCalled()

    act(() => frameHarness.flush())
    frameHarness.request.mockClear()
    const oldProgress = progressOf(toolbarA)
    containerA.scrollTop = 100
    containerA.dispatchEvent(new Event('scroll'))
    expect(frameHarness.request).not.toHaveBeenCalled()
    expect(progressOf(toolbarA)).toBe(oldProgress)

    containerB.scrollTop = 25
    act(() => containerB.dispatchEvent(new Event('scroll')))
    act(() => frameHarness.flush())
    expect(progressOf(toolbarB)).toBe(0.25)
  })

  it('keeps a single active listener through StrictMode setup and cleanup', () => {
    const container = document.createElement('main')
    const toolbar = document.createElement('div')
    const removeListener = vi.spyOn(container, 'removeEventListener')
    const { unmount } = renderHook(
      () => useStickySearchProgress(container, toolbar, { distance: 112 }),
      { wrapper: StrictMode },
    )
    act(() => frameHarness.flush())
    frameHarness.request.mockClear()

    container.scrollTop = 56
    act(() => container.dispatchEvent(new Event('scroll')))
    expect(frameHarness.request).toHaveBeenCalledTimes(1)
    act(() => frameHarness.flush())
    expect(progressOf(toolbar)).toBe(0.5)

    unmount()
    expect(removeListener.mock.calls.length).toBeGreaterThanOrEqual(2)
    frameHarness.request.mockClear()
    container.dispatchEvent(new Event('scroll'))
    expect(frameHarness.request).not.toHaveBeenCalled()
  })
})
