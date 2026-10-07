// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../test/renderPage';
import { INSTALL_DISMISS_KEY } from '../services/installPrompt';
import { InstallPrompt } from './InstallPrompt';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

const stubDisplayMode = (standalone: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );

// Imita o aviso do navegador de que o app pode ser instalado
const offerInstall = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe('InstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubDisplayMode(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('não aparece enquanto o navegador não oferece a instalação', () => {
    render(<InstallPrompt />);

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('quando o navegador oferece, mostra o convite e segura a barra automática', () => {
    render(<InstallPrompt />);

    const event = offerInstall();

    expect(screen.getByRole('region', { name: 'Instalar o app' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeTruthy();
    expect(event.defaultPrevented).toBe(true);
  });

  it('Instalar abre a instalação do navegador e, aceita, o convite some', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);
    const event = offerInstall('accepted');

    await user.click(screen.getByRole('button', { name: 'Instalar' }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
    // Instalou: não precisa lembrar de dispensar
    expect(window.localStorage.getItem(INSTALL_DISMISS_KEY)).toBeNull();
  });

  it('se a pessoa recusa a janela do navegador, vale como "agora não" por 30 dias', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);
    offerInstall('dismissed');

    await user.click(screen.getByRole('button', { name: 'Instalar' }));

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
    expect(window.localStorage.getItem(INSTALL_DISMISS_KEY)).not.toBeNull();
  });

  it('Agora não esconde o convite e guarda a dispensa', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);
    offerInstall();

    await user.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
    expect(window.localStorage.getItem(INSTALL_DISMISS_KEY)).not.toBeNull();
  });

  it('dispensado recentemente, não volta a aparecer, mesmo com a oferta do navegador', () => {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, new Date().toISOString());
    render(<InstallPrompt />);

    offerInstall();

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('dispensado há mais de 30 dias, convida de novo', () => {
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    window.localStorage.setItem(INSTALL_DISMISS_KEY, old);
    render(<InstallPrompt />);

    offerInstall();

    expect(screen.getByRole('region', { name: 'Instalar o app' })).toBeTruthy();
  });

  it('app já instalado (aberto como app) nunca mostra o convite', () => {
    stubDisplayMode(true);
    render(<InstallPrompt />);

    offerInstall();

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('o aviso de instalação concluída esconde o convite', () => {
    render(<InstallPrompt />);
    offerInstall();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('no iPhone mostra as instruções (sem botão Instalar) e Entendi dispensa', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    render(<InstallPrompt />);

    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
    expect(window.localStorage.getItem(INSTALL_DISMISS_KEY)).not.toBeNull();
  });

  it('no iPhone com o app já na tela inicial, não mostra nada', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    stubDisplayMode(true);
    render(<InstallPrompt />);

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('com o armazenamento bloqueado o convite funciona do mesmo jeito', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(<InstallPrompt />);
    offerInstall();

    await user.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });
});
