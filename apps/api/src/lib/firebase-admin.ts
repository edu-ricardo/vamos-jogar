import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

try {
  initializeApp({
    projectId: 'vamos-jogar-31b9b'
  });
} catch (e) {}

export const db = getFirestore();
export const auth = getAuth();
