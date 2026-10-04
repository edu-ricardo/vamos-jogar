import PocketBase from 'pocketbase/cjs';

const pocketBaseUrl = () => process.env.PB_URL || 'http://pocketbase:8090';

const newClient = () => {
  const pb = new PocketBase(pocketBaseUrl());
  pb.autoCancellation(false);
  return pb;
};

let adminClient: Promise<PocketBase> | undefined;

// Cliente com permissão de superusuário, para o que nenhuma regra de usuário permite
// (entrar por convite, lembretes, exclusão de conta). O SDK renova o token sozinho.
export const getAdminClient = (): Promise<PocketBase> => {
  adminClient ??= (async () => {
    const pb = newClient();
    await pb
      .collection('_superusers')
      .authWithPassword(process.env.PB_SUPERUSER_EMAIL!, process.env.PB_SUPERUSER_PASSWORD!, {
        autoRefreshThreshold: 30 * 60,
      });
    return pb;
  })().catch((err) => {
    adminClient = undefined; // tenta de novo na próxima requisição
    throw err;
  });
  return adminClient;
};

// Cliente agindo como o usuário dono do token recebido pela API
export const createUserClient = (token: string): PocketBase => {
  const pb = newClient();
  pb.authStore.save(token);
  return pb;
};
