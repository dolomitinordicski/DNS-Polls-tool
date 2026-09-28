import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'react-example';

if (!getApps().length) {
  try {
    initializeApp({
      projectId,
    });
  } catch (e) {
    console.warn('Firebase admin initialization skipped or failed:', e);
  }
}

export const adminAuth = getApps().length ? getAuth() : null;
