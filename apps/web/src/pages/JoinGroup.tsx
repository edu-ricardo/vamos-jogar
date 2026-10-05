import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { ApiError } from '../services/apiClient';
import './JoinGroup.scss';

export const JoinGroup = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processando convite...');

  useEffect(() => {
    const joinGroup = async () => {
      if (!user) return;
      if (!token) {
        setStatus('Token inválido.');
        return;
      }

      try {
        const data = await groupService.joinGroup(token, await user.getIdToken());
        setStatus(`Sucesso! Você entrou no grupo ${data.groupName}. Redirecionando...`);
        setTimeout(() => navigate('/'), 2000);
      } catch (err) {
        if (err instanceof ApiError) {
          setStatus(`Erro: ${err.message}`);
        } else {
          setStatus('Erro ao conectar ao servidor.');
          console.error(err);
        }
      }
    };

    joinGroup();
  }, [user, token, navigate]);

  return (
    <div className="join-group">
      <div className="card">
        <h2>Entrando no grupo</h2>
        <p className="muted">{status}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Voltar ao início
        </button>
      </div>
    </div>
  );
};
