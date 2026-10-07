// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { fakeAuth, resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { groupService } from '../services/groupService';
import { eventService } from '../services/eventService';
import { deferred } from '../test/deferred';
import { ludotecaService } from '../services/ludotecaService';
import { GroupDetails } from './GroupDetails';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/groupService', () => ({
  groupService: {
    fetchGroupDetails: vi.fn(),
    fetchGroupMembers: vi.fn(),
    removeMember: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));
vi.mock('../services/eventService', () => ({
  eventService: {
    fetchGroupEvents: vi.fn(),
    fetchFavoriteLocations: vi.fn(),
    createEvent: vi.fn(),
    saveFavoriteLocation: vi.fn(),
    notifyGroup: vi.fn(),
  },
}));
vi.mock('../services/ludotecaService', () => ({
  ludotecaService: { fetchGroupGames: vi.fn() },
}));

const members = [
  { id: 'u-ana', name: 'Ana' },
  { id: 'u-edu', name: 'Edu' },
  { id: 'u-bia', name: 'Bia' },
];

const open = async (adminId: string, groupMembers = members) => {
  vi.mocked(groupService.fetchGroupDetails).mockResolvedValue({
    id: 'g1',
    name: 'Sexta',
    adminId,
    inviteToken: 't',
  });
  vi.mocked(groupService.fetchGroupMembers).mockResolvedValue(groupMembers);
  renderPage(<GroupDetails />, { path: '/group/:id', route: '/group/g1' });
  await screen.findByRole('heading', { name: 'Sexta' });
};

