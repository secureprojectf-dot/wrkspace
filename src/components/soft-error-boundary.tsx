'use client';

import React, { Component, type ReactNode } from 'react';

type Props = {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error) => void;
};

type State = {
	error: Error | null;
};

/** Keeps login shell alive when a child tab throws. */
export class SoftErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error) {
		this.props.onError?.(error);
		console.error('[SoftErrorBoundary]', error);
	}

	render() {
		if (!this.state.error) return this.props.children;
		if (this.props.fallback) return this.props.fallback;
		const msg = this.state.error.message || 'Unknown error';
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B1220] px-6 text-center text-white">
				<p className="text-lg font-semibold">Something went wrong</p>
				<p className="max-w-sm break-words text-xs text-white/60 font-mono">{msg}</p>
				<button
					type="button"
					className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black"
					onClick={() => {
						this.setState({ error: null });
						window.location.reload();
					}}
				>
					Reload
				</button>
			</div>
		);
	}
}
