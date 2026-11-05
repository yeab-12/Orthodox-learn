import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { failed: boolean }

/** Last line of defence: show a readable page instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
          <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-stone2-700">The page could not be displayed. Reload to try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring mx-auto mt-6 rounded-full bg-navy-900 px-6 py-3 font-semibold text-cream-50 hover:bg-navy-800"
          >
            Reload
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
