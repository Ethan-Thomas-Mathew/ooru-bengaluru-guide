// ---------------------------------------------------------------
// ErrorBoundary.tsx
// If any page crashes while drawing, React would normally show a blank
// screen. An "error boundary" catches the crash and shows a friendly
// message instead. (Error boundaries must be class components; it's
// one of the few places React still needs them.)
// ---------------------------------------------------------------

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  failed: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In a real product this would go to an error-tracking service
    console.error('Page crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="wrap page empty">
        <h1>Something broke on this page</h1>
        <p className="muted">Reload to try again. If it keeps happening, the page may have a bug.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    )
  }
}
