import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  NOTIFICATION_KIND_LABELS,
  notificationService,
  type NotificationKind,
  type NotificationPrefs,
  type NotificationStatus,
} from '../services/notificationService';
import './NotificationSettings.scss';

const EXPLANATION: Record<NotificationStatus, string> = {
  enabled: 'Este aparelho recebe os lembretes quando falta o seu voto em um evento.',
  disabled: 'Ative para receber neste aparelho um lembrete quando faltar o seu voto em um evento.',
  denied:
    'As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.',
  'install-required':
    'No iPhone e no iPad, as notificações só funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de Início e abra o Vamos Jogar por lá.',
  unsupported:
    'Este navegador não recebe notificações. Tente pelo Chrome, Edge, Firefox ou Safari.',
};

export const NotificationSettings = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    notificationService.getStatus().then(setStatus, () => setStatus('unsupported'));
  }, []);

  // As preferências são da pessoa (valem em todos os aparelhos), não deste aparelho
  useEffect(() => {
    if (!user) return;
    user
      .getIdToken()
      .then(notificationService.getPreferences)
      .then(setPrefs, () => setPrefs(null));
  }, [user]);

  const changePreference = async (kind: NotificationKind, enabled: boolean) => {
    if (!user || !prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [kind]: enabled });
    try {
      setPrefs(
        await notificationService.setPreferences(await user.getIdToken(), { [kind]: enabled }),
      );
    } catch (err) {
      setPrefs(previous);
      toast.error((err as Error).message || 'Erro ao salvar a preferência.');
    }
  };

  const toggle = async () => {
    if (!user || !status) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const next =
        status === 'enabled'
          ? await notificationService.disable(idToken)
          : await notificationService.enable(idToken);
      setStatus(next);
      if (next === 'enabled') toast.success('Notificações ativadas neste aparelho.');
      else if (status === 'enabled') toast.success('Notificações desativadas neste aparelho.');
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || 'Erro ao alterar as notificações.');
    } finally {
      setBusy(false);
    }
  };

  const canToggle = status === 'enabled' || status === 'disabled';

  return (
    <section className="card">
      <h2>Notificações</h2>
      <p className="muted">{status ? EXPLANATION[status] : 'Verificando este aparelho...'}</p>
      {canToggle && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={status === 'enabled' ? 'btn-secondary' : 'btn-primary'}
        >
          {busy
            ? 'Aguarde...'
            : status === 'enabled'
              ? 'Desativar neste aparelho'
              : 'Ativar notificações'}
        </button>
      )}
      {prefs && (
        <fieldset className="notification-prefs">
          <legend>Quais avisos você quer receber (vale para todos os seus aparelhos)</legend>
          {(Object.keys(NOTIFICATION_KIND_LABELS) as NotificationKind[]).map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={prefs[kind]}
                onChange={(e) => changePreference(kind, e.target.checked)}
              />
              {NOTIFICATION_KIND_LABELS[kind]}
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
};
