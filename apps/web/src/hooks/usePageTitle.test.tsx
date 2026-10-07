// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import '../test/renderPage';
import { usePageTitle } from './usePageTitle';

describe('usePageTitle', () => {
  it('põe o título da aba com o nome do app', () => {
    renderHook(() => usePageTitle('Ludoteca'));

    expect(document.title).toBe('Ludoteca · Vamos Jogar');
  });

  it('acompanha a mudança de título (ex.: o evento termina de carregar)', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Evento' },
    });
    expect(document.title).toBe('Evento · Vamos Jogar');

    rerender({ title: 'Noite dos euros' });

    expect(document.title).toBe('Noite dos euros · Vamos Jogar');
  });
});
