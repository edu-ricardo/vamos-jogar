import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: 'vamos-jogar-31b9b'
    });
  } else {
    initializeApp({
      projectId: 'vamos-jogar-31b9b'
    });
  }
} catch (e) {
  console.error('Erro ao inicializar Firebase Admin:', e);
}

export const db = getFirestore();
export const auth = getAuth();
