import { Request, Response } from 'express';
import { getGameProvider, type GameType } from '../services/games';

export const searchGames = async (req: Request, res: Response) => {
  const { query, source, gameType = 'base', baseGameId } = req.query;

  if (!query && !baseGameId) {
    return res.status(400).json({ error: 'Parâmetro query ou baseGameId é obrigatório.' });
  }

  try {
    const games = await getGameProvider(source).search({
      query: query as string | undefined,
      gameType: gameType as GameType,
      baseGameId: baseGameId as string | undefined,
    });
    return res.json({ games });
  } catch (error: any) {
    console.error('Erro na integração de APIs de Jogos:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar jogos externos' });
  }
};

export const getGameDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { source } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID do jogo é obrigatório.' });
  }

  try {
    const game = await getGameProvider(source).getDetails(id as string);
    if (!game) return res.status(404).json({ error: 'Jogo não encontrado no BGG' });
    return res.json({ game });
  } catch (error: any) {
    console.error('Erro ao buscar detalhes do jogo:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar detalhes do jogo' });
  }
};
