import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, arrayUnion, type Firestore } from 'firebase/firestore';
import { createFirebaseGroupRepository } from '../apps/web/src/services/firebase/groupRepository';
import { createFirebaseEventRepository } from '../apps/web/src/services/firebase/eventRepository';
import { createFirebaseLudotecaRepository } from '../apps/web/src/services/firebase/ludotecaRepository';
import { defineRepositoryContract } from './contract/repositoryContract';

// Firebase no emulador, com as regras de produção ativas; o uid é o próprio nome da pessoa
let env: RulesTestEnvironment;
const dbAs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

defineRepositoryContract('Firebase', {
  start: async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-vamos-jogar-contract',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
    });
  },
  stop: () => env.cleanup(),
  freshSession: async () => {
    await env.clearFirestore();
    return {
      ids: { ana: 'ana', bia: 'bia', caio: 'caio' },
      groupsAs: (person) => createFirebaseGroupRepository(dbAs(person)),
      eventsAs: (person) => createFirebaseEventRepository(dbAs(person)),
      ludotecaAs: (person) => createFirebaseLudotecaRepository(dbAs(person)),
      joinAsMember: (groupId, person, nickname) =>
        env.withSecurityRulesDisabled(async (ctx) => {
          const db = ctx.firestore() as unknown as Firestore;
          await updateDoc(doc(db, 'groups', groupId), { members: arrayUnion(person) });
          await setDoc(doc(db, 'groups', groupId, 'members', person), { name: nickname });
        }),
    };
  },
});
