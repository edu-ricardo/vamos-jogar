import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { ApiError } from '../services/apiClient';

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
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(20,20,22,0.8)',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #333',
          textAlign: 'center',
        }}
      >
        <h2>Entrando no Grupo</h2>
        <p style={{ marginTop: '20px', color: '#a1a1aa' }}>{status}</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
          style={{ marginTop: '20px', padding: '10px 20px' }}
        >
          Voltar ao Início
        </button>
      </div>
    </div>
  );
};
