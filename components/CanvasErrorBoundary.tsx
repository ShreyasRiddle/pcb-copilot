"use client";

import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ position: "absolute", inset: 0, background: "#0a0a0f" }}
          className="flex flex-col items-center justify-center gap-3 text-center px-8"
        >
          <div className="text-2xl">⚠️</div>
          <p className="text-zinc-400 text-sm">3D renderer failed to initialize.</p>
          <p className="text-zinc-600 text-xs font-mono">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="mt-2 text-xs px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
