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
import { downloadIcs } from '../services/calendarFile';
import { deferred } from '../test/deferred';
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
    suggestGames: vi.fn(),
    notifyGroup: vi.fn(),
    getAttendance: vi.fn().mockResolvedValue([]),
    setAttendance: vi.fn(),
  },
}));
vi.mock('../services/groupService', () => ({
  groupService: { fetchGroupDetails: vi.fn(), fetchGroupMembers: vi.fn() },
}));
vi.mock('../services/ludotecaService', () => ({
  ludotecaService: { fetchUserCollection: vi.fn() },
}));
vi.mock('../services/calendarFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/calendarFile')>()),
  downloadIcs: vi.fn(),
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
  votesDate: { 'u-bia': ['d1'], 'u-caio': ['d1'] },
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

  it('vota em várias datas e em um local', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByLabelText(/10\/10\/2026/));
    await user.click(screen.getByLabelText(/11\/10\/2026/));
    await user.click(screen.getByLabelText(/Casa do Edu/));
    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    expect(eventService.voteDateLocation).toHaveBeenCalledWith(
      'g1',
      'e1',
      'u-edu',
      ['d1', 'd2'],
      'l1',
    );
    expect(toast.success).toHaveBeenCalledWith('Seu voto foi registrado!');
  });

  it('desmarcar uma data a tira do voto', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByLabelText(/10\/10\/2026/));
    await user.click(screen.getByLabelText(/11\/10\/2026/));
    await user.click(screen.getByLabelText(/10\/10\/2026/));
    await user.click(screen.getByLabelText(/Casa do Edu/));
    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    expect(vi.mocked(eventService.voteDateLocation).mock.calls[0][3]).toEqual(['d2']);
  });

  it('exige ao menos uma data e um local para votar', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));
    await user.click(screen.getByLabelText(/10\/10\/2026/));
    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    expect(eventService.voteDateLocation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenLastCalledWith(
      'Marque ao menos uma data e escolha um local para votar.',
    );
  });

  it('quem já votou vê as datas marcadas e o botão "Atualizar voto"', async () => {
    resetAuth();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    await open(
      dateEvent({ votesDate: { 'u-edu': ['d1', 'd2'] }, votesLocation: { 'u-edu': 'l1' } }),
    );

    expect((screen.getByLabelText(/10\/10\/2026/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/11\/10\/2026/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Atualizar voto' })).toBeTruthy();
  });

  it('data que o organizador removeu depois do voto não volta a ser marcada', async () => {
    const user = userEvent.setup();
    await open(
      dateEvent({ votesDate: { 'u-edu': ['d1', 'removida'] }, votesLocation: { 'u-edu': 'l1' } }),
    );

    await user.click(screen.getByRole('button', { name: 'Atualizar voto' }));

    expect(vi.mocked(eventService.voteDateLocation).mock.calls[0][3]).toEqual(['d1']);
  });

  it('cada data conta um voto por pessoa que a marcou', async () => {
    await open(
      dateEvent({
        votesDate: { 'u-bia': ['d1', 'd2'], 'u-caio': ['d1'] },
        votesLocation: {},
      }),
    );

    expect(screen.getAllByTitle('2 voto(s)')).toHaveLength(1);
    expect(screen.getAllByTitle('1 voto(s)')).toHaveLength(1);
  });

  it('destaca a opção líder (uma data e um local)', async () => {
    await open(dateEvent());

    // 10/10 lidera as datas e Ludoteca Café é o único local votado
    expect(screen.getAllByText('Líder')).toHaveLength(2);
    expect(screen.queryByText('Empate')).toBeNull();
  });

  it('em empate de datas marca "Empate" nas empatadas', async () => {
    await open(dateEvent({ votesDate: { 'u-bia': ['d1'], 'u-caio': ['d2'] } }));

    expect(screen.getAllByText('Empate')).toHaveLength(2);
  });

  it('sem nenhum voto ninguém é líder', async () => {
    await open(dateEvent({ votesDate: {}, votesLocation: {} }));

    expect(screen.queryByText('Líder')).toBeNull();
    expect(screen.queryByText('Empate')).toBeNull();
  });

  it('o organizador fecha a etapa numa janela já com os líderes marcados', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect((dialog.getByLabelText(/10\/10\/2026/) as HTMLInputElement).checked).toBe(true);
    expect((dialog.getByLabelText(/Ludoteca Café/) as HTMLInputElement).checked).toBe(true);
    expect(dialog.getByText('2 voto(s)')).toBeTruthy();
    expect(eventService.advanceToGamesVoting).not.toHaveBeenCalled();

    await user.click(dialog.getByRole('button', { name: 'Confirmar e ir para jogos' }));
    expect(eventService.advanceToGamesVoting).toHaveBeenCalledWith('g1', 'e1', 'd1', 'l2');
  });

  it('o organizador pode escolher outra opção que não a líder', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByLabelText(/11\/10\/2026/));
    await user.click(dialog.getByLabelText(/Casa do Edu/));
    await user.click(dialog.getByRole('button', { name: 'Confirmar e ir para jogos' }));

    expect(eventService.advanceToGamesVoting).toHaveBeenCalledWith('g1', 'e1', 'd2', 'l1');
  });

  it('em empate nada vem marcado: o organizador precisa escolher antes de confirmar', async () => {
    const user = userEvent.setup();
    await open(dateEvent({ votesDate: { 'u-bia': ['d1'], 'u-caio': ['d2'] } }));

    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Empate nos votos: escolha uma das datas.')).toBeTruthy();
    const confirm = dialog.getByRole('button', {
      name: 'Confirmar e ir para jogos',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await user.click(dialog.getByLabelText(/11\/10\/2026/));
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);
    expect(eventService.advanceToGamesVoting).toHaveBeenCalledWith('g1', 'e1', 'd2', 'l2');
  });

  it('sem nenhum voto o organizador também escolhe, e só confirma com data e local', async () => {
    const user = userEvent.setup();
    await open(dateEvent({ votesDate: {}, votesLocation: {} }));

    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    const dialog = within(screen.getByRole('dialog'));
    const confirm = dialog.getByRole('button', {
      name: 'Confirmar e ir para jogos',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await user.click(dialog.getByLabelText(/10\/10\/2026/));
    expect(confirm.disabled).toBe(true);
    await user.click(dialog.getByLabelText(/Casa do Edu/));
    expect(confirm.disabled).toBe(false);
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
    // Catan: 2 votos e 4 pontos (1º de Bia e de Caio); Azul: 1 voto e 1 ponto (2º de Caio)
    expect(screen.getByTitle('4 pt(s)')).toBeTruthy();
    expect(screen.getByTitle('1 pt(s)')).toBeTruthy();
    expect(screen.getByText('Sugerido por Edu · 2 voto(s)')).toBeTruthy();
    expect(screen.getByText('Sugerido por Bia · 1 voto(s)')).toBeTruthy();
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

describe('Evento — sugerir jogos da ludoteca', () => {
  const game = (id: string, name: string, playtime: string, min: number, max: number) => ({
    id,
    sourceId: id,
    name,
    image: '',
    playtime,
    minPlayers: min,
    maxPlayers: max,
  });

  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(ludotecaService.fetchUserCollection).mockResolvedValue([
      game('1', 'Catan', '60', 3, 4),
      game('2', 'Azul', '45', 2, 4),
      game('3', '7 Wonders Duel', '30', 2, 2),
    ] as never);
  });

  const openSuggest = async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ gameOptions: [], votesGames: {} }));
    await user.click(screen.getByRole('button', { name: '+ Sugerir jogos' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('Catan');
    return { user, dialog };
  };

  it('mostra a duração e os jogadores de cada jogo', async () => {
    const { dialog } = await openSuggest();

    expect(dialog.getByText('⏱ 60 min · 👥 3-4')).toBeTruthy();
    expect(dialog.getByText('⏱ 30 min · 👥 2')).toBeTruthy();
  });

  it('filtra pelo número de jogadores e pela duração', async () => {
    const { user, dialog } = await openSuggest();

    await user.selectOptions(dialog.getByLabelText('Jogadores'), '2');
    expect(dialog.queryByText('Catan')).toBeNull();

    await user.selectOptions(dialog.getByLabelText('Duração'), '30');
    expect(dialog.queryByText('Azul')).toBeNull();
    expect(dialog.getByText('7 Wonders Duel')).toBeTruthy();

    await user.selectOptions(dialog.getByLabelText('Jogadores'), '8');
    expect(dialog.getByText('Nenhum jogo da sua ludoteca combina com os filtros.')).toBeTruthy();
  });

  it('"Selecionar os filtrados" marca só o que está na lista e envia esses jogos', async () => {
    const { user, dialog } = await openSuggest();

    await user.selectOptions(dialog.getByLabelText('Jogadores'), '2');
    await user.click(dialog.getByRole('button', { name: 'Selecionar os filtrados' }));
    await user.click(dialog.getByRole('button', { name: 'Enviar para a mesa' }));

    expect(eventService.suggestGames).toHaveBeenCalledWith(
      'g1',
      'e1',
      expect.arrayContaining([
        expect.objectContaining({ id: '2', name: 'Azul', suggesterId: 'u-edu' }),
        expect.objectContaining({ id: '3', name: '7 Wonders Duel' }),
      ]),
    );
    expect(vi.mocked(eventService.suggestGames).mock.calls[0][2]).toHaveLength(2);
  });
});

describe('Evento — adicionar ao calendário', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
  });

  it('com a data definida, baixa o arquivo do calendário com data, hora e local do evento', async () => {
    const user = userEvent.setup();
    await open(gamesEvent());

    await user.click(screen.getByRole('button', { name: /Adicionar ao calendário/ }));

    expect(downloadIcs).toHaveBeenCalledTimes(1);
    const [filename, content] = vi.mocked(downloadIcs).mock.calls[0];
    expect(filename).toBe('jogatina.ics');
    expect(content).toContain('DTSTART:20261011T140000');
    expect(content).toContain('SUMMARY:Jogatina: Jogatina de aniversário (Sexta)');
    // No arquivo, a vírgula do texto leva uma barra na frente
    expect(content).toContain(String.raw`LOCATION:Casa do Edu\, Rua das Flores\, 100`);
  });

  it('enquanto a data não foi definida não há botão de calendário', async () => {
    await open(dateEvent());
    expect(screen.queryByRole('button', { name: /Adicionar ao calendário/ })).toBeNull();
  });
});

