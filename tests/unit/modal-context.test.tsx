import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModalProvider, useModal } from '@/components/modals/ModalContext'

function ConsumerComponent() {
  const { isClosing } = useModal()
  return <div>{isClosing ? 'closing' : 'open'}</div>
}

function StackConsumer() {
  const { stackDepth } = useModal()
  return <div data-testid="depth">{stackDepth}</div>
}

function ThrowingComponent() {
  useModal()
  return null
}

describe('ModalContext', () => {
  it('provides values to children via useModal', () => {
    render(
      <ModalProvider onDismiss={vi.fn()} onBack={vi.fn()} isClosing={false} stackDepth={0}>
        <ConsumerComponent />
      </ModalProvider>
    )
    expect(screen.getByText('open')).toBeInTheDocument()
  })

  it('useModal throws outside ModalProvider', () => {
    expect(() => render(<ThrowingComponent />)).toThrow(
      'useModal must be used within ModalProvider'
    )
  })

  it('reflects isClosing=true', () => {
    render(
      <ModalProvider onDismiss={vi.fn()} onBack={vi.fn()} isClosing={true} stackDepth={0}>
        <ConsumerComponent />
      </ModalProvider>
    )
    expect(screen.getByText('closing')).toBeInTheDocument()
  })

  it('provides stackDepth to children', () => {
    render(
      <ModalProvider onDismiss={vi.fn()} onBack={vi.fn()} isClosing={false} stackDepth={2}>
        <StackConsumer />
      </ModalProvider>
    )
    expect(screen.getByTestId('depth')).toHaveTextContent('2')
  })
})
