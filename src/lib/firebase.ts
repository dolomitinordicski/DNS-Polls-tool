import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDyiW7bDb2xbTwhYhu3OU3zuaPhc7WFzAg').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dns-polls.firebaseapp.com').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dns-polls').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dns-polls.firebasestorage.app').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '906526175735').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '1:906526175735:web:3682da4a70bb35031b3ef2').trim(),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = isFirebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;

export const db = app
  ? initializeFirestore(app, {
      // Auto-detect transports that block Firestore WebChannel and switch to
      // long polling when needed. This is more reliable behind proxies,
      // privacy tools and restrictive browser/network configurations.
      experimentalAutoDetectLongPolling: true,
    })
  : null;
export const auth = app ? getAuth(app) : null;
export const googleAuthProvider = new GoogleAuthProvider();
