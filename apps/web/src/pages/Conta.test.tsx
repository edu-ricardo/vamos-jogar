// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { fakeAuth, resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { accountService } from '../services/accountService';
import { Conta } from './Conta';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/groupService', () => ({ groupService: {} }));
vi.mock('../services/accountService', () => ({ accountService: { deleteAccount: vi.fn() } }));
vi.mock('../services/notificationService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/notificationService')>()),
  notificationService: {
    getStatus: vi.fn().mockResolvedValue('unsupported'),
    getPreferences: vi.fn().mockResolvedValue({
      created: true,
      date_set: true,
      confirmed: true,
      eve: true,
      reminder: true,
    }),
  },
}));

const newPassword = () => screen.getByLabelText(/^Nova senha/);
const confirmation = () => screen.getByLabelText('Confirme a nova senha');

describe('Conta', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
  });

  it('trocar senha: recusa senha curta e confirmação diferente sem chamar o servidor', async () => {
    const user = userEvent.setup();
    renderPage(<Conta />);

    await user.type(screen.getByLabelText('Senha atual'), 'atual-123');
    await user.type(newPassword(), 'curta');
    await user.type(confirmation(), 'curta');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(toast.error).toHaveBeenLastCalledWith(
      'A nova senha precisa de pelo menos 8 caracteres.',
    );

    await user.clear(newPassword());
    await user.clear(confirmation());
    await user.type(newPassword(), 'senha-nova-1');
    await user.type(confirmation(), 'outra-coisa-1');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(toast.error).toHaveBeenLastCalledWith('A confirmação não bate com a nova senha.');

    expect(fakeAuth.changePassword).not.toHaveBeenCalled();
  });

  it('trocar senha: envia a atual e a nova, avisa e limpa o formulário', async () => {
    const user = userEvent.setup();
    renderPage(<Conta />);

    await user.type(screen.getByLabelText('Senha atual'), 'atual-123');
    await user.type(newPassword(), 'senha-nova-1');
    await user.type(confirmation(), 'senha-nova-1');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(fakeAuth.changePassword).toHaveBeenCalledWith('atual-123', 'senha-nova-1');
    expect(toast.success).toHaveBeenCalledWith('Senha alterada.');
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('');
  });

  it('trocar senha: senha atual errada mostra o aviso de erro', async () => {
    fakeAuth.changePassword.mockRejectedValue(new Error('invalid'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage(<Conta />);

    await user.type(screen.getByLabelText('Senha atual'), 'errada-123');
    await user.type(newPassword(), 'senha-nova-1');
    await user.type(confirmation(), 'senha-nova-1');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));

    expect(toast.error).toHaveBeenCalledWith(
      'Não foi possível trocar a senha. Confira a senha atual.',
    );
  });

  it('excluir conta pede confirmação, chama a API com o token e sai', async () => {
    const user = userEvent.setup();
    renderPage(<Conta />);

    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    expect(accountService.deleteAccount).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sim, excluir minha conta' }));

    expect(accountService.deleteAccount).toHaveBeenCalledWith('token-de-teste');
    expect(fakeAuth.logout).toHaveBeenCalled();
  });

  it('cancelar a exclusão fecha a janela sem excluir', async () => {
    const user = userEvent.setup();
    renderPage(<Conta />);

    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(accountService.deleteAccount).not.toHaveBeenCalled();
  });
});
