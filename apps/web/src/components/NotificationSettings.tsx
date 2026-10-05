import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { notificationService, type NotificationStatus } from '../services/notificationService';

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

  useEffect(() => {
    notificationService.getStatus().then(setStatus, () => setStatus('unsupported'));
  }, []);

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
    <section
      style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '20px',
        borderRadius: '12px',
        marginTop: '30px',
      }}
    >
      <h2>Notificações</h2>
      <p style={{ color: '#a1a1aa', marginTop: '10px' }}>
        {status ? EXPLANATION[status] : 'Verificando este aparelho...'}
      </p>
      {canToggle && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={status === 'enabled' ? undefined : 'btn-primary'}
          style={
            status === 'enabled'
              ? {
                  padding: '10px 20px',
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }
              : { padding: '10px 20px' }
          }
        >
          {busy
            ? 'Aguarde...'
            : status === 'enabled'
              ? 'Desativar neste aparelho'
              : 'Ativar notificações'}
        </button>
      )}
    </section>
  );
};
