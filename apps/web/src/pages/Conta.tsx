import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { accountService } from '../services/accountService';
import { NotificationSettings } from '../components/NotificationSettings';
import { Modal } from '../components/Modal';
import toast from 'react-hot-toast';
import './Conta.scss';

export const Conta = () => {
  const { user, logout, updateDisplayName } = useAuth();
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
