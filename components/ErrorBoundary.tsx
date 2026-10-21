'use client';
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { btnPrimary, btnPrimaryInner } from '@/lib/ui';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <div className="flex items-center gap-3 text-accent">
            <AlertTriangle size={32} strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-extrabold">Something went wrong</h2>
            <p className="max-w-[400px] text-neutral-700">
              The app encountered an unexpected error. Your chat session may have ended.
            </p>
          </div>
          <button onClick={this.handleRetry} className={btnPrimary + ' max-w-[280px]'}>
            <span className={btnPrimaryInner}>
              Try again
              <RefreshCw size={18} className="transition-transform group-hover:rotate-180" />
            </span>
          </button>
          <a href="/" className="text-sm text-accent hover:underline">
            Start a new chat
          </a>
        </main>
      );
    }

    return this.props.children;
  }
}
