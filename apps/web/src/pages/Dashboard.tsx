import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService, type Group } from '../services/groupService';
import toast from 'react-hot-toast';

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadGroups = async () => {
    if (!user) return;
    try {
      const fetchedGroups = await groupService.fetchUserGroups(user.uid);
      setGroups(fetchedGroups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [user]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    try {
      await groupService.createGroup(user.uid, newGroupName);
      setNewGroupName('');
      toast.success('Grupo criado com sucesso!');
      loadGroups(); // Refresh
    } catch (err) {
      toast.error("Erro ao criar grupo");
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado!');
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1>Seus Grupos de Jogatina</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button onClick={() => navigate('/ludoteca')} className="btn-primary">Minha Ludoteca</button>
          <button onClick={logout} className="btn-danger">Sair</button>
        </div>
      </header>

      <section style={{ marginBottom: '40px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
        <h2>Criar novo grupo</h2>
        <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <input 
            type="text" 
            placeholder="Nome do grupo..." 
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: '#fff' }}
          />
          <button type="submit" className="btn-primary" style={{ marginTop: 0 }}>Criar</button>
        </form>
      </section>

      <section>
        {loading ? <p>Carregando grupos...</p> : groups.length === 0 ? (
          <p style={{ color: '#a1a1aa' }}>Você ainda não participa de nenhum grupo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(20,20,22,0.8)', border: '1px solid #333', borderRadius: '12px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{g.name}</h3>
                  <small style={{ color: '#a1a1aa' }}>{g.adminId === user?.uid ? 'Você é o admin' : 'Membro'}</small>
                </div>
                <div>
                  {g.adminId === user?.uid && (
                    <button onClick={() => copyInviteLink(g.inviteToken)} className="btn-primary" style={{ padding: '8px 16px', background: 'var(--accent-hover)' }}>
                      Copiar Link Convite
                    </button>
                  )}
                  <button onClick={() => navigate(`/group/${g.id}`)} className="btn-primary" style={{ padding: '8px 16px', marginLeft: '10px' }}>
                    Entrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
