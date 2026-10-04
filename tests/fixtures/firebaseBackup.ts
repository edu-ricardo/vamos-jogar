import type { ExportedDoc, ExportedUser } from '../../apps/api/scripts/backup/exportData';

// Backup no mesmo formato do "npm run backup", com os casos difíceis da produção:
// ludoteca sem documento users/{uid}, membro que já excluiu a conta, números como texto,
// datas serializadas, jogo sugerido por quem saiu e campos ausentes.
const ts = (iso: string) => ({ __type: 'timestamp', value: iso });

export const backupUsers: ExportedUser[] = [
  {
    uid: 'fb-ana',
    email: 'ana@exemplo.test',
    displayName: 'Ana',
    emailVerified: true,
    disabled: false,
    providers: ['google.com'],
    providerData: [{ providerId: 'google.com', uid: 'google-111' }],
  },
  {
    uid: 'fb-bia',
    email: 'bia@exemplo.test',
    displayName: 'Bia',
    emailVerified: true,
    disabled: false,
    providers: ['google.com'],
    providerData: [{ providerId: 'google.com', uid: 'google-222' }],
  },
  {
    uid: 'fb-caio',
    email: 'caio@exemplo.test',
    displayName: undefined,
    emailVerified: true,
    disabled: false,
    providers: ['google.com'],
    providerData: [{ providerId: 'google.com', uid: 'google-333' }],
  },
];

const catan = {
  id: 'ludo-1',
  sourceId: 1,
  name: 'Catan',
  image: 'https://img/catan.jpg',
  description: '<p>Troca de recursos</p>',
  playtime: '90',
  minPlayers: 3,
  maxPlayers: '4',
  observation: 'Edição 2015',
  expansions: [{ id: 'ludo-9', sourceId: 9, name: 'Marinheiros', image: '' }],
};

export const backupDocuments: ExportedDoc[] = [
  { path: 'users/fb-ana', exists: false, data: null },
  { path: 'users/fb-ana/collection/ludo-1', exists: true, data: catan },
  {
    path: 'users/fb-ana/collection/bgg-2',
    exists: true,
    data: { id: 'bgg-2', sourceId: '2', name: 'Azul', image: '', playtime: 'N/A' },
  },
  { path: 'users/fb-bia', exists: false, data: null },
  { path: 'users/fb-bia/collection/ludo-1', exists: true, data: { ...catan, observation: '' } },
  {
    path: 'users/fb-bia/favoriteLocations/f1',
    exists: true,
    data: { name: 'Casa da Bia', address: 'Rua B, 2' },
  },

  {
    path: 'groups/g1',
    exists: true,
    data: {
      name: 'Jogatina de Sexta',
      adminId: 'fb-ana',
      // fb-dani excluiu a conta antes da migração
      members: ['fb-ana', 'fb-bia', 'fb-dani', 'fb-caio'],
      inviteToken: 'convite-g1',
      createdAt: ts('2026-05-01T10:00:00.000Z'),
    },
  },
  { path: 'groups/g1/members/fb-ana', exists: true, data: { name: 'Ana' } },
  { path: 'groups/g1/members/fb-bia', exists: true, data: { name: 'Bia Boardgamer' } },
  { path: 'groups/g1/members/fb-caio', exists: true, data: { name: 'Caio' } },
  {
    path: 'groups/g1/events/e-confirmado',
    exists: true,
    data: {
      groupId: 'g1',
      creatorId: 'fb-bia',
      title: 'Sexta de Catan',
      status: 'CONFIRMED',
      dateOptions: [{ id: 'd1', date: '2026-06-05', startTime: '19:00', endTime: '23:00' }],
      locationOptions: [{ id: 'l1', name: 'Casa da Bia', address: 'Rua B, 2' }],
      gameOptions: [
        {
          id: 'ludo-1',
          name: 'Catan',
          thumb: 't.jpg',
          suggesterId: 'fb-ana',
          suggesterName: 'Ana',
        },
        { id: 'bgg-7', name: 'Wingspan', thumb: '', suggesterId: 'fb-dani', suggesterName: 'Dani' },
      ],
      finalDateId: 'd1',
      finalLocationId: 'l1',
      finalGameIds: ['ludo-1'],
      votesDate: { 'fb-ana': 'd1', 'fb-bia': 'd1', 'fb-dani': 'd1' },
      votesLocation: { 'fb-ana': 'l1', 'fb-bia': 'l1' },
      votesGames: { 'fb-ana': ['ludo-1'], 'fb-caio': ['ludo-1', 'bgg-7'] },
      lastReminderSentAt: ts('2026-06-01T12:00:00.000Z'),
      createdAt: ts('2026-05-20T10:00:00.000Z'),
    },
  },
  {
    path: 'groups/g1/events/e-aberto',
    exists: true,
    data: {
      groupId: 'g1',
      creatorId: 'fb-dani',
      title: 'Próxima jogatina',
      status: 'VOTING_DATE',
      dateOptions: [
        { id: 'd1', date: '2026-11-07', startTime: '19:00', endTime: '' },
        { id: 'd2', date: '2026-11-08', startTime: '14:00' },
      ],
      locationOptions: [{ id: 'l1', name: 'Casa da Ana', address: 'Rua A, 1' }],
      gameOptions: [],
      votesDate: { 'fb-caio': 'd2' },
      votesLocation: { 'fb-caio': 'l1' },
      votesGames: {},
      createdAt: ts('2026-10-01T10:00:00.000Z'),
    },
  },
];
