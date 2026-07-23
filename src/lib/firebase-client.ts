import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirebasePublicConfig } from '@/lib/firebase-public-config';

function appOrNull(): FirebaseApp | null {
	const config = getFirebasePublicConfig();
	if (!config) return null;
	return getApps().length ? getApp() : initializeApp(config);
}

const app = appOrNull();

export const firebaseAuth = app ? getAuth(app) : (null as any);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
