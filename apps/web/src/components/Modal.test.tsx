// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
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

// Uma página com um botão que abre a janela, para ver para onde vai o foco
const Harness = ({ autoFocusField = false }: { autoFocusField?: boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      {open && (
        <Modal
          title="Janela de teste"
          onClose={() => setOpen(false)}
          footer={<button>Salvar</button>}
        >
          <input aria-label="Nome" autoFocus={autoFocusField} />
        </Modal>
      )}
    </>
  );
};

describe('Modal — acessibilidade', () => {
  it('o título nomeia a janela para leitores de tela', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('dialog', { name: 'Janela de teste' })).toBeTruthy();
  });

  it('ao abrir, o foco entra no primeiro campo do conteúdo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(document.activeElement).toBe(screen.getByLabelText('Nome'));
  });

  it('sem nenhum campo no conteúdo, o foco vai para o botão de fechar', async () => {
    render(
      <Modal title="Só texto" onClose={() => {}}>
        <p>Nada para preencher.</p>
      </Modal>,
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }));
  });

  it('respeita um campo que já pediu o foco sozinho', async () => {
    const user = userEvent.setup();
    render(<Harness autoFocusField />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(document.activeElement).toBe(screen.getByLabelText('Nome'));
  });

  it('o Tab gira dentro da janela, para frente e para trás', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const close = screen.getByRole('button', { name: 'Fechar' });
    const save = screen.getByRole('button', { name: 'Salvar' });

    await user.tab();
    expect(document.activeElement).toBe(save);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(save);
  });

  it('ao fechar, o foco volta para o botão que abriu a janela', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
