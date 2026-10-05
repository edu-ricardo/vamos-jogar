import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, parseAdminEmails } from './adminRules';

describe('parseAdminEmails', () => {
  it('separa por vírgula, normaliza e ignora vazios', () => {
    expect(parseAdminEmails(' Edu@Exemplo.com, ,bia@x.com ')).toEqual([
      'edu@exemplo.com',
      'bia@x.com',
    ]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe('generateTemporaryPassword', () => {
  it('gera 12 caracteres sem os que se confundem e diferente a cada vez', () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/^[a-hjkmnp-zA-HJ-NP-Z2-9]{12}$/);
    expect(generateTemporaryPassword()).not.toBe(password);
  });
});
