// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../test/renderPage';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('mostra o título, a explicação e a ação', () => {
    render(
      <EmptyState icon="🎲" title="Sua ludoteca está vazia." action={<button>Adicionar</button>}>
        Pesquise um jogo ao lado.
      </EmptyState>,
    );

    expect(screen.getByText('Sua ludoteca está vazia.')).toBeTruthy();
    expect(screen.getByText('Pesquise um jogo ao lado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeTruthy();
  });

  it('o ícone é só ilustração: escondido dos leitores de tela', () => {
    render(<EmptyState icon="🎲" title="Vazio" />);

    expect(screen.getByText('🎲').getAttribute('aria-hidden')).toBe('true');
  });

  it('sem explicação nem ação, mostra só ícone e título', () => {
    const { container } = render(<EmptyState icon="🔎" title="Nada por aqui" />);

    expect(container.querySelector('.empty-text')).toBeNull();
    expect(container.querySelector('.empty-action')).toBeNull();
  });

  it('dentro de outro cartão (compact) não ganha borda própria', () => {
    const { container, rerender } = render(<EmptyState icon="🔎" title="Vazio" />);
    expect(container.querySelector('.empty-block')?.className).toContain('card');

    rerender(<EmptyState icon="🔎" title="Vazio" compact />);
    expect(container.querySelector('.empty-block')?.className).not.toContain('card');
  });
});
