import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService, type Group } from '../services/groupService';
import toast from 'react-hot-toast';
import './Grupos.scss';

export const Grupos = () => {
  const { user } = useAuth();
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
      await groupService.createGroup(user.uid, newGroupName, user.displayName || undefined);
      setNewGroupName('');
      toast.success('Grupo criado com sucesso!');
      loadGroups(); // Refresh
    } catch (err) {
      toast.error('Erro ao criar grupo');
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado!');
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Grupos</h1>
          <p className="muted">Os grupos com quem você marca jogatinas.</p>
        </div>
      </header>

      <form onSubmit={handleCreateGroup} className="card grupos-create">
        <input
          type="text"
          placeholder="Nome do novo grupo..."
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Criar grupo
        </button>
      </form>

      {loading ? (
        <p className="empty-state">Carregando grupos...</p>
      ) : groups.length === 0 ? (
        <p className="empty-state">Você ainda não participa de nenhum grupo.</p>
      ) : (
        <ul className="grupos-list">
          {groups.map((g) => (
            <li key={g.id} className="card grupos-item">
              <Link to={`/group/${g.id}`} className="grupos-item-link">
                <h3>{g.name}</h3>
                <small className="muted">
                  {g.adminId === user?.uid ? 'Você é o admin' : 'Membro'}
                </small>
              </Link>
              {g.adminId === user?.uid && (
                <button
                  type="button"
                  onClick={() => copyInviteLink(g.inviteToken)}
                  className="btn-secondary btn-sm"
                >
                  Copiar convite
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
