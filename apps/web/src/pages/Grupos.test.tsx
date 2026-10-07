// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { groupService } from '../services/groupService';
import { Grupos } from './Grupos';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/groupService', () => ({
  groupService: { fetchUserGroups: vi.fn(), createGroup: vi.fn() },
}));

describe('Grupos', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([
      { id: 'g1', name: 'Sexta', adminId: 'u-edu', inviteToken: 'tok-sexta' },
      { id: 'g2', name: 'Família', adminId: 'u-ana', inviteToken: 'tok-fam' },
    ]);
  });

  it('lista os grupos e só o admin vê "Copiar convite"', async () => {
    renderPage(<Grupos />);

    expect(await screen.findByText('Sexta')).toBeTruthy();
    expect(screen.getByText('Você é o admin')).toBeTruthy();
    expect(screen.getByText('Membro')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Copiar convite' })).toHaveLength(1);
  });

  it('copia o link de convite do grupo', async () => {
    const user = userEvent.setup();
    renderPage(<Grupos />);

    await user.click(await screen.findByRole('button', { name: 'Copiar convite' }));

    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/join/tok-sexta`);
    expect(toast.success).toHaveBeenCalledWith('Link de convite copiado!');
  });

  it('cria o grupo com o nome digitado e recarrega a lista', async () => {
    const user = userEvent.setup();
    renderPage(<Grupos />);
    await screen.findByText('Sexta');

    await user.type(screen.getByPlaceholderText('Nome do novo grupo...'), 'Domingo');
    await user.click(screen.getByRole('button', { name: 'Criar grupo' }));

    expect(groupService.createGroup).toHaveBeenCalledWith('u-edu', 'Domingo', 'Edu');
    expect(toast.success).toHaveBeenCalledWith('Grupo criado com sucesso!');
    expect(groupService.fetchUserGroups).toHaveBeenCalledTimes(2);
  });
});
