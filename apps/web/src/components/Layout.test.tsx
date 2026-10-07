// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAuth, resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { Layout } from './Layout';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);

const renderLayout = () =>
  renderPage(
    <Layout>
      <p>conteúdo da página</p>
    </Layout>,
  );

describe('Layout', () => {
  beforeEach(resetAuth);

  it('mostra a navegação principal e o conteúdo', () => {
    renderLayout();
    for (const name of ['Início', 'Ludoteca', 'Grupos', 'Conta']) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeTruthy();
    }
    expect(screen.getByText('conteúdo da página')).toBeTruthy();
  });

  it('o item Admin só aparece para admin do app', () => {
    renderLayout();
    expect(screen.queryByRole('link', { name: /Admin/ })).toBeNull();

    fakeAuth.isAppAdmin = true;
    renderLayout();
    expect(screen.getByRole('link', { name: /Admin/ })).toBeTruthy();
  });

  it('Sair chama o logout', async () => {
    renderLayout();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));
    expect(fakeAuth.logout).toHaveBeenCalled();
  });
});
