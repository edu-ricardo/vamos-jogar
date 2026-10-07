// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { eventService } from '../services/eventService';
import { groupService } from '../services/groupService';
import { ludotecaService } from '../services/ludotecaService';
import { EventDetails } from './EventDetails';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/eventService', () => ({
  eventService: {
    getEventDetails: vi.fn(),
    fetchFavoriteLocations: vi.fn(),
    voteDateLocation: vi.fn(),
    advanceToGamesVoting: vi.fn(),
    voteGames: vi.fn(),
    confirmEvent: vi.fn(),
    deleteEvent: vi.fn(),
    forceReminders: vi.fn(),
  },
}));
vi.mock('../services/groupService', () => ({
  groupService: { fetchGroupDetails: vi.fn(), fetchGroupMembers: vi.fn() },
}));
vi.mock('../services/ludotecaService', () => ({
  ludotecaService: { fetchUserCollection: vi.fn() },
}));

const members = [
  { id: 'u-edu', name: 'Edu' },
  { id: 'u-bia', name: 'Bia' },
  { id: 'u-caio', name: 'Caio' },
];

const dateEvent = (overrides = {}) => ({
  id: 'e1',
  groupId: 'g1',
  creatorId: 'u-edu',
  title: 'Jogatina de aniversário',
  status: 'VOTING_DATE',
  dateOptions: [
    { id: 'd1', date: '2026-10-10', startTime: '19:00', endTime: '23:00' },
    { id: 'd2', date: '2026-10-11', startTime: '14:00' },
  ],
  locationOptions: [
    { id: 'l1', name: 'Casa do Edu', address: 'Rua das Flores, 100' },
    { id: 'l2', name: 'Ludoteca Café', address: 'Av. Paulista, 1000' },
  ],
  votesDate: { 'u-bia': 'd1', 'u-caio': 'd1' },
  votesLocation: { 'u-bia': 'l2' },
  createdAt: '',
  ...overrides,
});

const gamesEvent = (overrides = {}) =>
  dateEvent({
    status: 'VOTING_GAMES',
    finalDateId: 'd2',
    finalLocationId: 'l1',
    gameOptions: [
      { id: 'g-catan', name: 'Catan', thumb: '', suggesterId: 'u-edu', suggesterName: 'Edu' },
      { id: 'g-azul', name: 'Azul', thumb: '', suggesterId: 'u-bia', suggesterName: 'Bia' },
    ],
    votesGames: { 'u-bia': ['g-catan'], 'u-caio': ['g-catan', 'g-azul'] },
    ...overrides,
  });

const open = async (event: unknown, adminId = 'u-ana') => {
  vi.mocked(eventService.getEventDetails).mockResolvedValue(event as never);
  vi.mocked(groupService.fetchGroupDetails).mockResolvedValue({
    id: 'g1',
    name: 'Sexta',
    adminId,
    inviteToken: 't',
  });
  renderPage(<EventDetails />, {
    path: '/event/:groupId/:eventId',
    route: '/event/g1/e1',
  });
  return screen.findByRole('heading', { level: 1 });
};

