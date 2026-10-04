import { describe, it } from 'vitest';
import PocketBase from 'pocketbase';
import { createPocketBaseGroupRepository } from '../apps/web/src/services/pocketbase/groupRepository';
import { createPocketBaseEventRepository } from '../apps/web/src/services/pocketbase/eventRepository';
import { createPocketBaseLudotecaRepository } from '../apps/web/src/services/pocketbase/ludotecaRepository';
import { defineRepositoryContract, type ContractSession } from './contract/repositoryContract';

// PocketBase real (container com as migrations do projeto), com as regras de acesso ativas.
// Rodado por "npm run test:pocketbase", que sobe o container e define as variáveis abaixo.
const url = process.env.PB_TEST_URL;
const superuser = {
  email: process.env.PB_TEST_ADMIN_EMAIL!,
  password: process.env.PB_TEST_ADMIN_PASSWORD!,
};
const PASSWORD = 'senha-de-teste-123';
const COLLECTIONS_IN_DELETE_ORDER = [
  'votes',
  'event_games',
  'events',
  'memberships',
  'groups',
  'games',
  'favorite_locations',
  'users',
];

const client = () => {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  return pb;
};

const admin = client();

if (url) {
  defineRepositoryContract('PocketBase', {
    start: async () => {
      await admin.collection('_superusers').authWithPassword(superuser.email, superuser.password);
    },
    stop: async () => {},
    freshSession: async (): Promise<ContractSession> => {
      for (const name of COLLECTIONS_IN_DELETE_ORDER) {
        for (const record of await admin.collection(name).getFullList({ fields: 'id' })) {
          await admin.collection(name).delete(record.id);
        }
      }

      const sessions = {} as Record<'ana' | 'bia' | 'caio', PocketBase>;
      const ids = {} as ContractSession['ids'];
      for (const person of ['ana', 'bia', 'caio'] as const) {
        const email = `${person}@vamosjogar.test`;
        const user = await admin
          .collection('users')
          .create({ email, password: PASSWORD, passwordConfirm: PASSWORD, name: person });
        ids[person] = user.id;
        sessions[person] = client();
        await sessions[person].collection('users').authWithPassword(email, PASSWORD);
      }

      return {
        ids,
        groupsAs: (person) => createPocketBaseGroupRepository(sessions[person]),
        eventsAs: (person) => createPocketBaseEventRepository(sessions[person]),
        ludotecaAs: (person) => createPocketBaseLudotecaRepository(sessions[person]),
        joinAsMember: async (groupId, person, nickname) => {
          await admin
            .collection('memberships')
            .create({ group: groupId, user: ids[person], nickname });
        },
      };
    },
  });
} else {
  describe.skip('Contrato dos repositórios: PocketBase (rode com npm run test:pocketbase)', () => {
    it('precisa do container do PocketBase', () => {});
  });
}
