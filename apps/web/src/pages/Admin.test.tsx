// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { adminService } from '../services/adminService';
import { deferred } from '../test/deferred';
import { Admin } from './Admin';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/adminService', () => ({
  adminService: {
    listUsers: vi.fn(),
    listGroups: vi.fn(),
    listEvents: vi.fn(),
    listLogs: vi.fn(),
    setTemporaryPassword: vi.fn(),
    setAdmin: vi.fn(),
    deleteUser: vi.fn(),
    transferGroupAdmin: vi.fn(),
    removeMember: vi.fn(),
    remindEvent: vi.fn(),
  },
}));

const user = (id: string, name: string, extra = {}) => ({
  id,
  name,
  email: `${name.toLowerCase()}@exemplo.test`,
  created: '2026-10-04 23:54:00.000Z',
  providers: [],
  groups: 1,
  games: 0,
  pushDevices: 0,
  admin: null,
  ...extra,
});

const rowOf = (name: string) => within(screen.getByText(name).closest('li')!);
const TOKEN = 'token-de-teste';

describe('Admin — usuários', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(adminService.listUsers).mockResolvedValue([
      user('u-edu', 'Edu', { admin: 'fixed', providers: ['google'] }),
      user('u-ana', 'Ana', { admin: 'fixed' }),
      user('u-bia', 'Bia', { pushDevices: 2, games: 5 }),
    ]);
  });

  it('lista os usuários com login, jogos, notificações e quem é admin', async () => {
    renderPage(<Admin />);

    expect(await screen.findByText('bia@exemplo.test')).toBeTruthy();
    expect(screen.getAllByText('admin fixo')).toHaveLength(2);
    expect(rowOf('Bia').getByText('2 aparelho(s)')).toBeTruthy();
    expect(rowOf('Edu').getByText(/Google/)).toBeTruthy();
  });

  it('não oferece excluir nem mexer no admin de si mesmo; admin fixo não perde acesso', async () => {
    renderPage(<Admin />);
    await screen.findByText('bia@exemplo.test');

    expect(rowOf('Edu').queryByRole('button', { name: 'Excluir' })).toBeNull();
    expect(rowOf('Edu').queryByRole('button', { name: /admin/i })).toBeNull();
    expect(rowOf('Ana').queryByRole('button', { name: /admin/i })).toBeNull();
    expect(rowOf('Ana').getByRole('button', { name: 'Excluir' })).toBeTruthy();
    expect(rowOf('Bia').getByRole('button', { name: 'Tornar admin' })).toBeTruthy();
  });

  it('busca por nome ou e-mail', async () => {
    const u = userEvent.setup();
    renderPage(<Admin />);
    await screen.findByText('bia@exemplo.test');

    await u.type(screen.getByPlaceholderText(/Buscar/), 'ana@');
    expect(screen.queryByText('Bia')).toBeNull();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('senha temporária: confirma, mostra uma vez e some ao fechar', async () => {
    vi.mocked(adminService.setTemporaryPassword).mockResolvedValue('Zk7mQpd3Rtv9');
    const u = userEvent.setup();
    renderPage(<Admin />);
    await screen.findByText('bia@exemplo.test');

    await u.click(rowOf('Bia').getByRole('button', { name: 'Senha temporária' }));
    expect(adminService.setTemporaryPassword).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Gerar senha' }));

    expect(adminService.setTemporaryPassword).toHaveBeenCalledWith(TOKEN, 'u-bia');
    expect(await screen.findByText('Zk7mQpd3Rtv9')).toBeTruthy();

    await u.click(screen.getByRole('button', { name: 'Pronto' }));
    expect(screen.queryByText('Zk7mQpd3Rtv9')).toBeNull();
  });

  it('tornar admin chama a API e recarrega a lista', async () => {
    const u = userEvent.setup();
    renderPage(<Admin />);
    await screen.findByText('bia@exemplo.test');

    await u.click(rowOf('Bia').getByRole('button', { name: 'Tornar admin' }));

    expect(adminService.setAdmin).toHaveBeenCalledWith(TOKEN, 'u-bia', true);
    expect(toast.success).toHaveBeenCalledWith('Acesso de admin concedido.');
    expect(adminService.listUsers).toHaveBeenCalledTimes(2);
  });

  it('excluir conta só acontece depois de confirmar', async () => {
    const u = userEvent.setup();
    renderPage(<Admin />);
    await screen.findByText('bia@exemplo.test');

    await u.click(rowOf('Bia').getByRole('button', { name: 'Excluir' }));
    expect(adminService.deleteUser).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(adminService.deleteUser).toHaveBeenCalledWith(TOKEN, 'u-bia');
  });

  it('mostra o erro da API em vez da lista', async () => {
    vi.mocked(adminService.listUsers).mockRejectedValue(
      new Error('Acesso restrito aos administradores do app.'),
    );
    renderPage(<Admin />);

    expect(await screen.findByText('Acesso restrito aos administradores do app.')).toBeTruthy();
  });
});

