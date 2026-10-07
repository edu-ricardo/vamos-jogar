// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { Login } from './Login';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);

describe('Login — acessibilidade', () => {
  beforeEach(resetAuth);

  it('os rótulos estão ligados aos campos e o título da aba é "Entrar"', () => {
    renderPage(<Login />);

    expect(screen.getByLabelText('E-mail').getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('password');
    expect(document.title).toBe('Entrar · Vamos Jogar');
  });

  it('o navegador recebe a dica certa para preencher: e-mail, senha atual ou senha nova', async () => {
    const user = userEvent.setup();
    renderPage(<Login />);

    expect(screen.getByLabelText('E-mail').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('Senha').getAttribute('autocomplete')).toBe('current-password');

    await user.click(screen.getByRole('button', { name: 'Cadastre-se' }));
    expect(screen.getByLabelText('Senha').getAttribute('autocomplete')).toBe('new-password');
  });
});
