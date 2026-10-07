// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { fakeAuth, resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { groupService } from '../services/groupService';
import { eventService } from '../services/eventService';
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
    await user.click(screen.getByRole('button', { name: '+ Criar evento' }));
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
