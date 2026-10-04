import {
  CollectionReference,
  DocumentReference,
  Firestore,
  GeoPoint,
  Timestamp,
} from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

export interface ExportedDoc {
  path: string;
  // false para documentos que só existem como pai de subcoleções (ex.: users/{uid} da ludoteca)
  exists: boolean;
  data: Record<string, unknown> | null;
}

export interface ExportedUser {
  uid: string;
  email?: string;
  displayName?: string;
  emailVerified: boolean;
  disabled: boolean;
  providers: string[];
  // Id da conta em cada provedor (ex.: google.com): liga o login Google à conta migrada
  providerData: { providerId: string; uid: string }[];
  createdAt?: string;
  lastSignInAt?: string;
}

// Converte tipos do Firestore em JSON que o script de importação consegue reconstruir
export const serializeValue = (value: unknown): unknown => {
  if (value instanceof Timestamp)
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  if (value instanceof DocumentReference) return { __type: 'reference', path: value.path };
  if (value instanceof GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, serializeValue(v)]));
  }
  return value;
};

const exportCollection = async (collection: CollectionReference, out: ExportedDoc[]) => {
  // listDocuments inclui documentos inexistentes que têm subcoleções; um get() comum os ignora
  const refs = await collection.listDocuments();
  for (const ref of refs) {
    const snapshot = await ref.get();
    out.push({
      path: ref.path,
      exists: snapshot.exists,
      data: snapshot.exists ? (serializeValue(snapshot.data()) as Record<string, unknown>) : null,
    });
    for (const sub of await ref.listCollections()) {
      await exportCollection(sub, out);
    }
  }
};

export const exportFirestore = async (db: Firestore): Promise<ExportedDoc[]> => {
  const out: ExportedDoc[] = [];
  for (const collection of await db.listCollections()) {
    await exportCollection(collection, out);
  }
  return out;
};

export const exportAuthUsers = async (auth: Auth): Promise<ExportedUser[]> => {
  const users: ExportedUser[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      users.push({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        providers: user.providerData.map((p) => p.providerId),
        providerData: user.providerData.map((p) => ({ providerId: p.providerId, uid: p.uid })),
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
};

export interface BackupSummary {
  // Caminho com ids trocados por * (ex.: groups/*/events) -> quantidade de documentos existentes
  collections: Record<string, number>;
  // uid -> quantidade de jogos na ludoteca
  gamesByUser: Record<string, number>;
}

export const summarizeBackup = (docs: ExportedDoc[]): BackupSummary => {
  const collections: Record<string, number> = {};
  const gamesByUser: Record<string, number> = {};

  for (const doc of docs.filter((d) => d.exists)) {
    const segments = doc.path.split('/');
    const shape = segments.filter((_, i) => i % 2 === 0).join('/*/');
    collections[shape] = (collections[shape] || 0) + 1;

    if (segments[0] === 'users' && segments[2] === 'collection') {
      gamesByUser[segments[1]] = (gamesByUser[segments[1]] || 0) + 1;
    }
  }

  return { collections, gamesByUser };
};
