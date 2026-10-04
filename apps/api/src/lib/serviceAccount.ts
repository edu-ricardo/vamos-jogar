import type { ServiceAccount } from 'firebase-admin/app';

// Credencial do Firebase Admin: JSON em FIREBASE_SERVICE_ACCOUNT_KEY (uma linha) ou, sem ela,
// o arquivo apontado por GOOGLE_APPLICATION_CREDENTIALS (lido pelo próprio SDK)
export const parseServiceAccount = (raw: string | undefined): ServiceAccount | undefined => {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido (precisa estar em uma única linha). ' +
        'Alternativa mais simples: deixe a variável vazia e aponte GOOGLE_APPLICATION_CREDENTIALS ' +
        `para o arquivo .json da conta de serviço. Detalhe: ${(err as Error).message}`,
    );
  }
};
