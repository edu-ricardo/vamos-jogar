import type PocketBase from 'pocketbase/cjs';

export interface AuthenticatedUser {
  uid: string;
  name: string;
  email: string;
}

// Valida o token do usuário no próprio PocketBase (forma indicada na documentação dele)
export const verifyUserToken = async (userClient: PocketBase): Promise<AuthenticatedUser> => {
  const { record } = await userClient.collection('users').authRefresh();
  return { uid: record.id, name: record.name || '', email: record.email || '' };
};
