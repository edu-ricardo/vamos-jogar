/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// O Vitest esvazia arquivos de estilo importados; por isso o CSS e o HTML são lidos do disco
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8');
const scss = read('./styles/variables.scss');
const html = read('../index.html');

// Guarda de acessibilidade: lê os tokens de cor do CSS e confere o contraste mínimo do WCAG AA
// (4,5:1 para texto) nos dois temas. Se alguém trocar uma cor e piorar a leitura, o teste falha.

type RGB = [number, number, number];

const tokensOf = (block: string): Record<string, string> =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );

const rootTokens = tokensOf(scss.match(/:root\s*\{([\s\S]*?)\n\}/)![1]);
const lightTokens = tokensOf(
  scss.match(/prefers-color-scheme: light\)\s*\{\s*:root\s*\{([\s\S]*?)\n {2}\}/)![1],
);
const THEMES: Record<string, Record<string, string>> = {
  escuro: rootTokens,
  claro: { ...rootTokens, ...lightTokens },
};

// "#rrggbb" ou "rgba(r, g, b, a)"
const parse = (value: string): { rgb: RGB; alpha: number } => {
  if (value.startsWith('#')) {
    return {
      rgb: [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as RGB,
      alpha: 1,
    };
  }
  const [r, g, b, a = '1'] = value.match(/[\d.]+/g)!;
  return { rgb: [Number(r), Number(g), Number(b)], alpha: Number(a) };
};

// A cor (com transparência) sobre um fundo opaco
const over = (value: string, background: RGB, alpha?: number): RGB => {
  const { rgb, alpha: own } = parse(value);
  const a = alpha ?? own;
  return rgb.map((c, i) => Math.round(c * a + background[i] * (1 - a))) as RGB;
};

const luminance = ([r, g, b]: RGB) => {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrast = (a: RGB, b: RGB) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const AA = 4.5;

describe('contraste dos temas (WCAG AA, 4,5:1)', () => {
  for (const [theme, t] of Object.entries(THEMES)) {
    const solid = (name: string) => parse(t[name]).rgb;

    describe(theme, () => {
      const backgrounds = ['bg-primary', 'bg-secondary', 'bg-tertiary'];

      it.each(
        backgrounds.flatMap((bg) =>
          ['text-primary', 'text-secondary', 'accent-primary'].map((fg) => [fg, bg]),
        ),
      )('%s sobre %s', (fg, bg) => {
        expect(contrast(solid(fg), solid(bg))).toBeGreaterThanOrEqual(AA);
      });

      it.each([['success'], ['danger'], ['warning']])(
        '%s sobre o fundo da página e do cartão',
        (fg) => {
          expect(contrast(solid(fg), solid('bg-primary'))).toBeGreaterThanOrEqual(AA);
          expect(contrast(solid(fg), solid('bg-secondary'))).toBeGreaterThanOrEqual(AA);
        },
      );

      it.each([['accent-primary'], ['accent-hover'], ['success']])(
        'texto dos botões (btn-text) sobre %s',
        (bg) => {
          expect(contrast(solid('btn-text'), solid(bg))).toBeGreaterThanOrEqual(AA);
        },
      );

      it('chips: destaque sobre o próprio fundo translúcido, no cartão', () => {
        const chip = over(t['accent-primary-transparent'], solid('bg-secondary'));
        expect(contrast(solid('accent-primary'), chip)).toBeGreaterThanOrEqual(AA);
      });

      it('chip de aviso (16% da cor do aviso) e botão de perigo (fundo suave)', () => {
        const warning = over(t.warning, solid('bg-secondary'), 0.16);
        expect(contrast(solid('warning'), warning)).toBeGreaterThanOrEqual(AA);

        const danger = over(t['danger-soft'], solid('bg-secondary'));
        expect(contrast(solid('danger'), danger)).toBeGreaterThanOrEqual(AA);
      });
    });
  }
});

describe('idioma do documento', () => {
  it('declara português do Brasil, para leitores de tela lerem com a pronúncia certa', () => {
    expect(html).toContain('<html lang="pt-BR">');
  });
});
