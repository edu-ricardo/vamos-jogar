import { useEffect, useState } from 'react';
import { initialsOf, toneOf } from '../services/avatar';
import './GameCover.scss';

interface GameCoverProps {
  name: string;
  // Capa vinda da Ludopedia ou do BGG; pode faltar ou estar quebrada
  image?: string;
  // Classe que define o tamanho (game-thumb, event-game-thumb...)
  className?: string;
}

// Capa do jogo. Sem imagem (ou com a imagem quebrada), vira um quadrado colorido com as iniciais do
// nome, para a lista nunca ficar com buracos cinzas.
export const GameCover = ({ name, image, className = '' }: GameCoverProps) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);

  if (image && !failed) {
    return (
      <img
        src={image}
        alt=""
        className={className}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} game-cover tone-${toneOf(name)}`.trim()} aria-hidden="true">
      {initialsOf(name, 'game')}
    </div>
  );
};
