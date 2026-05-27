import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useModalStore } from '@/lib/stores/modal'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers',
  useRouter: () => ({ back: vi.fn() }),
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
  useModalStore.setState({
    expectingRoute: false, isOpen: false, isClosing: false,
    title: null, originPath: null, keepAlive: false, triggerRef: null,
  })
})

describe('ModalLayout', () => {
  it('renders null when modal is closed', async () => {
    const ModalLayout = await loadLayout()
    const { container } = render(<ModalLayout><p>content</p></ModalLayout>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders children when modal is open', async () => {
    useModalStore.getState().openModal('Test', '/page')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>modal content</p></ModalLayout>)
    expect(screen.getByText('modal content')).toBeInTheDocument()
  })
})
