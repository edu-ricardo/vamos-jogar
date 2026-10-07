// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../test/renderPage';
import { Skeleton, SkeletonCard, SkeletonGrid, SkeletonRegion, SkeletonRows } from './Skeleton';

describe('Skeleton', () => {
  it('o bloco é só decoração: escondido dos leitores de tela', () => {
    const { container } = render(<Skeleton variant="title" />);

    expect(container.querySelector('.skeleton-title')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('a área que carrega se anuncia como ocupada, com o rótulo para leitores de tela', () => {
    render(
      <SkeletonRegion label="Carregando eventos">
        <Skeleton />
      </SkeletonRegion>,
    );

    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Carregando eventos').className).toContain('visually-hidden');
  });

  it('lista de linhas: a quantidade pedida, com ou sem capa', () => {
    const { container, rerender } = render(<SkeletonRows label="Carregando" rows={4} />);
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(4);
    expect(container.querySelectorAll('.skeleton-thumb')).toHaveLength(4);

    rerender(<SkeletonRows label="Carregando" rows={2} thumb={false} />);
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(2);
    expect(container.querySelectorAll('.skeleton-thumb')).toHaveLength(0);
  });

  it('grade de cartões: a quantidade pedida (padrão 6)', () => {
    const { container, rerender } = render(<SkeletonGrid label="Carregando" />);
    expect(container.querySelectorAll('.skeleton-tile')).toHaveLength(6);

    rerender(<SkeletonGrid label="Carregando" count={3} />);
    expect(container.querySelectorAll('.skeleton-tile')).toHaveLength(3);
  });

  it('cartão: título e as linhas pedidas, a última mais curta', () => {
    const { container } = render(<SkeletonCard label="Carregando" lines={3} />);

    expect(container.querySelectorAll('.skeleton-title')).toHaveLength(1);
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(2);
    expect(container.querySelectorAll('.skeleton-short')).toHaveLength(1);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
