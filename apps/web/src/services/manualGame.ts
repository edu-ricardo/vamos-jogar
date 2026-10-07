// Jogo cadastrado à mão (quando a Ludopedia e o BGG não têm): id próprio, sem fonte externa
export const MANUAL_GAME_PREFIX = 'manual-';

export const isManualGame = (gameId: string): boolean => gameId.startsWith(MANUAL_GAME_PREFIX);

export const newManualGameId = (): string =>
  `${MANUAL_GAME_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
