import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GroupRepository } from '../../apps/web/src/services/groupService';
import type { EventRepository } from '../../apps/web/src/services/eventService';
import type { LudotecaRepository } from '../../apps/web/src/services/ludotecaService';

type Person = 'ana' | 'bia' | 'caio';

// Banco limpo com três pessoas; cada repositório age em nome de uma delas
export interface ContractSession {
  ids: Record<Person, string>;
  groupsAs(person: Person): GroupRepository;
  eventsAs(person: Person): EventRepository;
  ludotecaAs(person: Person): LudotecaRepository;
  // Entrar por convite é feito pela API com permissão de administrador
  joinAsMember(groupId: string, person: Person, nickname: string): Promise<void>;
}

export interface ContractBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  freshSession(): Promise<ContractSession>;
}

// O mesmo roteiro roda no Firebase (emulador) e no PocketBase: se passar nos dois, a troca é segura
export const defineRepositoryContract = (name: string, backend: ContractBackend) =>
  describe(`Contrato dos repositórios: ${name}`, () => {
    let s: ContractSession;

    beforeAll(() => backend.start());
    afterAll(() => backend.stop());
    beforeEach(async () => {
      s = await backend.freshSession();
    });

    const createGroupWithMembers = async () => {
      await s.groupsAs('ana').createGroup(s.ids.ana, 'Jogatina de Sexta', 'Ana');
      const [group] = await s.groupsAs('ana').fetchUserGroups(s.ids.ana);
      await s.joinAsMember(group.id, 'bia', 'Bia');
      await s.joinAsMember(group.id, 'caio', 'Caio');
      return group;
    };

    describe('GroupRepository', () => {
      it('cria grupo com quem criou como admin e membro', async () => {
        const group = await createGroupWithMembers();

        expect(group).toMatchObject({ name: 'Jogatina de Sexta', adminId: s.ids.ana });
        expect(group.inviteToken).toMatch(/^[0-9a-f-]{36}$/);
        expect(await s.groupsAs('bia').fetchGroupDetails(group.id)).toMatchObject({ id: group.id });
        expect((await s.groupsAs('bia').fetchUserGroups(s.ids.bia)).map((g) => g.id)).toEqual([
          group.id,
        ]);
      });

      it('lista membros, atualiza apelido e admin remove membro', async () => {
        const group = await createGroupWithMembers();

        await s.groupsAs('bia').updateMemberName(group.id, s.ids.bia, 'Bia Boardgamer');
        await s.groupsAs('ana').removeMember(group.id, s.ids.caio);

        const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
        const members = await s.groupsAs('ana').fetchGroupMembers(group.id);
        expect(members.sort(byId)).toEqual(
          [
            { id: s.ids.ana, name: 'Ana' },
            { id: s.ids.bia, name: 'Bia Boardgamer' },
          ].sort(byId),
        );
        expect(await s.groupsAs('caio').fetchUserGroups(s.ids.caio)).toEqual([]);
      });
    });

    describe('EventRepository', () => {
      const dates = [
        { id: 'd1', date: '2026-10-10', startTime: '19:00', endTime: '23:00' },
        { id: 'd2', date: '2026-10-11', startTime: '14:00', endTime: '' },
      ];
      const locations = [{ id: 'l1', name: 'Casa da Ana', address: 'Rua A, 1' }];

      it('percorre o fluxo completo: criar, votar, avançar, sugerir, votar jogos e confirmar', async () => {
        const group = await createGroupWithMembers();
        const { ana, bia, caio } = s.ids;
        const eventId = await s
          .eventsAs('bia')
          .createEvent(group.id, bia, 'Sexta', dates, locations);

        await s.eventsAs('ana').voteDateLocation(group.id, eventId, ana, ['d1'], 'l1');
        await s.eventsAs('caio').voteDateLocation(group.id, eventId, caio, ['d1', 'd2'], 'l1');
        await s.eventsAs('ana').advanceToGamesVoting(group.id, eventId, 'd1', 'l1');

        await s
          .eventsAs('caio')
          .suggestGames(group.id, eventId, [
            { id: 'ludo-1', name: 'Catan', thumb: '', suggesterId: caio, suggesterName: 'Caio' },
          ]);
        await s.eventsAs('bia').suggestGames(group.id, eventId, [
          { id: 'ludo-1', name: 'Catan', thumb: '', suggesterId: bia, suggesterName: 'Bia' },
          { id: 'bgg-2', name: 'Azul', thumb: '', suggesterId: bia, suggesterName: 'Bia' },
        ]);
        await s.eventsAs('ana').voteGames(group.id, eventId, ana, ['ludo-1', 'bgg-2']);
        await s.eventsAs('bia').confirmEvent(group.id, eventId, ['ludo-1']);

        const event = await s.eventsAs('caio').getEventDetails(group.id, eventId);
        expect(event).toMatchObject({
          groupId: group.id,
          creatorId: bia,
          status: 'CONFIRMED',
          finalDateId: 'd1',
          finalLocationId: 'l1',
          finalGameIds: ['ludo-1'],
          votesDate: { [ana]: ['d1'], [caio]: ['d1', 'd2'] },
          votesLocation: { [ana]: 'l1', [caio]: 'l1' },
          votesGames: { [ana]: ['ludo-1', 'bgg-2'] },
        });
        // Sugestão repetida não duplica e mantém quem sugeriu primeiro
        expect(event.gameOptions?.map((g) => [g.id, g.suggesterId])).toEqual([
          ['ludo-1', caio],
          ['bgg-2', bia],
        ]);
      });

      it('lista eventos do grupo do mais novo para o mais antigo', async () => {
        const group = await createGroupWithMembers();
        const first = await s
          .eventsAs('bia')
          .createEvent(group.id, s.ids.bia, 'Primeiro', dates, locations);
        const second = await s
          .eventsAs('caio')
          .createEvent(group.id, s.ids.caio, 'Segundo', dates, locations);

        const events = await s.eventsAs('ana').fetchGroupEvents(group.id);
        expect(events.map((e) => e.id)).toEqual([second, first]);
      });

      it('criador edita e o admin exclui o evento', async () => {
        const group = await createGroupWithMembers();
        const eventId = await s
          .eventsAs('bia')
          .createEvent(group.id, s.ids.bia, 'Rascunho', dates, locations);

        await s.eventsAs('bia').updateEvent(group.id, eventId, 'Sábado', [dates[1]], locations);
        expect(await s.eventsAs('caio').getEventDetails(group.id, eventId)).toMatchObject({
          title: 'Sábado',
          dateOptions: [dates[1]],
        });

        await s.eventsAs('ana').deleteEvent(group.id, eventId);
        expect(await s.eventsAs('ana').fetchGroupEvents(group.id)).toEqual([]);
      });

      it('salva e lista locais favoritos do próprio usuário', async () => {
        await s
          .eventsAs('ana')
          .saveFavoriteLocation(s.ids.ana, { name: 'Casa', address: 'Rua A, 1' });
        const favorites = await s.eventsAs('ana').fetchFavoriteLocations(s.ids.ana);
        expect(favorites).toMatchObject([{ name: 'Casa', address: 'Rua A, 1' }]);
        expect(favorites[0].id).toBeTruthy();
      });
    });

    describe('LudotecaRepository', () => {
      it('adiciona, edita, lista e remove jogos; outros usuários conseguem ver', async () => {
        const catan = {
          id: 'ludo-1',
          sourceId: '1',
          name: 'Catan',
          image: 'catan.jpg',
          playtime: '90',
          minPlayers: 3,
          maxPlayers: 4,
          observation: 'Edição 2015',
          expansions: [{ id: 'ludo-9', sourceId: '9', name: 'Marinheiros', image: '' }],
        };

        await s.ludotecaAs('bia').addGameToCollection(s.ids.bia, catan);
        await s
          .ludotecaAs('bia')
          .addGameToCollection(s.ids.bia, { ...catan, observation: 'Falta 1 peça' });
        expect(await s.ludotecaAs('caio').fetchUserCollection(s.ids.bia)).toEqual([
          { ...catan, observation: 'Falta 1 peça' },
        ]);

        await s.ludotecaAs('bia').removeGameFromCollection(s.ids.bia, 'ludo-1');
        expect(await s.ludotecaAs('bia').fetchUserCollection(s.ids.bia)).toEqual([]);
      });

      // A tela da Ludoteca envia minPlayers/maxPlayers como undefined quando o campo fica vazio
      it('aceita jogo sem número de jogadores', async () => {
        await s.ludotecaAs('bia').addGameToCollection(s.ids.bia, {
          id: 'bgg-2',
          sourceId: '2',
          name: 'Azul',
          image: '',
          playtime: '45',
          minPlayers: undefined,
          maxPlayers: undefined,
          observation: '',
        });
        expect(await s.ludotecaAs('bia').fetchUserCollection(s.ids.bia)).toHaveLength(1);
      });
    });
  });
