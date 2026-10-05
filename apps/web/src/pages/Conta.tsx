import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { accountService } from '../services/accountService';
import { NotificationSettings } from '../components/NotificationSettings';
import { Modal } from '../components/Modal';
import toast from 'react-hot-toast';
import './Conta.scss';

export const Conta = () => {
  const { user, logout, updateDisplayName, changePassword } = useAuth();
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateDisplayName(nickname);

      const userGroups = await groupService.fetchUserGroups(user.uid);

      const updatePromises = userGroups.map(async (group) => {
        await groupService.updateMemberName(group.id, user.uid, nickname);
      });

      await Promise.all(updatePromises);

      toast.success('Apelido atualizado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao atualizar apelido.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next.length < 8) {
      toast.error('A nova senha precisa de pelo menos 8 caracteres.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error('A confirmação não bate com a nova senha.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Senha alterada.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível trocar a senha. Confira a senha atual.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await accountService.deleteAccount(await user.getIdToken());

      toast.success('Conta excluída com sucesso.');
      logout();
    } catch (err: any) {
      toast.error('Erro ao excluir conta.');
      console.error(err);
    }
  };

  return (
    <div className="conta">
      <header className="page-header">
        <div>
          <h1>Minha conta</h1>
          <p className="muted">Gerencie seu apelido, notificações e dados de acesso.</p>
        </div>
      </header>

      <section className="card">
        <h2>Perfil</h2>
        <form onSubmit={handleUpdateNickname} className="conta-form">
          <div className="field">
            <label htmlFor="nickname">Apelido nos grupos</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ex: João Boardgamer"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar apelido'}
          </button>
        </form>
      </section>

      <NotificationSettings />

      <section className="card">
        <h2>Trocar senha</h2>
        <p className="muted">
          Para quem entra com e-mail e senha ou recebeu uma senha temporária. Quem entra com o
          Google não precisa de senha.
        </p>
        <form onSubmit={handleChangePassword} className="conta-form">
          <div className="field">
            <label htmlFor="current-password">Senha atual</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">Nova senha (mínimo 8 caracteres)</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirme a nova senha</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-secondary" disabled={changingPassword}>
            {changingPassword ? 'Salvando...' : 'Trocar senha'}
          </button>
        </form>
      </section>

      <section className="card conta-danger">
        <h2>Zona de perigo</h2>
        <p>
          Ao excluir sua conta, você perderá sua ludoteca cadastrada e será removido dos grupos.
          Essa ação não pode ser desfeita.
        </p>
        <button onClick={() => setShowDeleteModal(true)} className="btn-danger">
          Excluir minha conta
        </button>
      </section>

      {showDeleteModal && (
        <Modal
          title="Tem certeza?"
          size="sm"
          onClose={() => setShowDeleteModal(false)}
          footer={
            <>
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} className="btn-danger">
                Sim, excluir minha conta
              </button>
            </>
          }
        >
          <p className="muted">Essa ação é irreversível. Todos os seus dados serão apagados.</p>
        </Modal>
      )}
    </div>
  );
};