describe('Evento — você vai?', () => {
  const answers = (mine: 'yes' | 'maybe' | 'no' | null = null) => [
    { userId: 'u-edu', name: 'Edu', status: mine },
    { userId: 'u-bia', name: 'Bia', status: 'yes' as const },
    { userId: 'u-caio', name: 'Caio', status: 'no' as const },
    { userId: 'u-duda', name: 'Duda', status: null },
  ];

  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(eventService.getAttendance).mockResolvedValue(answers());
  });

  it('com a data definida mostra as respostas agrupadas e quem ainda não respondeu', async () => {
    await open(gamesEvent());

    expect(await screen.findByText('Vão (1)')).toBeTruthy();
    expect(screen.getByText('Não vão (1)')).toBeTruthy();
    expect(screen.getByText('Sem resposta (2)')).toBeTruthy();
    expect(screen.getByText('Edu, Duda')).toBeTruthy();
    expect(eventService.getAttendance).toHaveBeenCalledWith('e1', 'token-de-teste');
    for (const name of ['Vou', 'Talvez', 'Não vou']) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('marca a resposta atual da pessoa', async () => {
    vi.mocked(eventService.getAttendance).mockResolvedValue(answers('maybe'));
    await open(gamesEvent());

    expect(
      (await screen.findByRole('button', { name: 'Talvez' })).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('responder grava na API e atualiza a lista', async () => {
    const user = userEvent.setup();
    await open(gamesEvent());
    await screen.findByText('Vão (1)');
    vi.mocked(eventService.getAttendance).mockResolvedValue(answers('yes'));

    await user.click(screen.getByRole('button', { name: 'Vou' }));

    expect(eventService.setAttendance).toHaveBeenCalledWith('e1', 'yes', 'token-de-teste');
    expect(await screen.findByText('Vão (2)')).toBeTruthy();
  });

  it('se a API recusar, volta ao que era e avisa', async () => {
    const user = userEvent.setup();
    vi.mocked(eventService.setAttendance).mockRejectedValue(new Error('Sem permissão.'));
    await open(gamesEvent());
    await screen.findByText('Vão (1)');

    await user.click(screen.getByRole('button', { name: 'Vou' }));

    expect(toast.error).toHaveBeenCalledWith('Sem permissão.');
    expect(screen.getByRole('button', { name: 'Vou' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('antes de a data ser definida a pergunta não aparece', async () => {
    await open(dateEvent());

    expect(screen.queryByRole('button', { name: 'Vou' })).toBeNull();
    expect(eventService.getAttendance).not.toHaveBeenCalled();
  });

  it('se as presenças não carregarem, o resto da página continua funcionando', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(eventService.getAttendance).mockRejectedValue(new Error('fora do ar'));

    expect((await open(gamesEvent())).textContent).toBe('Jogatina de aniversário');
    expect(screen.getByText('O que vamos jogar?')).toBeTruthy();
  });
});

describe('Evento — avisos ao grupo', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(eventService.getAttendance).mockResolvedValue([]);
    vi.mocked(eventService.confirmEvent).mockResolvedValue(undefined);
    vi.mocked(eventService.notifyGroup).mockResolvedValue(undefined);
  });

  it('ao cravar data e local, pede o aviso "date_set"', async () => {
    const user = userEvent.setup();
    await open(dateEvent());

    await user.click(screen.getByRole('button', { name: /Cravar vencedores/ }));
    await user.click(screen.getByRole('button', { name: 'Confirmar e ir para jogos' }));

    expect(eventService.notifyGroup).toHaveBeenCalledWith('e1', 'date_set', 'token-de-teste');
  });

  it('ao confirmar a mesa, pede o aviso "confirmed"', async () => {
    const user = userEvent.setup();
    await open(gamesEvent());

    await user.click(screen.getByRole('button', { name: /Encerrar votação de jogos/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar jogatina' }),
    );

    expect(eventService.confirmEvent).toHaveBeenCalled();
    expect(eventService.notifyGroup).toHaveBeenCalledWith('e1', 'confirmed', 'token-de-teste');
  });

  it('não pede aviso quando a ação principal falha', async () => {
    const user = userEvent.setup();
    vi.mocked(eventService.confirmEvent).mockRejectedValue(new Error('falhou'));
    await open(gamesEvent());

    await user.click(screen.getByRole('button', { name: /Encerrar votação de jogos/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar jogatina' }),
    );

    expect(eventService.notifyGroup).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Erro ao encerrar votação de jogos.');
  });

  it('se o aviso falhar, a ação principal continua valendo', async () => {
    const user = userEvent.setup();
    vi.mocked(eventService.notifyGroup).mockRejectedValue(new Error('push fora do ar'));
    await open(gamesEvent());

    await user.click(screen.getByRole('button', { name: /Encerrar votação de jogos/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar jogatina' }),
    );

    expect(toast.success).toHaveBeenCalledWith('Jogatina confirmada!');
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('Evento — ranking de jogos', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(eventService.getAttendance).mockResolvedValue([]);
    vi.mocked(eventService.voteGames).mockResolvedValue(undefined);
  });

  const panel = () =>
    within(screen.getByRole('heading', { name: 'Sua ordem de preferência' }).parentElement!);
  const order = () =>
    panel()
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  it('sem nenhum jogo marcado não há ordem a fazer', async () => {
    await open(gamesEvent({ votesGames: {} }));

    expect(screen.queryByRole('heading', { name: 'Sua ordem de preferência' })).toBeNull();
  });

  it('os jogos marcados entram na ordem em que foram marcados, e desmarcar tira da ordem', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: {} }));

    await user.click(screen.getByLabelText(/Azul/));
    await user.click(screen.getByLabelText(/Catan/));
    expect(order()).toEqual(['1ºAzul↑↓', '2ºCatan↑↓']);

    await user.click(screen.getByRole('checkbox', { name: /Azul/ }));
    expect(order()).toEqual(['1ºCatan↑↓']);
  });

  it('subir e descer muda a ordem e é o que vai no voto', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: {} }));
    await user.click(screen.getByLabelText(/Azul/));
    await user.click(screen.getByLabelText(/Catan/));

    await user.click(screen.getByRole('button', { name: 'Subir Catan' }));
    expect(order()).toEqual(['1ºCatan↑↓', '2ºAzul↑↓']);
    await user.click(screen.getByRole('button', { name: 'Descer Catan' }));
    expect(order()).toEqual(['1ºAzul↑↓', '2ºCatan↑↓']);
    await user.click(screen.getByRole('button', { name: 'Subir Catan' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar votos' }));

    expect(eventService.voteGames).toHaveBeenCalledWith('g1', 'e1', 'u-edu', ['g-catan', 'g-azul']);
  });

  it('o primeiro não sobe e o último não desce', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: {} }));
    await user.click(screen.getByLabelText(/Azul/));
    await user.click(screen.getByLabelText(/Catan/));

    expect((screen.getByRole('button', { name: 'Subir Azul' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Descer Catan' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('quem já votou vê a própria ordem de volta', async () => {
    await open(gamesEvent({ votesGames: { 'u-edu': ['g-azul', 'g-catan'] } }));

    expect(order()).toEqual(['1ºAzul↑↓', '2ºCatan↑↓']);
  });

  it('jogo que deixou de existir sai da ordem e do voto', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: { 'u-edu': ['removido', 'g-catan'] } }));

    expect(order()).toEqual(['1ºCatan↑↓']);
    await user.click(screen.getByRole('button', { name: 'Confirmar votos' }));
    expect(vi.mocked(eventService.voteGames).mock.calls[0][3]).toEqual(['g-catan']);
  });

  it('mostra os pontos de cada jogo e destaca o líder', async () => {
    await open(
      gamesEvent({
        votesGames: { 'u-bia': ['g-azul', 'g-catan'], 'u-caio': ['g-azul'] },
      }),
    );

    // Azul: 2 + 2 = 4 pontos; Catan: 1 ponto
    expect(screen.getByTitle('4 pt(s)')).toBeTruthy();
    expect(screen.getByTitle('1 pt(s)')).toBeTruthy();
    const azul = screen.getByLabelText(/Azul/).closest('label')!;
    expect(within(azul).getByText('Líder')).toBeTruthy();
  });

  it('um jogo marcado por todos, mas em último, pode empatar em pontos com o favorito de poucos', async () => {
    await open(
      gamesEvent({
        votesGames: {
          'u-bia': ['g-azul', 'g-catan'],
          'u-caio': ['g-azul', 'g-catan'],
          'u-edu': ['g-catan'],
        },
      }),
    );

    // Catan: 3 votos, mas 1 + 1 + 2 = 4 pontos; Azul: 2 votos, 2 + 2 = 4 pontos: empate
    expect(screen.getAllByText('Empate')).toHaveLength(2);
  });

  it('a janela de encerramento mostra pontos e votos, com os votados marcados', async () => {
    const user = userEvent.setup();
    await open(gamesEvent({ votesGames: { 'u-bia': ['g-catan'] } }));

    await user.click(screen.getByRole('button', { name: /Encerrar votação de jogos/ }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText('2 pt(s) · 1 voto(s)')).toBeTruthy();
    expect(dialog.getByText('0 pt(s) · 0 voto(s)')).toBeTruthy();
    expect((dialog.getByLabelText(/Catan/) as HTMLInputElement).checked).toBe(true);
    expect((dialog.getByLabelText(/Azul/) as HTMLInputElement).checked).toBe(false);
  });

  it('o resumo para o WhatsApp traz pontos e votos por jogo', async () => {
    const user = userEvent.setup();
    await open(
      gamesEvent({ votesGames: { 'u-bia': ['g-catan'], 'u-caio': ['g-catan', 'g-azul'] } }),
    );

    await user.click(screen.getByRole('button', { name: /Copiar resumo/ }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('- Catan: 4 pt(s) (2 voto(s))');
    expect(copied).toContain('- Azul: 1 pt(s) (1 voto(s))');
  });
});

describe('Evento — carregamento', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(members);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(eventService.getAttendance).mockResolvedValue([]);
  });

  it('enquanto o evento chega mostra o esqueleto da página, nas duas colunas', async () => {
    const details = deferred<never>();
    vi.mocked(eventService.getEventDetails).mockReturnValue(details.promise);
    vi.mocked(groupService.fetchGroupDetails).mockResolvedValue({
      id: 'g1',
      name: 'Sexta',
      adminId: 'u-ana',
      inviteToken: 't',
    });
    renderPage(<EventDetails />, { path: '/event/:groupId/:eventId', route: '/event/g1/e1' });

    expect(screen.getByText('Carregando o evento')).toBeTruthy();
    expect(screen.getByText('Carregando quem já votou')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();

    details.resolve(dateEvent() as never);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Jogatina de aniversário',
    );
    expect(screen.queryByText('Carregando o evento')).toBeNull();
  });
});
