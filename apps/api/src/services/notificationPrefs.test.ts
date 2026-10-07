import { describe, expect, it } from 'vitest';
import { parsePrefsChange, resolvePrefs } from './notificationPrefs';

describe('resolvePrefs', () => {
  it('sem nada guardado, tudo ligado', () => {
    expect(resolvePrefs(null)).toEqual({
      created: true,
      date_set: true,
      confirmed: true,
      eve: true,
      reminder: true,
    });
    expect(resolvePrefs(undefined)).toEqual(resolvePrefs({}));
  });

  it('só o que foi desligado de verdade fica desligado; lixo é ignorado', () => {
    expect(resolvePrefs({ eve: false, created: 'não', outra: false, confirmed: 0 })).toEqual({
      created: true,
      date_set: true,
      confirmed: true,
      eve: false,
      reminder: true,
    });
    expect(resolvePrefs('texto')).toEqual(resolvePrefs({}));
  });
});

describe('parsePrefsChange', () => {
  it('aceita só chaves conhecidas com verdadeiro ou falso', () => {
    expect(parsePrefsChange({ eve: false, reminder: true, qualquer: 1 })).toEqual({
      eve: false,
      reminder: true,
    });
  });

  it('recusa valor que não é booleano, corpo vazio ou sem chave conhecida', () => {
    expect(parsePrefsChange({ eve: 'sim' })).toBeNull();
    expect(parsePrefsChange({})).toBeNull();
    expect(parsePrefsChange({ qualquer: true })).toBeNull();
    expect(parsePrefsChange(null)).toBeNull();
    expect(parsePrefsChange('texto')).toBeNull();
  });
});
