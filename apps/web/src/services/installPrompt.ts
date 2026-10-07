// Convite para instalar o app: quem dispensa não é incomodado de novo por este tempo
export const INSTALL_DISMISS_DAYS = 30;
export const INSTALL_DISMISS_KEY = 'vamos-jogar:install-dismissed-at';

const DAY_MS = 24 * 60 * 60 * 1000;

// Dispensado há menos de INSTALL_DISMISS_DAYS dias (data inválida conta como não dispensado)
export const isInstallDismissed = (dismissedAt: string | null, now: Date): boolean => {
  if (!dismissedAt) return false;
  const when = Date.parse(dismissedAt);
  return !Number.isNaN(when) && now.getTime() - when < INSTALL_DISMISS_DAYS * DAY_MS;
};

export type InstallMode = 'native' | 'ios';

// Como convidar: o navegador oferece a instalação (native), é iPhone/iPad e precisa de instruções
// (ios), ou não há o que oferecer (null: já instalado, ou navegador sem suporte)
export const installMode = ({
  standalone,
  apple,
  hasNativePrompt,
}: {
  standalone: boolean;
  apple: boolean;
  hasNativePrompt: boolean;
}): InstallMode | null => {
  if (standalone) return null;
  if (hasNativePrompt) return 'native';
  return apple ? 'ios' : null;
};

// O armazenamento pode estar bloqueado (aba privada, política do navegador): nada aqui deve quebrar
export const readInstallDismissedAt = (storage: Storage | undefined): string | null => {
  try {
    return storage?.getItem(INSTALL_DISMISS_KEY) ?? null;
  } catch {
    return null;
  }
};

export const writeInstallDismissedAt = (storage: Storage | undefined, now: Date): void => {
  try {
    storage?.setItem(INSTALL_DISMISS_KEY, now.toISOString());
  } catch {
    // sem armazenamento: o convite volta na próxima visita, sem problema
  }
};