describe('Admin — grupos, eventos e registro', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(adminService.listUsers).mockResolvedValue([]);
  });

  it('grupos: transfere o admin e remove membro (com confirmação)', async () => {
    vi.mocked(adminService.listGroups).mockResolvedValue([
      {
        id: 'g1',
        name: 'Sexta',
        adminId: 'u-ana',
        events: 3,
        members: [
          { id: 'u-ana', name: 'Ana' },
          { id: 'u-bia', name: 'Bia' },
        ],
      },
    ]);
    const u = userEvent.setup();
    renderPage(<Admin />);
    await u.click(await screen.findByRole('button', { name: 'Grupos' }));

    expect(await screen.findByText('admin do grupo')).toBeTruthy();
    expect(screen.getByText('2 membro(s) · 3 evento(s)')).toBeTruthy();

    await u.click(screen.getByRole('button', { name: 'Tornar admin' }));
    expect(adminService.transferGroupAdmin).toHaveBeenCalledWith(TOKEN, 'g1', 'u-bia');

    await u.click(screen.getByRole('button', { name: 'Remover' }));
    expect(adminService.removeMember).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(adminService.removeMember).toHaveBeenCalledWith(TOKEN, 'g1', 'u-bia');
  });

  it('eventos: lista quem falta votar e cobra, mostrando o resumo da API', async () => {
    vi.mocked(adminService.listEvents).mockResolvedValue([
      {
        id: 'e1',
        title: 'Noite dos euros',
        status: 'VOTING_GAMES',
        groupId: 'g1',
        groupName: 'Sexta',
        pendingNames: ['Ana', 'Caio'],
        lastReminderSentAt: '',
      },
      {
        id: 'e2',
        title: 'Já votaram',
        status: 'VOTING_DATE',
        groupId: 'g1',
        groupName: 'Sexta',
        pendingNames: [],
        lastReminderSentAt: '2026-10-05 12:00:00.000Z',
      },
    ]);
    vi.mocked(adminService.remindEvent).mockResolvedValue(
      'Notificação enviada para 1 de 2 pessoa(s) que ainda não votaram.',
    );
    const u = userEvent.setup();
    renderPage(<Admin />);
    await u.click(await screen.findByRole('button', { name: 'Eventos' }));

    expect(await screen.findByText('Falta votar: Ana, Caio')).toBeTruthy();
    expect(screen.getByText('Votando jogos')).toBeTruthy();
    expect(screen.getByText(/Todo mundo já votou\. · último lembrete em/)).toBeTruthy();

    const buttons = screen.getAllByRole('button', { name: 'Cobrar quem não votou' });
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    await u.click(buttons[0]);

    expect(adminService.remindEvent).toHaveBeenCalledWith(TOKEN, 'e1');
    expect(toast.success).toHaveBeenCalledWith(
      'Notificação enviada para 1 de 2 pessoa(s) que ainda não votaram.',
    );
  });

  it('eventos: estado vazio', async () => {
    vi.mocked(adminService.listEvents).mockResolvedValue([]);
    const u = userEvent.setup();
    renderPage(<Admin />);
    await u.click(await screen.findByRole('button', { name: 'Eventos' }));

    expect(await screen.findByText('Nenhum evento em votação no momento.')).toBeTruthy();
  });

  it('registro: traduz a ação e mostra quem fez', async () => {
    vi.mocked(adminService.listLogs).mockResolvedValue([
      {
        id: 'l1',
        actorEmail: 'edu@exemplo.test',
        action: 'cobranca_enviada',
        details: 'Sexta: Jogatina (1 de 2)',
        created: '2026-10-05 12:00:00.000Z',
      },
    ]);
    const u = userEvent.setup();
    renderPage(<Admin />);
    await u.click(await screen.findByRole('button', { name: 'Registro' }));

    expect(await screen.findByText('Cobrança de votos enviada')).toBeTruthy();
    expect(screen.getByText('Sexta: Jogatina (1 de 2)')).toBeTruthy();
    expect(screen.getByText('por edu@exemplo.test')).toBeTruthy();
  });
});

describe('Admin — carregamento', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
  });

  it('enquanto a lista chega mostra o esqueleto, sem dizer que está vazia', async () => {
    const users = deferred<never[]>();
    vi.mocked(adminService.listUsers).mockReturnValue(users.promise);
    renderPage(<Admin />);

    expect(screen.getByText('Carregando')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Buscar/)).toBeNull();

    users.resolve([]);
    expect(await screen.findByPlaceholderText(/Buscar/)).toBeTruthy();
    expect(screen.queryByText('Carregando')).toBeNull();
  });
});

describe('Admin — avatares', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(adminService.listUsers).mockResolvedValue([
      user('u-edu', 'Edu', { admin: 'fixed' }),
      user('u-bia', 'Bia'),
    ]);
  });

  it('cada usuário aparece com o avatar de iniciais', async () => {
    renderPage(<Admin />);
    await screen.findByText('bia@exemplo.test');

    expect(rowOf('Bia').getByText('B').className).toContain('avatar');
    expect(rowOf('Edu').getByText('E').className).toContain('avatar');
  });
});

describe('Admin — acessibilidade', () => {
  it('título da aba e filtro de usuários com rótulo próprio', async () => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(adminService.listUsers).mockResolvedValue([]);
    renderPage(<Admin />);

    expect(await screen.findByLabelText('Buscar usuários')).toBeTruthy();
    expect(document.title).toBe('Administração · Vamos Jogar');
  });
});
