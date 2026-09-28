import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const defaultFirebaseConfig = {
  apiKey: 'mock-key',
  authDomain: 'mock.firebaseapp.com',
  projectId: 'react-example',
  storageBucket: 'mock.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

const app = getApps().length ? getApps()[0] : initializeApp(defaultFirebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
