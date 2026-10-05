import { randomInt } from 'crypto';

// APP_ADMIN_EMAILS="a@x.com, b@y.com": admins fixos, que o painel não consegue remover
export const parseAdminEmails = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// Sem caracteres que se confundem ao ditar ou ler (0/O, 1/l/I)
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateTemporaryPassword = (length = 12): string =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
