'use client';

import React, { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { XIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { Button } from './button';

async function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

/** Export square JPEG from crop pixels. */
export async function getCroppedDataUrl(
	imageSrc: string,
	pixelCrop: Area,
	outSize = 512,
	quality = 0.85,
): Promise<string> {
	const image = await loadImage(imageSrc);
	const canvas = document.createElement('canvas');
	canvas.width = outSize;
	canvas.height = outSize;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not crop image');
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(
		image,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		outSize,
		outSize,
	);
	return canvas.toDataURL('image/jpeg', quality);
}

type Props = {
	imageSrc: string;
	busy?: boolean;
	onCancel: () => void;
	onConfirm: (dataUrl: string) => void;
};

export function PhotoCropDialog({ imageSrc, busy, onCancel, onConfirm }: Props) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [working, setWorking] = useState(false);

	const onCropComplete = useCallback((_: Area, pixels: Area) => {
		setCroppedAreaPixels(pixels);
	}, []);

	const confirm = async () => {
		if (!croppedAreaPixels || working || busy) return;
		setWorking(true);
		try {
			const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels);
			onConfirm(dataUrl);
		} catch {
			setWorking(false);
		}
	};

	const disabled = busy || working;

	return (
		<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-6">
			<div className="w-full max-w-lg bg-zinc-950 border border-zinc-700 shadow-2xl flex flex-col max-h-[92vh]">
				<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
					<div>
						<p className="text-sm font-bold text-white">Edit photo</p>
						<p className="text-[11px] text-zinc-500 font-medium">Drag to position · pinch / slider to zoom</p>
					</div>
					<button
						type="button"
						onClick={onCancel}
						disabled={disabled}
						className="text-zinc-400 hover:text-white cursor-pointer p-1 disabled:opacity-40"
					>
						<XIcon className="size-4" />
					</button>
				</div>

				<div className="relative w-full aspect-square bg-black shrink-0">
					<Cropper
						image={imageSrc}
						crop={crop}
						zoom={zoom}
						aspect={1}
						cropShape="rect"
						showGrid
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={onCropComplete}
						objectFit="contain"
						style={{
							containerStyle: { background: '#09090b' },
							cropAreaStyle: { border: '2px solid #818cf8' },
						}}
					/>
				</div>

				<div className="px-4 py-4 space-y-4 border-t border-zinc-800 shrink-0">
					<div className="flex items-center gap-3">
						<button
							type="button"
							disabled={disabled || zoom <= 1}
							onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
							className="text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer p-1"
							aria-label="Zoom out"
						>
							<ZoomOutIcon className="size-5" />
						</button>
						<input
							type="range"
							min={1}
							max={3}
							step={0.01}
							value={zoom}
							disabled={disabled}
							onChange={(e) => setZoom(Number(e.target.value))}
							className="flex-1 accent-indigo-500 cursor-pointer"
						/>
						<button
							type="button"
							disabled={disabled || zoom >= 3}
							onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
							className="text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer p-1"
							aria-label="Zoom in"
						>
							<ZoomInIcon className="size-5" />
						</button>
						<span className="text-xs font-mono text-zinc-400 w-12 text-right">{zoom.toFixed(1)}x</span>
					</div>

					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={disabled}
							onClick={onCancel}
							className="flex-1 h-10 border-zinc-700 text-zinc-200 hover:bg-zinc-900 cursor-pointer rounded-none"
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={disabled || !croppedAreaPixels}
							onClick={() => void confirm()}
							className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer rounded-none"
						>
							{disabled ? 'Saving…' : 'Use photo'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
