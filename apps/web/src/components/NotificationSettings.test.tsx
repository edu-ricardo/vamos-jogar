// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { notificationService } from '../services/notificationService';
import { NotificationSettings } from './NotificationSettings';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/notificationService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/notificationService')>()),
  notificationService: {
    getStatus: vi.fn(),
    getPreferences: vi.fn(),
    setPreferences: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
}));

const allOn = { created: true, date_set: true, confirmed: true, eve: true, reminder: true };

describe('Notificações — preferências', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(notificationService.getStatus).mockResolvedValue('enabled');
    vi.mocked(notificationService.getPreferences).mockResolvedValue(allOn);
  });

  it('mostra um item por tipo de aviso, todos ligados por padrão', async () => {
    renderPage(<NotificationSettings />);

    for (const label of [
      'Evento novo no grupo',
      'Data e local definidos',
      'Jogatina confirmada',
      'Lembrete na véspera da jogatina',
      'Lembrete quando falta o meu voto',
    ]) {
      expect(((await screen.findByLabelText(label)) as HTMLInputElement).checked).toBe(true);
    }
    expect(notificationService.getPreferences).toHaveBeenCalledWith('token-de-teste');
  });

  it('desligar um tipo envia só essa mudança e mantém o item desligado', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationService.setPreferences).mockResolvedValue({ ...allOn, eve: false });
    renderPage(<NotificationSettings />);

    await user.click(await screen.findByLabelText('Lembrete na véspera da jogatina'));

    expect(notificationService.setPreferences).toHaveBeenCalledWith('token-de-teste', {
      eve: false,
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Lembrete na véspera da jogatina') as HTMLInputElement).checked,
      ).toBe(false),
    );
  });

  it('se não conseguir salvar, volta ao que era e avisa', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationService.setPreferences).mockRejectedValue(new Error('Sem conexão.'));
    renderPage(<NotificationSettings />);

    await user.click(await screen.findByLabelText('Jogatina confirmada'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem conexão.'));
    expect((screen.getByLabelText('Jogatina confirmada') as HTMLInputElement).checked).toBe(true);
  });

  it('as preferências aparecem mesmo com as notificações desligadas neste aparelho', async () => {
    vi.mocked(notificationService.getStatus).mockResolvedValue('disabled');
    renderPage(<NotificationSettings />);

    expect(await screen.findByLabelText('Evento novo no grupo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ativar notificações' })).toBeTruthy();
  });

  it('valem para a pessoa: aparecem também onde este aparelho não recebe (bloqueado ou sem suporte)', async () => {
    for (const status of ['unsupported', 'denied'] as const) {
      vi.mocked(notificationService.getStatus).mockResolvedValue(status);
      const { unmount } = renderPage(<NotificationSettings />);

      expect(await screen.findByLabelText('Evento novo no grupo')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /notificações|Desativar/ })).toBeNull();
      unmount();
    }
  });

  it('se as preferências não carregarem, a seção some sem quebrar a tela', async () => {
    vi.mocked(notificationService.getPreferences).mockRejectedValue(new Error('fora do ar'));
    renderPage(<NotificationSettings />);

    expect(await screen.findByRole('button', { name: 'Desativar neste aparelho' })).toBeTruthy();
    expect(screen.queryByLabelText('Evento novo no grupo')).toBeNull();
  });
});