describe('Evento — votação de data e local', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
  });

  it('mostra título, etapa, votos por opção e quem já votou', async () => {
    expect((await open(dateEvent())).textContent).toBe('Jogatina de aniversário');
    expect(screen.getByText('Votando data e local')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Votaram 2 de 3' })).toBeTruthy();
    const voters = within(screen.getByRole('heading', { name: /Votaram/ }).closest('section')!);
    expect(voters.getAllByText('✓ votou')).toHaveLength(2);
    expect(voters.getAllByText('pendente')).toHaveLength(1);

    // 2 votos em 10/10, 0 em 11/10; 1 voto em Ludoteca Café
    expect(screen.getAllByTitle('2 voto(s)')).toHaveLength(1);
    expect(screen.getAllByTitle('1 voto(s)')).toHaveLength(1);
    expect(screen.getAllByTitle('0 voto(s)')).toHaveLength(2);
  });

  it('vota na data e no local escolhidos', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByLabelText(/11\/10\/2026/));
    await user.click(screen.getByLabelText(/Casa do Edu/));
    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    expect(eventService.voteDateLocation).toHaveBeenCalledWith('g1', 'e1', 'u-edu', 'd2', 'l1');
    expect(toast.success).toHaveBeenCalledWith('Seu voto foi registrado!');
  });

  it('exige data e local para votar', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    expect(eventService.voteDateLocation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Escolha uma data e um local para votar.');
  });

  it('quem já votou vê o voto marcado e o botão "Atualizar voto"', async () => {
    resetAuth();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    await open(dateEvent({ votesDate: { 'u-edu': 'd2' }, votesLocation: { 'u-edu': 'l1' } }));

    expect((screen.getByLabelText(/11\/10\/2026/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Atualizar voto' })).toBeTruthy();
  });

  it('o criador fecha a etapa: pede confirmação e avança com as opções marcadas', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    expect(toast.error).toHaveBeenCalledWith(
      'Você precisa selecionar uma Data e um Local para definir como vencedores.',
    );

    await user.click(screen.getByLabelText(/10\/10\/2026/));
    await user.click(screen.getByLabelText(/Ludoteca Café/));
    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    expect(eventService.advanceToGamesVoting).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar e ir para jogos' }));
    expect(eventService.advanceToGamesVoting).toHaveBeenCalledWith('g1', 'e1', 'd1', 'l2');
  });

  it('o criador também pode excluir, só depois de confirmar', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: /Excluir evento/ }));
    expect(eventService.deleteEvent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sim, excluir' }));

    expect(eventService.deleteEvent).toHaveBeenCalledWith('g1', 'e1');
  });

  it('o admin do grupo também gerencia o evento de outra pessoa', async () => {
    await open(dateEvent({ creatorId: 'u-bia' }), 'u-edu');
    expect(screen.getByRole('button', { name: /Cravar vencedores/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cobrar quem não votou/ })).toBeTruthy();
  });

  it('quem não é criador nem admin não vê as ações de organizador', async () => {
    await open(dateEvent({ creatorId: 'u-bia' }), 'u-ana');

    expect(screen.queryByRole('button', { name: /Cravar vencedores/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Excluir evento/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar evento/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cobrar quem não votou/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Copiar resumo/ })).toBeTruthy();
  });
});

describe('Evento — votação de jogos e confirmado', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(ludotecaService.fetchUserCollection).mockResolvedValue([]);
  });

  it('mostra data e local definidos, as sugestões e a contagem de votos', async () => {
    await open(gamesEvent());

    expect(screen.getByText('11/10/2026 às 14:00')).toBeTruthy();
    expect(screen.getByText(/Casa do Edu \(Rua das Flores, 100\)/)).toBeTruthy();
    expect(screen.getByText('Sugerido por Bia')).toBeTruthy();
    // Catan: 2 votos, Azul: 1 voto
    expect(screen.getByTitle('2 voto(s)')).toBeTruthy();
    expect(screen.getByTitle('1 voto(s)')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Votaram 2 de 3' })).toBeTruthy();
  });

  it('vota nos jogos marcados', async () => {
    const user = userEvent.setup();
    await open(gamesEvent());

    await user.click(screen.getByLabelText(/Azul/));
    await user.click(screen.getByRole('button', { name: 'Confirmar votos' }));

    expect(eventService.voteGames).toHaveBeenCalledWith('g1', 'e1', 'u-edu', ['g-azul']);
  });

  it('o organizador encerra: vem pré-marcado o que teve voto e confirma a mesa', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: { 'u-bia': ['g-catan'] } }));

    await user.click(screen.getByRole('button', { name: /Encerrar votação de jogos/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect((dialog.getByLabelText(/Catan/) as HTMLInputElement).checked).toBe(true);
    expect((dialog.getByLabelText(/Azul/) as HTMLInputElement).checked).toBe(false);

    await user.click(dialog.getByRole('button', { name: 'Confirmar jogatina' }));
    expect(eventService.confirmEvent).toHaveBeenCalledWith('g1', 'e1', ['g-catan']);
  });

  it('não confirma a mesa sem nenhum jogo', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: {} }));

    await user.click(screen.getByRole('button', { name: /Encerrar votação de jogos/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar jogatina' }),
    );

    expect(eventService.confirmEvent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Selecione pelo menos um jogo para a mesa.');
  });

  it('evento confirmado lista só os jogos da mesa e não abre mais votação', async () => {
    await open(gamesEvent({ status: 'CONFIRMED', finalGameIds: ['g-azul'] }));

    expect(screen.getByRole('heading', { name: 'Jogos da mesa' })).toBeTruthy();
    expect(screen.getByText('Leva: Bia')).toBeTruthy();
    expect(screen.queryByText('Catan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar votos' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cobrar quem não votou/ })).toBeNull();
  });
});
