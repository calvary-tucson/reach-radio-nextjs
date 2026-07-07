'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode | ((retry: () => void) => ReactNode)
}

interface State {
  hasError: boolean
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SectionErrorBoundary]', error, info.componentStack)
  }

  retry = () => {
    this.setState({ hasError: false })
  }

  override render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.retry)
      }
      return this.props.fallback ?? (
        <div className="rounded-2xl border border-white/10 light:border-gray-200 bg-white/5 light:bg-gray-50 px-6 py-8 text-center text-sm text-white/60 light:text-gray-500">
          Something went wrong loading this section. Please refresh the page.
        </div>
      )
    }
    return this.props.children
  }
}
