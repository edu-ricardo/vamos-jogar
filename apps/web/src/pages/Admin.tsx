import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  adminService,
  type AdminEvent,
  type AdminGroup,
  type AdminLog,
  type AdminUser,
} from '../services/adminService';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { EVENT_STATUS_LABEL } from '../services/eventResults';
import './Admin.scss';

type Tab = 'users' | 'groups' | 'events' | 'logs';

const ACTION_LABEL: Record<string, string> = {
  senha_temporaria: 'Senha temporária gerada',
  admin_concedido: 'Acesso de admin concedido',
  admin_removido: 'Acesso de admin removido',
  conta_excluida: 'Conta excluída',
  grupo_novo_admin: 'Novo admin de grupo',
  membro_removido: 'Membro removido de grupo',
  cobranca_enviada: 'Cobrança de votos enviada',
};

const formatDateTime = (iso: string) =>
  new Date(iso.replace(' ', 'T')).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

// Ações que pedem confirmação antes de ir para a API
type PendingAction =
  | { kind: 'password'; user: AdminUser }
  | { kind: 'delete'; user: AdminUser }
  | { kind: 'removeMember'; group: AdminGroup; member: { id: string; name: string } };

export const Admin = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; password: string }>();
  const [busy, setBusy] = useState(false);

  const load = async (current: Tab = tab) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      if (current === 'users') setUsers(await adminService.listUsers(token));
      if (current === 'groups') setGroups(await adminService.listGroups(token));
      if (current === 'events') setEvents(await adminService.listEvents(token));
      if (current === 'logs') setLogs(await adminService.listLogs(token));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab, user]);

  // Executa a ação, avisa o resultado e recarrega a aba
  const run = async (action: (token: string) => Promise<unknown>, success: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await action(await user.getIdToken());
      if (success) toast.success(success);
      setPending(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === 'password') {
      const target = pending.user;
      return run(async (token) => {
        const password = await adminService.setTemporaryPassword(token, target.id);
        setTemporaryPassword({ email: target.email, password });
      }, '');
    }
    if (pending.kind === 'delete') {
      return run((token) => adminService.deleteUser(token, pending.user.id), 'Conta excluída.');
    }
    return run(
      (token) => adminService.removeMember(token, pending.group.id, pending.member.id),
      'Membro removido.',
    );
  };

  const visibleUsers = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Administração</h1>
          <p className="muted">Usuários, grupos e o registro das ações feitas aqui.</p>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Seções">
        {(
          [
            ['users', 'Usuários'],
            ['groups', 'Grupos'],
            ['events', 'Eventos'],
            ['logs', 'Registro'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="card empty-state">{error}</p>
      ) : loading ? (
        <SkeletonRows label="Carregando" rows={4} thumb={false} />
      ) : tab === 'users' ? (
        <section>
          <input
            type="search"
            className="admin-filter"
            placeholder="Buscar por nome ou e-mail..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className="admin-list">
            {visibleUsers.map((u) => (
              <li key={u.id} className="card admin-user">
                <div className="admin-user-info">
                  <strong>
                    {u.name || 'Sem nome'}
                    {u.admin && (
                      <span className="chip">{u.admin === 'fixed' ? 'admin fixo' : 'admin'}</span>
                    )}
                  </strong>
                  <span className="muted">{u.email}</span>
                  <small className="muted">
                    {u.providers.includes('google') ? 'Google' : 'E-mail e senha'} · desde{' '}
                    {formatDateTime(u.created)}
                  </small>
                </div>
                <dl className="admin-user-stats">
                  <div>
                    <dt>Grupos</dt>
                    <dd>{u.groups}</dd>
                  </div>
                  <div>
                    <dt>Jogos</dt>
                    <dd>{u.games}</dd>
                  </div>
                  <div>
                    <dt>Notificações</dt>
                    <dd>{u.pushDevices > 0 ? `${u.pushDevices} aparelho(s)` : 'não'}</dd>
                  </div>
                </dl>
                <div className="admin-user-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setPending({ kind: 'password', user: u })}
                  >
                    Senha temporária
                  </button>
                  {u.admin !== 'fixed' && u.id !== user?.uid && (
                    <button
                      className="btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          (token) => adminService.setAdmin(token, u.id, !u.admin),
                          u.admin ? 'Acesso de admin removido.' : 'Acesso de admin concedido.',
                        )
                      }
                    >
                      {u.admin ? 'Remover admin' : 'Tornar admin'}
                    </button>
                  )}
                  {u.id !== user?.uid && (
                    <button
                      className="btn-link admin-danger"
                      onClick={() => setPending({ kind: 'delete', user: u })}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : tab === 'groups' ? (
        <ul className="admin-groups">
          {groups.length === 0 && <EmptyState icon="👥" title="Nenhum grupo criado." compact />}
          {groups.map((g) => (
            <li key={g.id} className="card">
              <h3>{g.name}</h3>
              <p className="muted">
                {g.members.length} membro(s) · {g.events} evento(s)
              </p>
              <ul className="admin-members">
                {g.members.map((m) => (
                  <li key={m.id}>
                    <span>
                      {m.name}
                      {m.id === g.adminId && <span className="chip">admin do grupo</span>}
                    </span>
                    {m.id !== g.adminId && (
                      <span className="admin-member-actions">
                        <button
                          className="btn-link"
                          disabled={busy}
                          onClick={() =>
                            run(
                              (token) => adminService.transferGroupAdmin(token, g.id, m.id),
                              `${m.name} agora é admin de ${g.name}.`,
                            )
                          }
                        >
                          Tornar admin
                        </button>
                        <button
                          className="btn-link admin-danger"
                          onClick={() => setPending({ kind: 'removeMember', group: g, member: m })}
                        >
                          Remover
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : tab === 'events' ? (
        <ul className="admin-list">
          {events.length === 0 && (
            <EmptyState icon="🗓️" title="Nenhum evento em votação no momento." compact />
          )}
          {events.map((ev) => (
            <li key={ev.id} className="card admin-event">
              <div className="admin-user-info">
                <strong>
                  {ev.title}
                  <span className="chip">{EVENT_STATUS_LABEL[ev.status]}</span>
                </strong>
                <span className="muted">{ev.groupName}</span>
                <small className="muted">
                  {ev.pendingNames.length === 0
                    ? 'Todo mundo já votou.'
                    : `Falta votar: ${ev.pendingNames.join(', ')}`}
                  {ev.lastReminderSentAt &&
                    ` · último lembrete em ${formatDateTime(ev.lastReminderSentAt)}`}
                </small>
              </div>
              <button
                className="btn-secondary btn-sm"
                disabled={busy || ev.pendingNames.length === 0}
                onClick={() =>
                  run(async (token) => {
                    toast.success(await adminService.remindEvent(token, ev.id));
                  }, '')
                }
              >
                Cobrar quem não votou
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="card">
          {logs.length === 0 ? (
            <EmptyState icon="📋" title="Nenhuma ação registrada ainda." compact />
          ) : (
            <ul className="admin-logs">
              {logs.map((l) => (
                <li key={l.id}>
                  <time className="muted">{formatDateTime(l.created)}</time>
                  <div>
                    <strong>{ACTION_LABEL[l.action] ?? l.action}</strong>
                    <span>{l.details}</span>
                    <small className="muted">por {l.actorEmail}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pending && (
        <Modal
          title={
            pending.kind === 'password'
              ? 'Gerar senha temporária?'
              : pending.kind === 'delete'
                ? 'Excluir esta conta?'
                : 'Remover do grupo?'
          }
          size="sm"
          onClose={() => setPending(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button
                className={pending.kind === 'password' ? 'btn-primary' : 'btn-danger'}
                disabled={busy}
                onClick={confirmPending}
              >
                {pending.kind === 'password' ? 'Gerar senha' : 'Confirmar'}
              </button>
            </>
          }
        >
          <p className="muted">
            {pending.kind === 'password'
              ? `${pending.user.email} passa a entrar com uma senha nova, mostrada só uma vez. As sessões abertas dessa pessoa são encerradas.`
              : pending.kind === 'delete'
                ? `${pending.user.email} perde a ludoteca e sai dos grupos (grupos em que é admin passam ao membro mais antigo). Não pode ser desfeito.`
                : `${pending.member.name} sai de ${pending.group.name}.`}
          </p>
        </Modal>
      )}

      {temporaryPassword && (
        <Modal
          title="Senha temporária"
          size="sm"
          onClose={() => setTemporaryPassword(undefined)}
          footer={
            <button className="btn-primary" onClick={() => setTemporaryPassword(undefined)}>
              Pronto
            </button>
          }
        >
          <p className="muted">
            Passe para {temporaryPassword.email}. Ela não aparece de novo: depois de entrar com
            e-mail e esta senha, a pessoa troca em Conta → Trocar senha.
          </p>
          <div className="admin-password">
            <code>{temporaryPassword.password}</code>
            <button
              className="btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(temporaryPassword.password);
                toast.success('Senha copiada.');
              }}
            >
              Copiar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
