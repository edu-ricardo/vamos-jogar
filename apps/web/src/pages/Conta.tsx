import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { groupService } from '../services/groupService';
import toast from 'react-hot-toast';

export const Conta = () => {
  const { user, logout } = useAuth();
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleUpdateNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName: nickname });
      
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
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      
      toast.success('Conta excluída com sucesso.');
      logout();
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        toast.error('Por favor, saia e faça login novamente antes de excluir a conta.');
      } else {
        toast.error('Erro ao excluir conta.');
        console.error(err);
      }
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1>Minha Conta</h1>
      <p style={{ color: '#a1a1aa' }}>Gerencie seu apelido e dados de acesso.</p>

      <section style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginTop: '30px' }}>
        <h2>Perfil</h2>
        <form onSubmit={handleUpdateNickname} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>Apelido nos grupos</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ex: João Boardgamer"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', padding: '10px 20px' }}>
            {loading ? 'Salvando...' : 'Salvar Apelido'}
          </button>
        </form>
      </section>

      <section style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '20px', borderRadius: '12px', marginTop: '30px' }}>
        <h2 style={{ color: '#ef4444', marginTop: 0 }}>Zona de Perigo</h2>
        <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: '20px' }}>
          Ao excluir sua conta, você perderá sua ludoteca cadastrada e será removido dos grupos. Essa ação não pode ser desfeita.
        </p>
        <button onClick={() => setShowDeleteModal(true)} className="btn-danger" style={{ width: '100%', padding: '12px', fontSize: '1rem' }}>
          Excluir Minha Conta
        </button>
      </section>

      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1c1c1f', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center', border: '1px solid #ef4444' }}>
            <h2 style={{ color: '#ef4444', marginTop: 0 }}>Tem certeza?</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '30px' }}>Essa ação é irreversível. Todos os seus dados serão apagados.</p>
            
            <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
              <button onClick={handleDeleteAccount} className="btn-danger" style={{ padding: '12px' }}>
                Sim, excluir minha conta
              </button>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '12px', background: 'transparent', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
