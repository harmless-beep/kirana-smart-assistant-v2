import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const requiredConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(requiredConfig).every(Boolean)
export const firebaseBackendEnabled = import.meta.env.VITE_BACKEND_MODE === 'firebase' && firebaseConfigured

const app = firebaseConfigured ? initializeApp(requiredConfig) : null

export const firebaseAuth = app ? getAuth(app) : null
export const firestore = app ? (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Browser privacy settings or an existing initialization may prevent
    // persistent IndexedDB caching. Firestore can still run in memory mode.
    return getFirestore(app)
  }
})() : null
