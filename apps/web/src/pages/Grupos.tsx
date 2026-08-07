import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService, type Group } from '../services/groupService';
import toast from 'react-hot-toast';

export const Grupos = () => {
  const { user } = useAuth();
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

  const copyInviteLink = (e: React.MouseEvent, token: string) => {
    e.stopPropagation(); // Previne clicar no card e entrar no grupo ao mesmo tempo
    const link = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado!');
  };

  return (
    <div>
      <h1 style={{ marginBottom: '20px' }}>Grupos</h1>

      <section style={{ marginBottom: '30px' }}>
        <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Nome do novo grupo..." 
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: '#fff' }}
          />
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1rem', background: 'transparent', border: '1px solid #7e22ce' }}>
            Criar Grupo
          </button>
        </form>
      </section>

      <section>
        {loading ? <p>Carregando grupos...</p> : groups.length === 0 ? (
          <p style={{ color: '#a1a1aa', textAlign: 'center' }}>Você ainda não participa de nenhum grupo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {groups.map(g => (
              <div 
                key={g.id} 
                onClick={() => navigate(`/group/${g.id}`)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '20px', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid #333', 
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{g.name}</h3>
                  <small style={{ color: '#a1a1aa' }}>{g.adminId === user?.uid ? 'Você é o admin' : 'Membro'}</small>
                </div>
                <div>
                  {g.adminId === user?.uid && (
                    <button 
                      onClick={(e) => copyInviteLink(e, g.inviteToken)} 
                      style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #71717a', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Copiar Convite
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