describe('Grupo — sair', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(groupService.leaveGroup).mockResolvedValue({ groupDeleted: false });
  });

  it('mostra os membros e o botão de sair para qualquer membro', async () => {
    await open('u-ana');

    expect(screen.getByRole('heading', { name: 'Membros (3)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair do grupo' })).toBeTruthy();
  });

  it('pede confirmação, sai com o token e volta para a lista de grupos', async () => {
    const user = userEvent.setup();
    await open('u-ana');

    await user.click(screen.getByRole('button', { name: 'Sair do grupo' }));
    expect(screen.getByText(/votos e sugestões nos eventos em aberto/)).toBeTruthy();
    expect(groupService.leaveGroup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sim, sair' }));

    expect(groupService.leaveGroup).toHaveBeenCalledWith('g1', 'token-de-teste');
    expect(toast.success).toHaveBeenCalledWith('Você saiu do grupo.');
    expect(await screen.findByTestId('outra-rota')).toBeTruthy();
  });

  it('cancelar não sai', async () => {
    const user = userEvent.setup();
    await open('u-ana');

    await user.click(screen.getByRole('button', { name: 'Sair do grupo' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(groupService.leaveGroup).not.toHaveBeenCalled();
  });

  it('o admin é avisado de que a administração passa ao membro mais antigo', async () => {
    const user = userEvent.setup();
    await open(fakeAuth.user!.uid);

    await user.click(screen.getByRole('button', { name: 'Sair do grupo' }));

    expect(screen.getByText(/administração passa ao membro mais antigo/)).toBeTruthy();
  });

  it('o único membro é avisado de que o grupo será apagado e vê a confirmação certa', async () => {
    const user = userEvent.setup();
    vi.mocked(groupService.leaveGroup).mockResolvedValue({ groupDeleted: true });
    await open('u-edu', [{ id: 'u-edu', name: 'Edu' }]);

    await user.click(screen.getByRole('button', { name: 'Sair do grupo' }));
    expect(screen.getByText(/grupo e todos os eventos dele serão apagados/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sim, sair' }));

    expect(toast.success).toHaveBeenCalledWith('Você saiu e o grupo foi apagado.');
  });

  it('mostra o erro da API e continua na página', async () => {
    const user = userEvent.setup();
    vi.mocked(groupService.leaveGroup).mockRejectedValue(new Error('Você não é membro.'));
    await open('u-ana');

    await user.click(screen.getByRole('button', { name: 'Sair do grupo' }));
    await user.click(screen.getByRole('button', { name: 'Sim, sair' }));

    expect(toast.error).toHaveBeenCalledWith('Você não é membro.');
    expect(screen.queryByTestId('outra-rota')).toBeNull();
  });
});

describe('Grupo — criar evento', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(eventService.createEvent).mockResolvedValue('novo-evento');
    vi.mocked(eventService.notifyGroup).mockResolvedValue(undefined);
  });

  const fillAndSubmit = async () => {
    const user = userEvent.setup();
    await open('u-ana');
    // O botão do cabeçalho (o do estado vazio, quando há, vem depois)
    await user.click(screen.getAllByRole('button', { name: '+ Criar evento' })[0]);
    await user.type(screen.getByLabelText('Título do evento'), 'Noite dos euros');
    await user.type(screen.getByLabelText('Data'), '2026-10-20');
    await user.type(screen.getByLabelText('Início'), '19:00');
    await user.type(screen.getByPlaceholderText(/Nome \(Ex/), 'Casa do Edu');
    await user.type(screen.getByPlaceholderText(/Endereço completo/), 'Rua das Flores, 100');
    await user.click(screen.getByRole('button', { name: 'Criar e abrir votação' }));
  };

  it('cria o evento e pede o aviso "created" ao grupo, com o id do evento novo', async () => {
    await fillAndSubmit();

    expect(eventService.createEvent).toHaveBeenCalledWith(
      'g1',
      'u-edu',
      'Noite dos euros',
      [expect.objectContaining({ date: '2026-10-20', startTime: '19:00' })],
      [expect.objectContaining({ name: 'Casa do Edu', address: 'Rua das Flores, 100' })],
    );
    await vi.waitFor(() =>
      expect(eventService.notifyGroup).toHaveBeenCalledWith(
        'novo-evento',
        'created',
        'token-de-teste',
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Evento criado e pronto para votação!');
  });

  it('se o aviso falhar, o evento continua criado e sem mensagem de erro', async () => {
    vi.mocked(eventService.notifyGroup).mockRejectedValue(new Error('push fora do ar'));
    await fillAndSubmit();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Evento criado e pronto para votação!'),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('se criar o evento falhar, não avisa ninguém', async () => {
    vi.mocked(eventService.createEvent).mockRejectedValue(new Error('banco fora'));
    await fillAndSubmit();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao criar evento.'));
    expect(eventService.notifyGroup).not.toHaveBeenCalled();
  });
});

describe('Grupo — jogos do grupo', () => {
  const groupGames = [
    {
      key: 'azul',
      name: 'Azul',
      image: '',
      playtime: '45',
      minPlayers: 2,
      maxPlayers: 4,
      owners: [{ id: 'u-ana', name: 'Ana' }],
    },
    {
      key: 'catan',
      name: 'Catan',
      image: 'capa.jpg',
      playtime: '60',
      minPlayers: 3,
      maxPlayers: 4,
      owners: [
        { id: 'u-ana', name: 'Ana' },
        { id: 'u-edu', name: 'Edu' },
      ],
    },
  ];

  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
    vi.mocked(ludotecaService.fetchGroupGames).mockResolvedValue(groupGames);
  });

  it('só carrega as ludotecas quando a pessoa pede', async () => {
    await open('u-ana');

    expect(screen.getByRole('button', { name: 'Ver jogos do grupo' })).toBeTruthy();
    expect(ludotecaService.fetchGroupGames).not.toHaveBeenCalled();
  });

  it('mostra cada jogo uma vez, com quem tem e os dados do jogo', async () => {
    const user = userEvent.setup();
    await open('u-ana');

    await user.click(screen.getByRole('button', { name: 'Ver jogos do grupo' }));

    expect(ludotecaService.fetchGroupGames).toHaveBeenCalledWith(members);
    expect(await screen.findByText('Com: Ana, Edu')).toBeTruthy();
    expect(screen.getByText('Com: Ana')).toBeTruthy();
    expect(screen.getByText('⏱ 60 min · 👥 3-4')).toBeTruthy();
    expect(screen.getByText('⏱ 45 min · 👥 2-4')).toBeTruthy();
  });

  it('a busca acha pelo jogo e também por quem o tem', async () => {
    const user = userEvent.setup();
    await open('u-ana');
    await user.click(screen.getByRole('button', { name: 'Ver jogos do grupo' }));
    await screen.findByText('Catan');

    await user.type(screen.getByLabelText('Buscar nos jogos do grupo'), 'edu');
    expect(screen.getByText('Catan')).toBeTruthy();
    expect(screen.queryByText('Azul')).toBeNull();

    await user.clear(screen.getByLabelText('Buscar nos jogos do grupo'));
    await user.type(screen.getByLabelText('Buscar nos jogos do grupo'), 'zzz');
    expect(screen.getByText('Nenhum jogo ou pessoa combina com a busca.')).toBeTruthy();
  });

  it('avisa quando ninguém cadastrou jogos', async () => {
    const user = userEvent.setup();
    vi.mocked(ludotecaService.fetchGroupGames).mockResolvedValue([]);
    await open('u-ana');

    await user.click(screen.getByRole('button', { name: 'Ver jogos do grupo' }));

    expect(await screen.findByText('Nenhum membro cadastrou jogos ainda.')).toBeTruthy();
  });

  it('se não conseguir carregar, avisa e deixa tentar de novo', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(ludotecaService.fetchGroupGames).mockRejectedValue(new Error('fora do ar'));
    await open('u-ana');

    await user.click(screen.getByRole('button', { name: 'Ver jogos do grupo' }));

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Erro ao carregar as ludotecas do grupo.'),
    );
    expect(
      (screen.getByRole('button', { name: 'Ver jogos do grupo' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe('Grupo — histórico', () => {
  const PAST = '2020-03-01';
  const FUTURE = '2099-01-01';
  const table = [
    { id: 'c', name: 'Catan', thumb: '', suggesterId: 'u-ana' },
    { id: 'a', name: 'Azul', thumb: '', suggesterId: 'u-bia' },
  ];

  const evt = (id: string, title: string, date: string | null, extra = {}) =>
    ({
      id,
      groupId: 'g1',
      creatorId: 'u-ana',
      title,
      status: date ? 'CONFIRMED' : 'VOTING_DATE',
      dateOptions: [{ id: 'd1', date: date ?? FUTURE, startTime: '19:00' }],
      locationOptions: [{ id: 'l1', name: 'Casa do Edu', address: 'Rua A' }],
      finalDateId: date ? 'd1' : undefined,
      finalLocationId: date ? 'l1' : undefined,
      votesDate: {},
      votesLocation: {},
      createdAt: '',
      ...extra,
    }) as never;

  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
  });

  it('separa o que está em andamento do que já aconteceu', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      evt('1', 'Próxima jogatina', FUTURE),
      evt('2', 'Ainda votando', null),
      evt('3', 'Jogatina antiga', PAST, { gameOptions: table, finalGameIds: ['c', 'a'] }),
    ]);
    await open('u-ana');

    const eventos = within(screen.getByRole('heading', { name: 'Eventos' }).closest('section')!);
    expect(eventos.getByText('Próxima jogatina')).toBeTruthy();
    expect(eventos.getByText('Ainda votando')).toBeTruthy();
    expect(eventos.queryByText('Jogatina antiga')).toBeNull();
    expect(eventos.getByText('01/01/2099 às 19:00 · Casa do Edu')).toBeTruthy();

    const historico = within(
      screen.getByRole('heading', { name: 'Histórico' }).closest('section')!,
    );
    expect(historico.getByText('Jogatina antiga')).toBeTruthy();
    expect(historico.getByText('01/03/2020 às 19:00 · Casa do Edu')).toBeTruthy();
    expect(historico.getByText('Mesa: Catan, Azul')).toBeTruthy();
  });

  it('lista os jogos mais jogados, com quantas vezes e a última', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      evt('1', 'Primeira', '2020-03-01', { gameOptions: table, finalGameIds: ['c', 'a'] }),
      evt('2', 'Segunda', '2020-04-01', { gameOptions: table, finalGameIds: ['c'] }),
    ]);
    await open('u-ana');

    const mais = within(screen.getByRole('heading', { name: 'Jogos mais jogados' }).parentElement!);
    const items = mais.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      'Catan2 vezes · última em 01/04/2020',
      'Azul1 vez · última em 01/03/2020',
    ]);
  });

  it('evento passado que não foi confirmado não conta jogos e avisa', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      evt('1', 'Abandonada', PAST, { status: 'VOTING_GAMES', gameOptions: table }),
    ]);
    await open('u-ana');

    expect(screen.getByText('Não chegou a ser confirmado')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Jogos mais jogados' })).toBeNull();
  });

  it('mostra as 5 mais recentes e libera o resto em "Mostrar todas"', async () => {
    const user = userEvent.setup();
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => evt(String(i), `Jogatina ${i + 1}`, `2020-0${i + 1}-01`)),
    );
    await open('u-ana');

    expect(screen.queryByText('Jogatina 1')).toBeNull();
    expect(screen.getByText('Jogatina 7')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mostrar todas (7)' }));

    expect(screen.getByText('Jogatina 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mostrar todas/ })).toBeNull();
  });

  it('sem eventos passados não há histórico; só passados mostra "nenhum em andamento"', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([evt('1', 'Aberto', null)]);
    await open('u-ana');
    expect(screen.queryByRole('heading', { name: 'Histórico' })).toBeNull();
    cleanup();

    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([evt('2', 'Velha', PAST)]);
    await open('u-ana');
    expect(screen.getByText(/Nenhum evento em andamento/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Histórico' })).toBeTruthy();
  });
});

describe('Grupo — carregamento e estados vazios', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(eventService.fetchFavoriteLocations).mockResolvedValue([]);
  });

  it('enquanto os eventos chegam mostra o esqueleto, sem dizer que não há eventos', async () => {
    const events = deferred<never[]>();
    vi.mocked(eventService.fetchGroupEvents).mockReturnValue(events.promise);
    await open('u-ana');

    expect(screen.getByText('Carregando eventos')).toBeTruthy();
    expect(screen.queryByText(/Nenhum evento criado ainda/)).toBeNull();

    events.resolve([]);
    expect(await screen.findByText('Nenhum evento criado ainda.')).toBeTruthy();
    expect(screen.queryByText('Carregando eventos')).toBeNull();
  });

  it('sem eventos, o estado vazio oferece criar o primeiro e abre o formulário', async () => {
    const user = userEvent.setup();
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    await open('u-ana');

    const empty = within(
      (await screen.findByText('Nenhum evento criado ainda.')).closest('.empty-block')!,
    );
    await user.click(empty.getByRole('button', { name: '+ Criar evento' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
