'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './button';
import {
	AtSignIcon,
	ChevronLeftIcon,
	Grid2x2PlusIcon,
	LockIcon,
	KeyIcon,
} from 'lucide-react';
import { AdminDashboard } from './admin-dashboard';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { loginAdmin, loginAdminWithGoogle, sendOtp, verifyOtpAndResetPassword, getAdminByInviteToken } from '@/app/admin/actions';
import { GoogleSignInButton } from './google-sign-in-button';
import { firebaseAuth, googleProvider } from '@/lib/firebase-client';
import { signInWithPopup } from 'firebase/auth';

type FormState = 'login' | 'forgot-request' | 'forgot-verify' | 'dashboard';

export function AdminPage() {
	const [formState, setFormState] = useState<FormState>('login');
	const [email, setEmail] = useState('webstrixx@gmail.com');
	const [password, setPassword] = useState('');
	const [sessionRestored, setSessionRestored] = useState(false);
	const [orgName, setOrgName] = useState<string | null>(null);

	// Restore admin session from localStorage on mount & listen to invite token
	useEffect(() => {
		// Check if logged in as normal employee (non-lead) and redirect
		try {
			const empSaved = localStorage.getItem('wrkspace_employee_session');
			if (empSaved) {
				const emp = JSON.parse(empSaved);
				if (emp && emp.role !== 'Team Lead') {
					window.location.href = '/';
					return;
				}
			}
		} catch (e) {
			console.error('Failed to parse employee session', e);
		}

		try {
			const saved = localStorage.getItem('wrkspace_admin_session');
			if (saved) {
				const { email: savedEmail } = JSON.parse(saved);
				setEmail(savedEmail);
				setFormState('dashboard');
			}
		} catch (e) {
			localStorage.removeItem('wrkspace_admin_session');
		} finally {
			setSessionRestored(true);
		}

		// Handle invite token
		const searchParams = new URLSearchParams(window.location.search);
		const inviteToken = searchParams.get('invite');
		if (inviteToken) {
			setIsLoading(true);
			getAdminByInviteToken(inviteToken).then((res: any) => {
				if (res.success && res.admin) {
					setEmail(res.admin.email);
					setOrgName(res.admin.organizationName);
					setMessage({ type: 'success', text: `Welcome! Setting up access for ${res.admin.organizationName}. Please log in.` });
				} else {
					setMessage({ type: 'error', text: res.error || 'Invalid or expired invitation link.' });
				}
				setIsLoading(false);
			}).catch((err) => {
				console.error(err);
				setIsLoading(false);
			});
		}
	}, []);
	
	const [otp, setOtp] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage(null);

		try {
			const result = await loginAdmin(email, password);
			if (result.success) {
				setMessage(null);
				localStorage.setItem('wrkspace_admin_session', JSON.stringify({ email }));
				setFormState('dashboard');
			} else {
				setMessage({ type: 'error', text: result.error || 'Authentication failed' });
			}
		} catch (error: any) {
			setMessage({ type: 'error', text: 'An unexpected error occurred.' });
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		if (isLoading) return;
		setIsLoading(true);
		setMessage(null);
		try {
			const cred = await signInWithPopup(firebaseAuth, googleProvider);
			const googleEmail = cred.user?.email;
			if (!googleEmail) {
				setMessage({ type: 'error', text: 'Google sign-in did not return an email.' });
				return;
			}
			const result = await loginAdminWithGoogle(googleEmail);
			if (result.success && result.email) {
				setEmail(result.email);
				localStorage.setItem('wrkspace_admin_session', JSON.stringify({ email: result.email }));
				setFormState('dashboard');
			} else {
				setMessage({ type: 'error', text: result.error || 'No admin linked to this Google account' });
			}
		} catch (error: any) {
			const code = String(error?.code || '');
			if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
				setMessage(null);
			} else {
				setMessage({ type: 'error', text: error?.message || 'Google sign-in failed.' });
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleRequestOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage(null);

		try {
			const result = await sendOtp(email);
			if (result.success) {
				setMessage({ type: 'success', text: `OTP has been successfully sent to ${email}!` });
				setFormState('forgot-verify');
			} else {
				setMessage({ type: 'error', text: result.error || 'Failed to send OTP' });
			}
		} catch (error: any) {
			setMessage({ type: 'error', text: 'An unexpected error occurred.' });
		} finally {
			setIsLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (newPassword !== confirmPassword) {
			setMessage({ type: 'error', text: 'Passwords do not match.' });
			return;
		}

		setIsLoading(true);
		setMessage(null);

		try {
			const result = await verifyOtpAndResetPassword(email, otp, newPassword);
			if (result.success) {
				setMessage({ type: 'success', text: 'Password successfully reset! You can now log in.' });
				setFormState('login');
				setPassword('');
				setOtp('');
				setNewPassword('');
				setConfirmPassword('');
			} else {
				setMessage({ type: 'error', text: result.error || 'Failed to reset password' });
			}
		} catch (error: any) {
			setMessage({ type: 'error', text: 'An unexpected error occurred.' });
		} finally {
			setIsLoading(false);
		}
	};

	if (!sessionRestored) return null;

	if (formState === 'dashboard') {
		return (
			<AdminDashboard 
				email={email} 
				onLogout={() => {
					localStorage.removeItem('wrkspace_admin_session');
					setFormState('login');
					setPassword('');
					setMessage(null);
				}}
			/>
		);
	}

	return (
		<main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2 bg-zinc-950">
			{/* Left Side Panel (Brand/Quote) */}
			<div className="relative hidden h-full flex-col border-r border-zinc-800/80 bg-zinc-950 p-10 lg:flex overflow-hidden">
				{/* Premium dust grey background shading */}
				<div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 z-0" />
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.015),transparent_40%)] z-0" />
				<div className="from-zinc-950 absolute inset-0 z-10 bg-gradient-to-t to-transparent opacity-40" />

				<div className="z-10 flex items-center gap-2">
					<Grid2x2PlusIcon className="size-6 text-zinc-400" />
					<p className="text-xl font-semibold text-white tracking-wide">WrkSpace</p>
				</div>
				<div className="z-10 mt-auto">
					<blockquote className="space-y-3">
						<p className="text-xl text-zinc-100 font-light leading-relaxed">
							&ldquo;This platform helps employees and developers connect to the main servers of the company, deliver leads, and ensure fast client project delivery.&rdquo;
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

			{/* Right Side Panel (Forms) */}
			<div className="relative flex min-h-screen flex-col justify-center bg-zinc-950 p-8 lg:p-12 overflow-hidden">
				{/* Premium background shading gradients */}
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_70%)] z-0" />
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.02),transparent_50%)] z-0" />

				<Button 
					variant="ghost" 
					className="absolute top-7 left-5 text-zinc-400 hover:text-white hover:bg-zinc-900/50 cursor-pointer transition-colors" 
					asChild
				>
					<a href="/">
						<ChevronLeftIcon className='size-4 me-2' />
						Home
					</a>
				</Button>

				<div className="relative z-10 mx-auto w-full max-w-sm space-y-6">
					<div className="flex items-center gap-2 lg:hidden">
						<Grid2x2PlusIcon className="size-6 text-zinc-400" />
						<p className="text-xl font-semibold text-white tracking-wide">WrkSpace</p>
					</div>

					{/* Notification Message */}
					{message && (
						<div className={cn(
							"p-3 rounded-none text-xs border",
							message.type === 'success' 
								? "bg-emerald-950/30 border-emerald-800 text-emerald-400" 
								: "bg-red-950/30 border-red-800 text-red-400"
						)}>
							{message.text}
						</div>
					)}

					{/* State: Login Form */}
					{formState === 'login' && (
						<div className="space-y-6">
							<div className="flex flex-col space-y-2">
								<h1 className="font-heading text-3xl font-bold tracking-tight text-white">
									Admin Portal
								</h1>
								<p className="text-zinc-400 text-sm">
									Sign in with email or continue with Google to access the admin dashboard.
								</p>
							</div>

							<form onSubmit={handleLogin} className="space-y-4">
								<div className="space-y-2">
									<p className="text-zinc-400 text-start text-xs font-medium">
										Admin Email Address
									</p>
									<div className="relative h-max">
										<Input
											placeholder="your.email@example.com"
											className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
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

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<p className="text-zinc-400 text-start text-xs font-medium">
											Password
										</p>
										<Button
											type="button"
											variant="link"
											className="p-0 h-auto text-xs text-zinc-400 hover:text-indigo-400 transition-colors font-normal hover:no-underline cursor-pointer"
											onClick={() => {
												setMessage(null);
												setFormState('forgot-request');
											}}
										>
											Forgot password?
										</Button>
									</div>
									<div className="relative h-max">
										<Input
											placeholder="••••••••"
											className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
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
									className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-medium shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
								>
									<span>{isLoading ? 'Signing In...' : 'Sign In as Admin'}</span>
								</Button>
							</form>

							<div className="relative my-1">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-zinc-800" />
								</div>
								<div className="relative flex justify-center text-[11px] uppercase tracking-widest">
									<span className="bg-zinc-950 px-3 text-zinc-500 font-mono font-bold">or</span>
								</div>
							</div>

							<GoogleSignInButton
								onClick={handleGoogleLogin}
								disabled={isLoading}
								loading={isLoading}
								label="Continue with Google"
							/>
						</div>
					)}

					{/* State: Forgot Password - Request OTP */}
					{formState === 'forgot-request' && (
						<div className="space-y-6">
							<div className="flex flex-col space-y-2">
								<h1 className="font-heading text-3xl font-bold tracking-tight text-white">
									Reset Password
								</h1>
								<p className="text-zinc-400 text-sm">
									Enter your admin email to request a reset code (OTP).
								</p>
							</div>

							<form onSubmit={handleRequestOtp} className="space-y-4">
								<div className="space-y-2">
									<p className="text-zinc-400 text-start text-xs font-medium">
										Admin Email Address
									</p>
									<div className="relative h-max">
										<Input
											placeholder="your.email@example.com"
											className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
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

								<Button 
									type="submit" 
									disabled={isLoading}
									className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-medium shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
								>
									<span>{isLoading ? 'Sending OTP...' : 'Send OTP Email'}</span>
								</Button>

								<Button 
									type="button" 
									variant="ghost"
									className="w-full text-zinc-400 hover:text-white cursor-pointer"
									onClick={() => {
										setMessage(null);
										setFormState('login');
									}}
								>
									Back to Login
								</Button>
							</form>
						</div>
					)}

					{/* State: Forgot Password - Verify OTP & Reset */}
					{formState === 'forgot-verify' && (
						<div className="space-y-6">
							<div className="flex flex-col space-y-2">
								<h1 className="font-heading text-3xl font-bold tracking-tight text-white">
									Enter OTP Code
								</h1>
								<p className="text-zinc-400 text-sm">
									Please enter the 6-digit code sent to your email and set your new password.
								</p>
							</div>

							<form onSubmit={handleResetPassword} className="space-y-4">
								<div className="space-y-2">
									<p className="text-zinc-400 text-start text-xs font-medium">
										6-Digit OTP Code
									</p>
									<div className="relative h-max">
										<Input
											placeholder="123456"
											className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
											type="text"
											required
											maxLength={6}
											value={otp}
											onChange={(e) => setOtp(e.target.value)}
										/>
										<div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-focus:text-indigo-400 transition-colors">
											<KeyIcon className="size-4" aria-hidden="true" />
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<p className="text-zinc-400 text-start text-xs font-medium">
										New Password
									</p>
									<div className="relative h-max">
										<Input
											placeholder="••••••••"
											className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
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
									<p className="text-zinc-400 text-start text-xs font-medium">
										Confirm New Password
									</p>
									<div className="relative h-max">
										<Input
											placeholder="••••••••"
											className="peer ps-9 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
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
									disabled={isLoading}
									className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-medium shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
								>
									<span>{isLoading ? 'Resetting Password...' : 'Reset Password'}</span>
								</Button>

								<Button 
									type="button" 
									variant="ghost"
									className="w-full text-zinc-400 hover:text-white cursor-pointer"
									onClick={() => {
										setMessage(null);
										setFormState('forgot-request');
									}}
								>
									Back to OTP Request
								</Button>
							</form>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}

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
