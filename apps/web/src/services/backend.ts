import { getFirebase } from '../lib/firebase';
import { getPocketBase } from '../lib/pocketbase';
import type { AuthGateway } from './authService';
import type { EventRepository } from './eventService';
import type { GroupRepository } from './groupService';
import type { LudotecaRepository } from './ludotecaService';
import { createFirebaseAuthGateway } from './firebase/authGateway';
import { createFirebaseEventRepository } from './firebase/eventRepository';
import { createFirebaseGroupRepository } from './firebase/groupRepository';
import { createFirebaseLudotecaRepository } from './firebase/ludotecaRepository';
import { createPocketBaseAuthGateway } from './pocketbase/authGateway';
import { createPocketBaseEventRepository } from './pocketbase/eventRepository';
import { createPocketBaseGroupRepository } from './pocketbase/groupRepository';
import { createPocketBaseLudotecaRepository } from './pocketbase/ludotecaRepository';

interface Backend {
  auth: AuthGateway;
  groups: GroupRepository;
  events: EventRepository;
  ludoteca: LudotecaRepository;
}

const createFirebaseBackend = (): Backend => {
  const { auth, db } = getFirebase();
  return {
    auth: createFirebaseAuthGateway(auth),
    groups: createFirebaseGroupRepository(db),
    events: createFirebaseEventRepository(db),
    ludoteca: createFirebaseLudotecaRepository(db),
  };
};

const createPocketBaseBackend = (): Backend => {
  const pb = getPocketBase();
  return {
    auth: createPocketBaseAuthGateway(pb),
    groups: createPocketBaseGroupRepository(pb),
    events: createPocketBaseEventRepository(pb),
    ludoteca: createPocketBaseLudotecaRepository(pb),
  };
};

// Único ponto que escolhe o backend; durante a migração o mesmo código roda nos dois
export const backend: Backend =
  import.meta.env.VITE_BACKEND === 'pocketbase'
    ? createPocketBaseBackend()
    : createFirebaseBackend();
