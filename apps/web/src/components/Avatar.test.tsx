// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '../test/renderPage';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('mostra as iniciais da pessoa e é só enfeite para leitores de tela', () => {
    const { container } = render(<Avatar name="Ana Souza" />);
    const avatar = container.querySelector('.avatar')!;

    expect(avatar.textContent).toBe('AS');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
  });

  it('tamanhos xs, sm e md (padrão)', () => {
    const { container, rerender } = render(<Avatar name="Edu" />);
    expect(container.querySelector('.avatar-md')).toBeTruthy();

    rerender(<Avatar name="Edu" size="xs" />);
    expect(container.querySelector('.avatar-xs')).toBeTruthy();
    rerender(<Avatar name="Edu" size="sm" />);
    expect(container.querySelector('.avatar-sm')).toBeTruthy();
  });

  it('a mesma pessoa tem sempre a mesma cor, mesmo escrita de outro jeito', () => {
    const tone = (name: string) =>
      render(<Avatar name={name} />)
        .container.querySelector('.avatar')!
        .className.match(/tone-\d/)![0];

    expect(tone('Edu')).toBe(tone('EDU'));
    expect(tone('Ana')).toMatch(/^tone-[0-7]$/);
  });

  it('sem nome mostra ?', () => {
    const { container } = render(<Avatar name="" />);
    expect(container.querySelector('.avatar')!.textContent).toBe('?');
  });
});
