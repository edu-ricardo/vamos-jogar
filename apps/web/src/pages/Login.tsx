import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Login.scss';

export const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao logar com Google.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <h1>Vamos Jogar</h1>
          <p>{isRegister ? 'Crie sua conta para organizar jogatinas.' : 'Organize suas jogatinas de tabuleiro de forma épica.'}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {errorMsg && <div className="error-message">{errorMsg}</div>}
          
          <div className="input-group">
            <label>E-mail</label>
            <input 
              type="email" 
              placeholder="seu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Aguarde...' : (isRegister ? 'Cadastrar' : 'Entrar')}
          </button>
          
          <div className="toggle-mode">
            <p>
              {isRegister ? 'Já tem uma conta?' : 'Não possui uma conta?'}
              <button 
                type="button" 
                className="btn-link" 
                onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? 'Faça Login' : 'Cadastre-se'}
              </button>
            </p>
          </div>

          <div className="divider">
            <span>ou</span>
          </div>
          
          <button type="button" className="btn-google" onClick={handleGoogleLogin}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.8 15.71 17.58V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
              <path d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.58C14.73 18.24 13.46 18.63 12 18.63C9.17 18.63 6.77 16.71 5.9 14.14H2.22V16.99C4.02 20.57 7.71 23 12 23Z" fill="#34A853"/>
              <path d="M5.9 14.14C5.68 13.48 5.55 12.76 5.55 12C5.55 11.24 5.68 10.52 5.9 9.86V7.01H2.22C1.47 8.5 1.05 10.2 1.05 12C1.05 13.8 1.47 15.5 2.22 16.99L5.9 14.14Z" fill="#FBBC05"/>
              <path d="M12 5.38C13.62 5.38 15.06 5.93 16.2 7.02L19.36 3.86C17.46 2.09 14.97 1 12 1C7.71 1 4.02 3.43 2.22 7.01L5.9 9.86C6.77 7.29 9.17 5.38 12 5.38Z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>
        </form>
      </div>
    </div>
  );
};
