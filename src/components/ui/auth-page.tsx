'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { EmployeeDashboard } from './employee-dashboard';

import {
	AtSignIcon,
	ChevronLeftIcon,
	Grid2x2PlusIcon,
	LockIcon,
	MailIcon,
	ArrowLeftIcon,
	CheckCircle2Icon,
	SendIcon,
	KeyIcon,
	TerminalIcon,
} from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { 
	loginEmployee, 
	sendEmployeeOtp, 
	verifyEmployeeOtpAndResetPassword
} from '@/app/admin/actions';

type ViewType = 'login' | 'forgot' | 'forgot_verify' | 'forgot_sent';

export function AuthPage() {
	const [view, setView] = useState<ViewType>('login');

	// Login state
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [loggedInEmployee, setLoggedInEmployee] = useState<any>(null);
	const [sessionRestored, setSessionRestored] = useState(false);

	// Restore session from localStorage on mount
	useEffect(() => {
		try {
			const saved = localStorage.getItem('wrkspace_employee_session');
			if (saved) {
				setLoggedInEmployee(JSON.parse(saved));
			}
		} catch (e) {
			localStorage.removeItem('wrkspace_employee_session');
		} finally {
			setSessionRestored(true);
		}
	}, []);

	// Forgot password state
	const [forgotEmail, setForgotEmail] = useState('');
	const [otpCode, setOtpCode] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isSending, setIsSending] = useState(false);
	const [forgotMessage, setForgotMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage(null);

		if (!email || !password) {
			setMessage({ type: 'error', text: 'Please enter both your email address and password.' });
			setIsLoading(false);
			return;
		}

		try {
			const result = await loginEmployee(email, password);
			if (result.success && result.employee) {
				localStorage.setItem('wrkspace_employee_session', JSON.stringify(result.employee));
				setLoggedInEmployee(result.employee);
			} else {
				setMessage({ type: 'error', text: result.error || 'Authentication failed' });
			}
		} catch (error) {
			setMessage({ type: 'error', text: 'An unexpected system error occurred.' });
		} finally {
			setIsLoading(false);
		}
	};

	const handleSendOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setForgotMessage(null);
		if (!forgotEmail) {
			setForgotMessage({ type: 'error', text: 'Please enter your registered email address.' });
			return;
		}
		setIsSending(true);
		try {
			const result = await sendEmployeeOtp(forgotEmail);
			if (result.success) {
				setView('forgot_verify');
				setForgotMessage({ type: 'success', text: `OTP sent successfully to ${forgotEmail}. Please check your inbox!` });
			} else {
				setForgotMessage({ type: 'error', text: result.error || 'Failed to send OTP.' });
			}
		} catch {
			setForgotMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
		} finally {
			setIsSending(false);
		}
	};

	const handleVerifyAndReset = async (e: React.FormEvent) => {
		e.preventDefault();
		setForgotMessage(null);

		if (!otpCode || !newPassword || !confirmPassword) {
			setForgotMessage({ type: 'error', text: 'Please fill in all verification fields.' });
			return;
		}

		if (newPassword !== confirmPassword) {
			setForgotMessage({ type: 'error', text: 'New passwords do not match.' });
			return;
		}

		setIsSending(true);
		try {
			const result = await verifyEmployeeOtpAndResetPassword(forgotEmail, otpCode, newPassword);
			if (result.success) {
				setView('forgot_sent');
				setForgotMessage(null);
			} else {
				setForgotMessage({ type: 'error', text: result.error || 'Verification failed.' });
			}
		} catch {
			setForgotMessage({ type: 'error', text: 'Reset failed. Please try again.' });
		} finally {
			setIsSending(false);
		}
	};

	const goBackToLogin = () => {
		setView('login');
		setForgotEmail('');
		setOtpCode('');
		setNewPassword('');
		setConfirmPassword('');
		setForgotMessage(null);
		setMessage(null);
	};

	const handleLogout = () => {
		localStorage.removeItem('wrkspace_employee_session');
		setLoggedInEmployee(null);
		setView('login');
		setEmail('');
		setPassword('');
		setMessage(null);
	};

	// Wait for session restore before rendering to avoid flash
	if (!sessionRestored) return null;

	// ─── EMPLOYEE DASHBOARD VIEW ───
	if (loggedInEmployee) {
		return (
			<EmployeeDashboard 
				employee={loggedInEmployee} 
				onLogout={handleLogout} 
			/>
		);
	}

	// ─── AUTHENTICATION PORTAL VIEWS ───
	return (
		<main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-[3fr_5fr] bg-zinc-950 font-sans">
			{/* Left Side Panel (Brand/Quote) */}
			<div className="relative hidden h-full flex-col border-r border-zinc-800/80 bg-zinc-950 p-10 lg:flex overflow-hidden">
				{/* Premium dust grey background shading */}
				<div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 z-0" />
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.015),transparent_40%)] z-0" />
				<div className="from-zinc-950 absolute inset-0 z-10 bg-gradient-to-t to-transparent opacity-40" />

				<div className="z-10 flex items-center gap-2">
					<img src="https://ik.imagekit.io/dypkhqxip/logogog" alt="WrkSpace Logo" className="h-10 w-auto object-contain" />
				</div>
				<div className="z-10 mt-auto">
					<blockquote className="space-y-3">
						<p className="text-xl text-zinc-100 font-light leading-relaxed">
							“This platform helps employees and developers connect to the main servers of the company, deliver leads, and ensure fast client project delivery.”
						</p>
						<footer className="font-mono text-sm font-semibold text-zinc-400">
							~ Rishi Rohan Kalapala
						</footer>
					</blockquote>
				</div>
				<div className="absolute inset-0 z-0">
					<FloatingPaths position={1} />
					<FloatingPaths position={-1} />
				</div>
			</div>

			{/* Right Side Panel (Form) */}
			<div className="relative flex min-h-screen flex-col justify-center bg-zinc-950 p-8 lg:p-12 overflow-hidden">
				{/* Premium background shading gradients for right side */}
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_70%)] z-0" />
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.02),transparent_50%)] z-0" />

				{/* Form wrapper */}
				<div className="w-full max-w-[420px] mx-auto z-10">
					<AnimatePresence mode="wait">
						{/* ─── LOGIN VIEW ─── */}
						{view === 'login' && (
							<motion.div
								key="login"
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 20 }}
								transition={{ duration: 0.2 }}
								className="space-y-6"
							>
								<div className="flex flex-col space-y-2">
									<img src="https://ik.imagekit.io/dypkhqxip/logogog" alt="WrkSpace Logo" className="h-10 w-auto object-contain self-start mb-2" />
									<p className="text-zinc-400 text-sm leading-relaxed font-medium">
										Employee Portal directory console. Sign in below using your enterprise coordinates.
									</p>
								</div>

								{message && (
									<div className={cn(
										"p-3 rounded-none text-xs border font-mono font-bold",
										message.type === 'success' 
											? "bg-emerald-950/30 border-emerald-850 text-emerald-400" 
											: "bg-red-950/30 border-red-850 text-red-400"
									)}>
										{message.text}
									</div>
								)}

								<form onSubmit={handleLogin} className="space-y-4">
									{/* Email Field */}
									<div className="space-y-2">
										<p className="text-zinc-300 text-start text-xs font-bold">
											Enter your email address to sign in or create an account
										</p>
										<div className="relative h-max">
											<Input
												placeholder="your.email@example.com"
												className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-550 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 transition-colors"
												type="email"
												required
												value={email}
												onChange={(e) => setEmail(e.target.value)}
											/>
											<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
												<AtSignIcon className="size-4" aria-hidden="true" />
											</div>
										</div>
									</div>

									{/* Password Field */}
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<p className="text-zinc-300 text-start text-xs font-bold">
												Password (Your custom password or 6-Digit ID)
											</p>
											<Button
												type="button"
												variant="link"
												onClick={() => { setView('forgot'); setMessage(null); setForgotMessage(null); }}
												className="p-0 h-auto text-xs text-zinc-400 hover:text-indigo-400 transition-colors font-bold hover:no-underline cursor-pointer"
											>
												Forgot password?
											</Button>
										</div>
										<div className="relative h-max">
											<Input
												placeholder="••••••"
												className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-555 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 transition-colors"
												type="password"
												required
												value={password}
												onChange={(e) => setPassword(e.target.value)}
											/>
											<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
												<LockIcon className="size-4" aria-hidden="true" />
											</div>
										</div>
									</div>

									<Button 
										type="submit" 
										disabled={isLoading}
										className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
									>
										<span>{isLoading ? 'Processing...' : 'Continue With Email'}</span>
									</Button>
								</form>
								<p className="text-zinc-555 mt-8 text-xs leading-relaxed">
									By clicking continue, you agree to our{' '}
									<a
										href="#"
										className="text-zinc-450 hover:text-indigo-400 underline underline-offset-4 transition-colors"
									>
										Terms of Service
									</a>{' '}
									and{' '}
									<a
										href="#"
										className="text-zinc-450 hover:text-indigo-400 underline underline-offset-4 transition-colors"
									>
										Privacy Policy
									</a>
									.
								</p>
							</motion.div>
						)}

						{/* ─── FORGOT PASSWORD: REQUEST OTP VIEW ─── */}
						{view === 'forgot' && (
							<motion.div
								key="forgot"
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -20 }}
								transition={{ duration: 0.2 }}
								className="space-y-6"
							>
								{/* Breadcrumbs instead of Back button */}
								<nav className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
									<button 
										type="button" 
										onClick={goBackToLogin}
										className="text-zinc-400 hover:text-indigo-400 transition-colors hover:underline cursor-pointer font-normal"
									>
										Sign In
									</button>
									<span>/</span>
									<span className="text-zinc-300">Forgot Password</span>
								</nav>

								<div className="flex flex-col space-y-2">
									<div className="w-10 h-10 rounded-none bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-2">
										<MailIcon className="size-5 text-indigo-400" />
									</div>
									<h1 className="font-heading text-3xl font-extrabold tracking-tight text-white">
										Forgot your password?
									</h1>
									<p className="text-zinc-400 text-sm leading-relaxed font-medium">
										No worries. Enter your registered email address and we&apos;ll send an OTP reset code to your inbox.
									</p>
								</div>

								{forgotMessage && (
									<div className={cn(
										"p-3 rounded-none text-xs border font-mono",
										forgotMessage.type === 'success' 
											? "bg-emerald-950/30 border-emerald-800 text-emerald-450" 
											: "bg-red-950/30 border-red-800 text-red-440"
									)}>
										{forgotMessage.text}
									</div>
								)}

								<form onSubmit={handleSendOtp} className="space-y-4">
									<div className="space-y-2">
										<p className="text-zinc-300 text-xs font-bold">Registered Email Address</p>
										<div className="relative h-max">
											<Input
												placeholder="your.email@example.com"
												className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-550 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 transition-colors"
												type="email"
												required
												value={forgotEmail}
												onChange={(e) => setForgotEmail(e.target.value)}
											/>
											<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
												<AtSignIcon className="size-4" aria-hidden="true" />
											</div>
										</div>
									</div>

									<Button 
										type="submit" 
										disabled={isSending}
										className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
									>
										{isSending ? (
											<span className="flex items-center gap-2 justify-center">
												<span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
												Sending...
											</span>
										) : 'Send Reset Code'}
									</Button>
								</form>
							</motion.div>
						)}

						{/* ─── FORGOT PASSWORD: VERIFY OTP AND UPDATE VIEW ─── */}
						{view === 'forgot_verify' && (
							<motion.div
								key="forgot_verify"
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -20 }}
								transition={{ duration: 0.2 }}
								className="space-y-6"
							>
								{/* Breadcrumbs */}
								<nav className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
									<button 
										type="button" 
										onClick={goBackToLogin}
										className="text-zinc-400 hover:text-indigo-400 transition-colors hover:underline cursor-pointer font-normal"
									>
										Sign In
									</button>
									<span>/</span>
									<button 
										type="button" 
										onClick={() => setView('forgot')}
										className="text-zinc-400 hover:text-indigo-400 transition-colors hover:underline cursor-pointer font-normal"
									>
										Forgot Password
									</button>
									<span>/</span>
									<span className="text-zinc-300">Verify OTP</span>
								</nav>

								<div className="flex flex-col space-y-2">
									<div className="w-10 h-10 rounded-none bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-2">
										<KeyIcon className="size-5 text-indigo-400" />
									</div>
									<h1 className="font-heading text-3xl font-extrabold tracking-tight text-white">
										Verify OTP Code
									</h1>
									<p className="text-zinc-400 text-sm leading-relaxed font-medium">
										We sent a 6-digit verification code to <span className="text-indigo-400 font-semibold">{forgotEmail}</span>. Enter the code and set your new account password below.
									</p>
								</div>

								{forgotMessage && (
									<div className={cn(
										"p-3 rounded-none text-xs border font-mono",
										forgotMessage.type === 'success' 
											? "bg-emerald-950/30 border-emerald-800 text-emerald-450" 
											: "bg-red-950/30 border-red-800 text-red-440"
									)}>
										{forgotMessage.text}
									</div>
								)}

								<form onSubmit={handleVerifyAndReset} className="space-y-4">
									<div className="space-y-2">
										<p className="text-zinc-300 text-xs font-bold">6-Digit Verification Code</p>
										<div className="relative h-max">
											<Input
												placeholder="123456"
												maxLength={6}
												className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-550 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 transition-colors font-mono tracking-widest text-center text-sm"
												type="text"
												required
												value={otpCode}
												onChange={(e) => setOtpCode(e.target.value)}
											/>
											<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
												<TerminalIcon className="size-4" aria-hidden="true" />
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<p className="text-zinc-300 text-xs font-bold">New Password</p>
										<div className="relative h-max">
											<Input
												placeholder="••••••"
												className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-555 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 transition-colors"
												type="password"
												required
												value={newPassword}
												onChange={(e) => setNewPassword(e.target.value)}
											/>
											<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
												<LockIcon className="size-4" aria-hidden="true" />
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<p className="text-zinc-300 text-xs font-bold">Confirm New Password</p>
										<div className="relative h-max">
											<Input
												placeholder="••••••"
												className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-555 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 transition-colors"
												type="password"
												required
												value={confirmPassword}
												onChange={(e) => setConfirmPassword(e.target.value)}
											/>
											<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
												<LockIcon className="size-4" aria-hidden="true" />
											</div>
										</div>
									</div>

									<Button 
										type="submit" 
										disabled={isSending}
										className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
									>
										{isSending ? 'Updating Password...' : 'Verify & Set Password'}
									</Button>
								</form>
							</motion.div>
						)}

						{/* ─── FORGOT PASSWORD: SUCCESS FLOW VIEW ─── */}
						{view === 'forgot_sent' && (
							<motion.div
								key="forgot_sent"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0 }}
								className="text-center space-y-6 py-4"
							>
								<div className="mx-auto size-12 bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-center rounded-none mb-2">
									<CheckCircle2Icon className="size-6 text-emerald-400" />
								</div>
								
								<div className="space-y-2">
									<h2 className="text-2xl font-bold tracking-tight text-white">Password Updated</h2>
									<p className="text-zinc-400 text-xs leading-relaxed max-w-sm mx-auto">
										Your password has been successfully reset. You can now use your custom email credentials to log in.
									</p>
								</div>

								<Button
									onClick={goBackToLogin}
									className="w-full bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
								>
									Back to login
								</Button>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</main>
	);
}

