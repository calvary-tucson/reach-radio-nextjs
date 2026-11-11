import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useModalStore } from '@/lib/stores/modal'

const routerBack = vi.fn()
const routerMock = { back: routerBack }
vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers',
  useRouter: () => routerMock,
}))

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

vi.mock('@/components/teachers/TeacherSearchSheetContent', () => ({
  TeacherSearchSheetContent: () => <div data-testid="search-sheet" />,
}))

vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

async function loadLayout() {
  const mod = await import('@/app/@modal/layout')
  return mod.default
}

beforeEach(() => {
  routerBack.mockClear()
  useModalStore.setState({
    expectingRoute: false, isOpen: false, isClosing: false,
    title: null, triggerRef: null, stackDepth: 0, rootSheet: null, expectingBack: false,
  })
})

describe('ModalLayout', () => {
  it('renders null when modal is closed', async () => {
    const ModalLayout = await loadLayout()
    const { container } = render(<ModalLayout><p>content</p></ModalLayout>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders children when modal is open', async () => {
    useModalStore.getState().openModal('Test')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>modal content</p></ModalLayout>)
    expect(screen.getByText('modal content')).toBeInTheDocument()
  })

  it('startClosing() → isOpen becomes false after EXIT_DURATION', async () => {
    vi.useFakeTimers()
    // Arrange: modal open with stack depth 1 (nested teacher)
    useModalStore.setState({
      expectingRoute: false, isOpen: true, isClosing: false,
      title: 'Teacher B', triggerRef: null, stackDepth: 1,
      expectingBack: false,
    })
    const ModalLayout = await loadLayout()
    render(
      <ModalLayout>
        <button data-testid="close-trigger">Close</button>
      </ModalLayout>
    )
    // Simulate dismiss (onDismiss is handleClose)
    const store = useModalStore.getState()
    store.startClosing()
    // After EXIT_DURATION (150ms), isOpen should be false
    await vi.advanceTimersByTimeAsync(200)
    // store.isOpen should be false
    expect(useModalStore.getState().isOpen).toBe(false)
    vi.useRealTimers()
  })

  it('wraps detail content in the teacher panel shell', async () => {
    useModalStore.getState().openModal('Test')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>modal content</p></ModalLayout>)
    const dialog = screen.getByRole('dialog', { name: 'Teacher profile' })
    expect(dialog).toContainElement(screen.getByText('modal content'))
  })

  it('renders no teacher shell for the search sheet root', async () => {
    useModalStore.getState().openSearchSheet('Search')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>modal content</p></ModalLayout>)
    expect(screen.getByTestId('search-sheet')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Teacher profile' })).not.toBeInTheDocument()
  })

  it('swaps in the teacher shell when a detail is pushed over the search sheet', async () => {
    useModalStore.getState().openSearchSheet('Search')
    const ModalLayout = await loadLayout()
    const { rerender } = render(<ModalLayout><p>modal content</p></ModalLayout>)
    act(() => { useModalStore.getState().pushModal('Teacher') })
    rerender(<ModalLayout><p>modal content</p></ModalLayout>)
    expect(screen.getByRole('dialog', { name: 'Teacher profile' })).toBeInTheDocument()
    expect(screen.queryByTestId('search-sheet')).not.toBeInTheDocument()
  })

  it('keeps the same shell node across teacher swaps', async () => {
    useModalStore.getState().openModal('A')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>modal content</p></ModalLayout>)
    const dialog = screen.getByRole('dialog', { name: 'Teacher profile' })
    act(() => { useModalStore.getState().pushModal('B') })
    expect(screen.getByRole('dialog', { name: 'Teacher profile' })).toBe(dialog)
  })

  it('ignores a second Back while the first is still animating', async () => {
    useModalStore.setState({
      expectingRoute: true, isOpen: true, isClosing: false,
      title: 'B', triggerRef: null, stackDepth: 2, rootSheet: 'detail', expectingBack: false,
    })
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>content</p></ModalLayout>)
    const back = screen.getAllByRole('button', { name: 'Back' })[0]
    act(() => { back.click() })
    act(() => { back.click() })
    expect(routerBack).toHaveBeenCalledTimes(1)
    expect(useModalStore.getState().stackDepth).toBe(1)
  })

  it('overlay is opaque at once on open (no fade-in) so the nav cannot show through', async () => {
    useModalStore.getState().openModal('Test')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>content</p></ModalLayout>)
    const overlay = document.querySelector('[class*="bg-black/80"]') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.className).not.toContain('fade-in')
  })

  it('overlay still fades out while closing', async () => {
    useModalStore.setState({
      expectingRoute: true, isOpen: true, isClosing: true,
      title: 'Test', triggerRef: null, stackDepth: 0, rootSheet: 'detail', expectingBack: false,
    })
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>content</p></ModalLayout>)
    const overlay = document.querySelector('[class*="bg-black/80"]') as HTMLElement
    expect(overlay.className).toContain('fade-out')
  })
})
