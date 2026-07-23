'use client';

import React, { useRef, useState } from 'react';
import { PencilIcon, CameraIcon, ImageIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateEmployeePhoto } from '@/app/admin/actions';
import { Button } from './button';
import { PhotoCropDialog } from './photo-crop-dialog';

type Props = {
	employeeId: string;
	photoUrl?: string | null;
	initials: string;
	size?: 'md' | 'lg';
	onUpdated?: (photoUrl: string | null) => void;
	className?: string;
};

export function ProfilePhotoEditor({
	employeeId,
	photoUrl,
	initials,
	size = 'lg',
	onUpdated,
	className,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [cropSrc, setCropSrc] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const hasPhoto = Boolean(photoUrl);

	const box = size === 'lg' ? 'size-20' : 'size-12';

	const save = async (dataUrl: string) => {
		setBusy(true);
		setErr(null);
		try {
			const res = await updateEmployeePhoto(employeeId, dataUrl);
			if (!res.success) {
				setErr(res.error || 'Upload failed');
				return;
			}
			onUpdated?.(res.employee.photoUrl ?? dataUrl);
			setPreviewOpen(false);
			setCropSrc(null);
		} catch {
			setErr('Upload failed');
		} finally {
			setBusy(false);
		}
	};

	const onFile = (file?: File | null) => {
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			setErr('Please choose an image file');
			return;
		}
		setErr(null);
		const url = URL.createObjectURL(file);
		setCropSrc(url);
	};

	const openPicker = () => inputRef.current?.click();

	const closeCrop = () => {
		if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
		setCropSrc(null);
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={(e) => {
					const f = e.target.files?.[0];
					e.target.value = '';
					onFile(f);
				}}
			/>

			<button
				type="button"
				disabled={busy}
				onClick={() => {
					if (hasPhoto) setPreviewOpen(true);
					else openPicker();
				}}
				className={cn(
					'relative shrink-0 overflow-hidden border border-brand-700/50 bg-brand-900/60 text-white font-black tracking-wider shadow-lg shadow-brand-950/40',
					'rounded-none cursor-pointer hover:opacity-95 transition-opacity disabled:opacity-60',
					box,
					className,
				)}
				aria-label={hasPhoto ? 'View profile photo' : 'Upload profile photo'}
			>
				{hasPhoto ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={photoUrl!} alt="" className="absolute inset-0 size-full object-cover" />
				) : (
					<span className={size === 'lg' ? 'text-2xl' : 'text-sm'}>{initials}</span>
				)}
				{!hasPhoto && (
					<span className="absolute bottom-1 right-1 flex size-6 items-center justify-center bg-indigo-600 text-white shadow">
						<PencilIcon className="size-3.5" />
					</span>
				)}
				{busy && (
					<span className="absolute inset-0 flex items-center justify-center bg-black/50">
						<span className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
					</span>
				)}
			</button>

			{err && <p className="text-xs text-red-400 font-mono mt-1">{err}</p>}

			{cropSrc && (
				<PhotoCropDialog
					imageSrc={cropSrc}
					busy={busy}
					onCancel={closeCrop}
					onConfirm={(dataUrl) => {
						closeCrop();
						void save(dataUrl);
					}}
				/>
			)}

			{previewOpen && hasPhoto && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
					onClick={() => setPreviewOpen(false)}
				>
					<div
						className="w-full max-w-sm bg-zinc-950 border border-zinc-700 shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
							<p className="text-sm font-bold text-white">Profile photo</p>
							<button
								type="button"
								onClick={() => setPreviewOpen(false)}
								className="text-zinc-400 hover:text-white cursor-pointer p-1"
							>
								<XIcon className="size-4" />
							</button>
						</div>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={photoUrl!} alt="Profile" className="w-full aspect-square object-cover bg-zinc-900" />
						<div className="p-4 space-y-2">
							<Button
								type="button"
								disabled={busy}
								onClick={() => {
									setPreviewOpen(false);
									openPicker();
								}}
								className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer rounded-none"
							>
								<CameraIcon className="size-4 mr-2" />
								Change photo
							</Button>
							<button
								type="button"
								disabled={busy}
								onClick={() => {
									setPreviewOpen(false);
									openPicker();
								}}
								className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 cursor-pointer"
							>
								<ImageIcon className="size-3.5" />
								Choose from files
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