// ─── BACKGROUND VECTOR PATHS (LEFT PANEL) ───
function FloatingPaths({ position }: { position: number }) {
	const paths = Array.from({ length: 36 }, (_, i) => ({
		id: i,
		d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
			380 - i * 5 * position
		} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
			152 - i * 5 * position
		} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
			684 - i * 5 * position
		} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
		color: `rgba(255,255,255,${0.08 + i * 0.02})`,
		width: 0.5 + i * 0.02,
	}));

	return (
		<div className="pointer-events-none absolute inset-0">
			<svg
				className="h-full w-full text-white"
				viewBox="0 0 696 316"
				fill="none"
			>
				<title>Background Paths</title>
				{paths.map((path) => (
					<motion.path
						key={path.id}
						d={path.d}
						stroke="currentColor"
						strokeWidth={path.width}
						strokeOpacity={0.06 + path.id * 0.015}
						initial={{ pathLength: 0.3, opacity: 0.5 }}
						animate={{
							pathLength: 1,
							opacity: [0.2, 0.5, 0.2],
							pathOffset: [0, 1, 0],
						}}
						transition={{
							duration: 20 + Math.random() * 10,
							repeat: Number.POSITIVE_INFINITY,
							ease: 'linear',
						}}
					/>
				))}
			</svg>
		</div>
	);
}
