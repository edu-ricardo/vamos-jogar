import { describe, it, expect } from 'vitest';
import { parseServiceAccount } from './serviceAccount';

describe('parseServiceAccount', () => {
  it('sem valor, deixa o SDK usar GOOGLE_APPLICATION_CREDENTIALS', () => {
    expect(parseServiceAccount(undefined)).toBeUndefined();
    expect(parseServiceAccount('  ')).toBeUndefined();
  });

  it('lê o JSON em uma linha', () => {
    expect(parseServiceAccount('{"project_id":"p","client_email":"a@b"}')).toEqual({
      project_id: 'p',
      client_email: 'a@b',
    });
  });

  // Caso real: JSON colado em várias linhas no env_file, que só lê a primeira ("{")
  it('JSON quebrado gera erro explicando a causa e a alternativa', () => {
    expect(() => parseServiceAccount('{')).toThrow(
      /FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido.*GOOGLE_APPLICATION_CREDENTIALS/,
    );
  });
});
