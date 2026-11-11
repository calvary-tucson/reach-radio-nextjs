import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { PanelContentStage } from '@/components/modals/chrome/PanelContentStage'

type Frames = Keyframe[]
interface FakeAnim {
  target: Element
  frames: Frames
  cancel: ReturnType<typeof vi.fn>
  finish: () => void
  finished: Promise<void>
}

const anims: FakeAnim[] = []
const scrollTops = new WeakMap<Element, number>()
let originalAnimate: typeof Element.prototype.animate | undefined

beforeEach(() => {
  anims.length = 0
  originalAnimate = Element.prototype.animate
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get() { return scrollTops.get(this) ?? 0 },
    set(v: number) { scrollTops.set(this, v) },
  })
  Element.prototype.animate = function (this: Element, frames: Frames | PropertyIndexedKeyframes | null) {
    let finish!: () => void
    const finished = new Promise<void>((res) => { finish = res })
    const anim: FakeAnim = { target: this, frames: frames as Frames, cancel: vi.fn(), finish, finished }
    anims.push(anim)
    return anim as unknown as Animation
  } as typeof Element.prototype.animate
})

afterEach(() => {
  Element.prototype.animate = originalAnimate as typeof Element.prototype.animate
})

function Stage({
  direction,
  contentKey,
  text,
  reducedMotion = false,
  onConsume = vi.fn(),
  onSettled = vi.fn(),
}: {
  direction: 'push' | 'pop' | null
  contentKey: string
  text: string
  reducedMotion?: boolean
  onConsume?: () => void
  onSettled?: () => void
}) {
  return (
    <PanelContentStage
      direction={direction}
      reducedMotion={reducedMotion}
      contentKey={contentKey}
      onConsume={onConsume}
      onSettled={onSettled}
    >
      <div id="hero">
        <p>{text}</p>
      </div>
    </PanelContentStage>
  )
}

