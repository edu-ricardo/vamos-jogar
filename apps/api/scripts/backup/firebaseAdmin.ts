import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import { parseServiceAccount } from './serviceAccount';
dotenv.config();

// Sem credencial explícita, o SDK usa GOOGLE_APPLICATION_CREDENTIALS. Credencial inválida
// interrompe a API na hora, com a causa no log, em vez de falhar depois com erro genérico.
const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({
  ...(serviceAccount && { credential: cert(serviceAccount) }),
  projectId: 'vamos-jogar-31b9b',
});

export const db = getFirestore();
export const auth = getAuth();
