// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import '../test/renderPage';
import { GameCover } from './GameCover';

describe('GameCover', () => {
  it('com imagem mostra a capa, no tamanho pedido e sem texto alternativo (o nome já está ao lado)', () => {
    const { container } = render(
      <GameCover name="Catan" image="capa.jpg" className="game-thumb" />,
    );
    const img = container.querySelector('img')!;

    expect(img.getAttribute('src')).toBe('capa.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.className).toBe('game-thumb');
    expect(container.querySelector('.game-cover')).toBeNull();
  });

  it('sem imagem mostra as iniciais do jogo, em um quadrado colorido do mesmo tamanho', () => {
    const { container } = render(<GameCover name="7 Wonders Duel" className="game-thumb" />);
    const cover = container.querySelector('.game-cover')!;

    expect(cover.textContent).toBe('7W');
    expect(cover.className).toContain('game-thumb');
    expect(cover.className).toMatch(/tone-[0-7]/);
    expect(cover.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('img')).toBeNull();
  });

  it('imagem vazia (texto em branco) também vira iniciais', () => {
    const { container } = render(<GameCover name="Azul" image="" />);

    expect(container.querySelector('.game-cover')!.textContent).toBe('A');
  });

  it('imagem quebrada cai nas iniciais em vez de mostrar o ícone de imagem partida', () => {
    const { container } = render(<GameCover name="Catan" image="quebrada.jpg" />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.game-cover')!.textContent).toBe('C');
  });

  it('quando chega outra imagem, tenta de novo', () => {
    const { container, rerender } = render(<GameCover name="Catan" image="quebrada.jpg" />);
    fireEvent.error(container.querySelector('img')!);

    rerender(<GameCover name="Catan" image="nova.jpg" />);

    expect(container.querySelector('img')!.getAttribute('src')).toBe('nova.jpg');
  });

  it('o mesmo jogo tem sempre a mesma cor', () => {
    const tone = (name: string) =>
      render(<GameCover name={name} />)
        .container.querySelector('.game-cover')!
        .className.match(/tone-\d/)![0];

    expect(tone('Catan')).toBe(tone('CATAN'));
  });
});
