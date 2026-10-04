import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { serializeValue, summarizeBackup } from './exportData';

describe('serializeValue', () => {
  it('converte Timestamp em ISO, inclusive dentro de objetos e listas', () => {
    const ts = Timestamp.fromDate(new Date('2026-10-03T12:00:00Z'));
    expect(serializeValue({ createdAt: ts, list: [ts], name: 'Catan', players: 4 })).toEqual({
      createdAt: { __type: 'timestamp', value: '2026-10-03T12:00:00.000Z' },
      list: [{ __type: 'timestamp', value: '2026-10-03T12:00:00.000Z' }],
      name: 'Catan',
      players: 4,
    });
  });

  it('mantém null e valores simples', () => {
    expect(serializeValue({ a: null, b: true, c: 'x' })).toEqual({ a: null, b: true, c: 'x' });
  });
});

describe('summarizeBackup', () => {
  it('conta documentos por coleção e jogos por usuário, ignorando documentos vazios', () => {
    const summary = summarizeBackup([
      { path: 'users/bia', exists: false, data: null },
      { path: 'users/bia/collection/ludo-1', exists: true, data: {} },
      { path: 'users/bia/collection/bgg-2', exists: true, data: {} },
      { path: 'users/caio/collection/ludo-1', exists: true, data: {} },
      { path: 'users/bia/favoriteLocations/f1', exists: true, data: {} },
      { path: 'groups/g1', exists: true, data: {} },
      { path: 'groups/g1/events/e1', exists: true, data: {} },
    ]);

    expect(summary.collections).toEqual({
      'users/*/collection': 3,
      'users/*/favoriteLocations': 1,
      groups: 1,
      'groups/*/events': 1,
    });
    expect(summary.gamesByUser).toEqual({ bia: 2, caio: 1 });
  });
});
