import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const DNS_CORE_APP_NAME = 'dns-core-design-system';

const dnsCoreConfig = {
  apiKey: 'AIzaSyAgxv6Z45-AfrusbFnCSyvYChRUBu6-vXc',
  authDomain: 'dns-core.firebaseapp.com',
  projectId: 'dns-core',
  storageBucket: 'dns-core.firebasestorage.app',
  messagingSenderId: '387653285986',
  appId: '1:387653285986:web:27ad6f2e9a41ea1aebb93b',
  measurementId: 'G-2G56PRYNME',
};

const dnsCoreApp =
  getApps().find(app => app.name === DNS_CORE_APP_NAME) ??
  initializeApp(dnsCoreConfig, DNS_CORE_APP_NAME);

export const dnsCoreDesignDb = getFirestore(dnsCoreApp);
