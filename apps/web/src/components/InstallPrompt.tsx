import { useEffect, useState } from 'react';
import { isAppleMobile } from '../services/notificationService';
import {
  installMode,
  isInstallDismissed,
  readInstallDismissedAt,
  writeInstallDismissedAt,
} from '../services/installPrompt';
import './InstallPrompt.scss';

// O evento que o navegador dispara quando o app pode ser instalado (não está nos tipos padrão)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Convida a instalar o app, uma vez e sem insistir: quem dispensa não vê de novo por 30 dias.
// Android e computador: botão que abre a instalação do navegador. iPhone e iPad: instruções.
export const InstallPrompt = () => {
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() =>
    isInstallDismissed(readInstallDismissedAt(window.localStorage), new Date()),
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Guarda o convite para mostrar no nosso botão, em vez da barra automática do navegador
      event.preventDefault();
      setNativePrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setNativePrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const mode = installMode({
    standalone: isStandalone(),
    apple: isAppleMobile(navigator),
    hasNativePrompt: nativePrompt !== null,
  });
  if (!mode || dismissed || installed) return null;

  const dismiss = () => {
    writeInstallDismissedAt(window.localStorage, new Date());
    setDismissed(true);
  };

  const install = async () => {
    if (!nativePrompt) return;
    await nativePrompt.prompt();
    const { outcome } = await nativePrompt.userChoice;
    // O navegador só deixa pedir uma vez por evento
    setNativePrompt(null);
    if (outcome === 'accepted') setInstalled(true);
    else dismiss();
  };

  return (
    <section className="card install-prompt" aria-label="Instalar o app">
      <span className="install-prompt-icon" aria-hidden="true">
        📲
      </span>
      <div className="install-prompt-text">
        <strong>Instale o Vamos Jogar</strong>
        <p className="muted">
          {mode === 'native'
            ? 'Abre mais rápido, fica na sua tela inicial e recebe os avisos como um app.'
            : 'No iPhone ou iPad: toque em Compartilhar e depois em "Adicionar à Tela de Início".'}
        </p>
      </div>
      <div className="install-prompt-actions">
        {mode === 'native' && (
          <button type="button" className="btn-primary btn-sm" onClick={install}>
            Instalar
          </button>
        )}
        <button type="button" className="btn-secondary btn-sm" onClick={dismiss}>
          {mode === 'native' ? 'Agora não' : 'Entendi'}
        </button>
      </div>
    </section>
  );
};
