import { describe, expect, it } from 'vitest';
import { TONE_COUNT, initialsOf, toneOf } from './avatar';

describe('initialsOf (pessoa)', () => {
  it('primeira e última inicial; nome único dá uma letra só', () => {
    expect(initialsOf('Ana Souza')).toBe('AS');
    expect(initialsOf('Maria Clara de Souza')).toBe('MS');
    expect(initialsOf('Edu')).toBe('E');
  });

  it('maiúscula, acento e espaços sobrando', () => {
    expect(initialsOf('  álvaro   moreira ')).toBe('ÁM');
    expect(initialsOf('édson')).toBe('É');
  });

  it('ignora símbolos soltos e usa números', () => {
    expect(initialsOf('(Zé) -Silva')).toBe('ZS');
    expect(initialsOf('- ! ?')).toBe('?');
  });

  it('sem nome devolve ?', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('initialsOf (jogo)', () => {
  it('primeira letra das duas primeiras palavras', () => {
    expect(initialsOf('7 Wonders Duel', 'game')).toBe('7W');
    expect(initialsOf('Ticket to Ride', 'game')).toBe('TT');
    expect(initialsOf('Catan', 'game')).toBe('C');
  });

  it('o mesmo nome dá iniciais diferentes para pessoa e para jogo quando tem 3 palavras', () => {
    expect(initialsOf('Ticket to Ride')).toBe('TR');
    expect(initialsOf('Ticket to Ride', 'game')).toBe('TT');
  });
});

describe('toneOf', () => {
  it('é estável: o mesmo nome sempre dá a mesma cor, dentro da faixa', () => {
    const tone = toneOf('Ana Souza');
    expect(toneOf('Ana Souza')).toBe(tone);
    expect(tone).toBeGreaterThanOrEqual(0);
    expect(tone).toBeLessThan(TONE_COUNT);
  });

  it('maiúsculas, acentos e espaços nas pontas não mudam a cor', () => {
    expect(toneOf('  ÁLVARO ')).toBe(toneOf('alvaro'));
    expect(toneOf('CATAN')).toBe(toneOf('Catan'));
  });

  it('espalha nomes diferentes por várias cores', () => {
    const names = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu', 'Fabi', 'Gui', 'Helena', 'Iago', 'Jana'];
    const tones = new Set(names.map(toneOf));
    expect(tones.size).toBeGreaterThanOrEqual(4);
  });

  it('nome vazio também tem uma cor válida', () => {
    expect(toneOf('')).toBeGreaterThanOrEqual(0);
  });
});
