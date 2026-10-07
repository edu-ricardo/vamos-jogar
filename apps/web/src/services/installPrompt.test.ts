import { describe, expect, it, vi } from 'vitest';
import {
  INSTALL_DISMISS_DAYS,
  INSTALL_DISMISS_KEY,
  installMode,
  isInstallDismissed,
  readInstallDismissedAt,
  writeInstallDismissedAt,
} from './installPrompt';

const NOW = new Date('2026-10-10T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe('isInstallDismissed', () => {
  it('nunca dispensado ou data inválida: não está dispensado', () => {
    expect(isInstallDismissed(null, NOW)).toBe(false);
    expect(isInstallDismissed('ontem', NOW)).toBe(false);
  });

  it('dispensado há menos de 30 dias: continua dispensado', () => {
    expect(isInstallDismissed(daysAgo(1), NOW)).toBe(true);
    expect(isInstallDismissed(daysAgo(INSTALL_DISMISS_DAYS - 1), NOW)).toBe(true);
  });

  it('passados os 30 dias, volta a convidar', () => {
    expect(isInstallDismissed(daysAgo(INSTALL_DISMISS_DAYS), NOW)).toBe(false);
    expect(isInstallDismissed(daysAgo(90), NOW)).toBe(false);
  });
});

describe('installMode', () => {
  it('app já instalado (aberto como app): nunca convida', () => {
    expect(installMode({ standalone: true, apple: true, hasNativePrompt: true })).toBeNull();
  });

  it('navegador que oferece a instalação: botão nativo', () => {
    expect(installMode({ standalone: false, apple: false, hasNativePrompt: true })).toBe('native');
  });

  it('iPhone/iPad: instruções; outros navegadores sem suporte: nada', () => {
    expect(installMode({ standalone: false, apple: true, hasNativePrompt: false })).toBe('ios');
    expect(installMode({ standalone: false, apple: false, hasNativePrompt: false })).toBeNull();
  });
});

describe('armazenamento da dispensa', () => {
  it('guarda e lê a data', () => {
    const data: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => (data[k] = v),
    } as unknown as Storage;

    writeInstallDismissedAt(storage, NOW);

    expect(data[INSTALL_DISMISS_KEY]).toBe(NOW.toISOString());
    expect(readInstallDismissedAt(storage)).toBe(NOW.toISOString());
  });

  it('armazenamento bloqueado ou ausente não quebra nada', () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new Error('bloqueado');
      }),
      setItem: vi.fn(() => {
        throw new Error('bloqueado');
      }),
    } as unknown as Storage;

    expect(readInstallDismissedAt(blocked)).toBeNull();
    expect(() => writeInstallDismissedAt(blocked, NOW)).not.toThrow();
    expect(readInstallDismissedAt(undefined)).toBeNull();
    expect(() => writeInstallDismissedAt(undefined, NOW)).not.toThrow();
  });
});
