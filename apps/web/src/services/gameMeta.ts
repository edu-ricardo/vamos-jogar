interface GameMetaSource {
  playtime?: string;
  minPlayers?: number | string;
  maxPlayers?: number | string;
}

// "⏱ 60 min · 👥 3-4": o que se sabe do jogo, sem lacunas (vazio se não se sabe nada)
export const gameMeta = ({ playtime, minPlayers, maxPlayers }: GameMetaSource): string =>
  [
    playtime && `⏱ ${playtime} min`,
    (minPlayers || maxPlayers) &&
      `👥 ${minPlayers || '?'}${maxPlayers && maxPlayers !== minPlayers ? `-${maxPlayers}` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');