describe('PanelContentStage', () => {
  it('push: ghosts the outgoing content (inert, aria-hidden, no ids, scroll copied) and slides new in', () => {
    const onConsume = vi.fn()
    const { container, rerender } = render(
      <Stage direction={null} contentKey="/a" text="Teacher A" onConsume={onConsume} />,
    )
    const live = container.querySelector('[data-panel-content]') as HTMLElement
    live.scrollTop = 120
    // The signal renders first (old content still on screen), then the swap lands.
    rerender(<Stage direction="push" contentKey="/a" text="Teacher A" onConsume={onConsume} />)
    rerender(<Stage direction="push" contentKey="/b" text="Teacher B" onConsume={onConsume} />)

    const ghost = container.querySelector('[data-panel-ghost]') as HTMLElement
    expect(ghost).not.toBeNull()
    expect(ghost.hasAttribute('inert')).toBe(true)
    expect(ghost.getAttribute('aria-hidden')).toBe('true')
    expect(ghost.querySelector('[id]')).toBeNull()
    expect(ghost.scrollTop).toBe(120)
    expect(ghost.textContent).toContain('Teacher A')
    expect(live.textContent).toContain('Teacher B')
    expect(onConsume).toHaveBeenCalled()

    expect(anims).toHaveLength(2)
    const ghostAnim = anims.find((a) => a.target === ghost)!
    const liveAnim = anims.find((a) => a.target === live)!
    expect(ghostAnim.frames[1].transform).toBe('translateX(-28%)')
    expect(String(ghostAnim.frames[1].filter)).toContain('brightness')
    expect(liveAnim.frames[0].transform).toBe('translateX(100%)')
  })

  it('pop: the leaving ghost slides right and the revealed content drifts back in', () => {
    const { container, rerender } = render(<Stage direction={null} contentKey="/b" text="Teacher B" />)
    rerender(<Stage direction="pop" contentKey="/b" text="Teacher B" />)
    rerender(<Stage direction="pop" contentKey="/a" text="Teacher A" />)
    const ghost = container.querySelector('[data-panel-ghost]') as HTMLElement
    const live = container.querySelector('[data-panel-content]') as HTMLElement
    expect(ghost.textContent).toContain('Teacher B')
    expect(anims.find((a) => a.target === ghost)!.frames[1].transform).toBe('translateX(100%)')
    expect(anims.find((a) => a.target === live)!.frames[0].transform).toBe('translateX(-28%)')
  })

  it('removes the ghost and settles once when the animation finishes', async () => {
    const onSettled = vi.fn()
    const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" onSettled={onSettled} />)
    rerender(<Stage direction="push" contentKey="/a" text="A" onSettled={onSettled} />)
    rerender(<Stage direction="push" contentKey="/b" text="B" onSettled={onSettled} />)
    expect(container.querySelectorAll('[data-panel-ghost]')).toHaveLength(1)
    await act(async () => { anims.forEach((a) => a.finish()) })
    expect(container.querySelectorAll('[data-panel-ghost]')).toHaveLength(0)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('reduced motion: no animate call, no ghost, settles immediately', () => {
    const onSettled = vi.fn()
    const onConsume = vi.fn()
    const { container, rerender } = render(
      <Stage direction={null} contentKey="/a" text="A" reducedMotion onSettled={onSettled} onConsume={onConsume} />,
    )
    rerender(
      <Stage direction="push" contentKey="/a" text="A" reducedMotion onSettled={onSettled} onConsume={onConsume} />,
    )
    rerender(
      <Stage direction="push" contentKey="/b" text="B" reducedMotion onSettled={onSettled} onConsume={onConsume} />,
    )
    expect(anims).toHaveLength(0)
    expect(container.querySelector('[data-panel-ghost]')).toBeNull()
    // Settles at once (no waiting); the lock never holds under reduced motion.
    expect(onSettled).toHaveBeenCalled()
    expect(onConsume).toHaveBeenCalled()
  })

  it('does not animate a content change without a direction signal (browser history, first load)', () => {
    const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" />)
    rerender(<Stage direction={null} contentKey="/b" text="B" />)
    expect(anims).toHaveLength(0)
    expect(container.querySelector('[data-panel-ghost]')).toBeNull()
  })

  it('ignores a stale direction present at mount (shell mounted by a push over the search sheet)', () => {
    const onConsume = vi.fn()
    render(<Stage direction="push" contentKey="/a" text="A" onConsume={onConsume} />)
    expect(anims).toHaveLength(0)
    expect(onConsume).toHaveBeenCalled()
  })

  it('push resets the live scroll to 0 while the ghost keeps the old offset', () => {
    const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" />)
    const live = container.querySelector('[data-panel-content]') as HTMLElement
    live.scrollTop = 300
    rerender(<Stage direction="push" contentKey="/a" text="A" />)
    rerender(<Stage direction="push" contentKey="/b" text="B" />)
    expect(live.scrollTop).toBe(0)
    expect((container.querySelector('[data-panel-ghost]') as HTMLElement).scrollTop).toBe(300)
  })

  it('pop restores the revealed page\'s own scroll offset', () => {
    const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" />)
    const live = container.querySelector('[data-panel-content]') as HTMLElement
    live.scrollTop = 250
    rerender(<Stage direction="push" contentKey="/a" text="A" />)
    rerender(<Stage direction="push" contentKey="/b" text="B" />)
    rerender(<Stage direction={null} contentKey="/b" text="B" />)
    live.scrollTop = 40
    rerender(<Stage direction="pop" contentKey="/b" text="B" />)
    rerender(<Stage direction="pop" contentKey="/a" text="A" />)
    expect(live.scrollTop).toBe(250)
  })

  it('consumes the signal at arm so a repeated same-direction signal fires again', () => {
    const onConsume = vi.fn()
    const { rerender } = render(<Stage direction={null} contentKey="/a" text="A" onConsume={onConsume} />)
    rerender(<Stage direction="push" contentKey="/a" text="A" onConsume={onConsume} />)
    expect(onConsume).toHaveBeenCalledTimes(1)
    rerender(<Stage direction="push" contentKey="/b" text="B" onConsume={onConsume} />)
    expect(anims).toHaveLength(2)
  })

  describe('with fake timers', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('a signal with no route change drops the ghost state and settles after the timeout', () => {
      const onSettled = vi.fn()
      const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" onSettled={onSettled} />)
      rerender(<Stage direction="push" contentKey="/a" text="A" onSettled={onSettled} />)
      expect(onSettled).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(2100) })
      expect(onSettled).toHaveBeenCalledTimes(1)
      // A later swap with no new signal must not animate from the stale arm.
      rerender(<Stage direction={null} contentKey="/b" text="B" onSettled={onSettled} />)
      expect(anims).toHaveLength(0)
      expect(container.querySelector('[data-panel-ghost]')).toBeNull()
    })

    it('reduced motion holds the lock until the swap commits', () => {
      const onSettled = vi.fn()
      const { rerender } = render(<Stage direction={null} contentKey="/a" text="A" reducedMotion onSettled={onSettled} />)
      rerender(<Stage direction="pop" contentKey="/a" text="A" reducedMotion onSettled={onSettled} />)
      expect(onSettled).not.toHaveBeenCalled()
      rerender(<Stage direction={null} contentKey="/b" text="B" reducedMotion onSettled={onSettled} />)
      expect(onSettled).toHaveBeenCalledTimes(1)
    })
  })

  it('signal and swap in the same commit still animates (live layer only)', () => {
    const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" />)
    rerender(<Stage direction="push" contentKey="/b" text="B" />)
    const live = container.querySelector('[data-panel-content]') as HTMLElement
    expect(container.querySelector('[data-panel-ghost]')).toBeNull()
    expect(anims).toHaveLength(1)
    expect(anims[0].target).toBe(live)
    expect(anims[0].frames[0].transform).toBe('translateX(100%)')
  })

  it('a new signal mid-animation cancels the previous run and leaves a single ghost', () => {
    const { container, rerender } = render(<Stage direction={null} contentKey="/a" text="A" />)
    rerender(<Stage direction="push" contentKey="/a" text="A" />)
    rerender(<Stage direction="push" contentKey="/b" text="B" />)
    const first = [...anims]
    // Consumed signal resets to null, then a second push arrives mid-animation.
    rerender(<Stage direction={null} contentKey="/b" text="B" />)
    rerender(<Stage direction="push" contentKey="/b" text="B" />)
    rerender(<Stage direction="push" contentKey="/c" text="C" />)
    first.forEach((a) => expect(a.cancel).toHaveBeenCalled())
    expect(container.querySelectorAll('[data-panel-ghost]')).toHaveLength(1)
  })
})
