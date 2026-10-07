import { useEffect } from 'react';

// Título da aba por página ("Ludoteca · Vamos Jogar"): ajuda quem usa leitor de tela, abas
// abertas e o histórico do navegador a saber onde está
export const usePageTitle = (title: string) => {
  useEffect(() => {
    document.title = `${title} · Vamos Jogar`;
  }, [title]);
};
