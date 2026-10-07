// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../test/renderPage';
import { Modal } from './Modal';

describe('Modal', () => {
  it('mostra título, conteúdo e rodapé', () => {
    render(
      <Modal title="Excluir?" onClose={() => {}} footer={<button>Sim</button>}>
        <p>Não tem volta.</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Excluir?' })).toBeTruthy();
    expect(screen.getByText('Não tem volta.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sim' })).toBeTruthy();
  });

  it('fecha com Esc, com o X e clicando fora, mas não ao clicar dentro', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Janela" onClose={onClose}>
        <p>conteúdo</p>
      </Modal>,
    );

    await user.click(screen.getByText('conteúdo'));
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.pointer({ keys: '[MouseLeft]', target: document.querySelector('.modal-overlay')! });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
