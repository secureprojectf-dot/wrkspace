/**
 * Client Firebase config — env only (never hardcode API keys in git).
 * Set NEXT_PUBLIC_FIREBASE_* in Vercel / .env
 */
export type FirebasePublicConfig = {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
};

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
	const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();
	const authDomain = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim();
	const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
	const storageBucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim();
	const messagingSenderId = (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '').trim();
	const appId = (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '').trim();

	if (!apiKey || !projectId || !appId) return null;

	return {
		apiKey,
		authDomain: authDomain || `${projectId}.firebaseapp.com`,
		projectId,
		storageBucket: storageBucket || `${projectId}.firebasestorage.app`,
		messagingSenderId,
		appId,
	};
}
