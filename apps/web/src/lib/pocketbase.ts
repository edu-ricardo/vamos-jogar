import PocketBase from 'pocketbase';

let pb: PocketBase | undefined;

// Sem a variável: mesmo endereço do site em /pb (o nginx repassa para o PocketBase)
export const getPocketBase = () => {
  if (!pb) {
    pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? '/pb');
    // O app faz chamadas paralelas à mesma coleção; o cancelamento automático do SDK as derrubaria
    pb.autoCancellation(false);
  }
  return pb;
};
