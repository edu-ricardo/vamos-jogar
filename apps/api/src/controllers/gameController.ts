import { Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

export const searchGames = async (req: Request, res: Response) => {
  const { query, source } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Parâmetro query é obrigatório.' });
  }

  try {
    if (source === 'bgg') {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      
      const searchRes = await axios.get(`https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`);
      const searchData = parser.parse(searchRes.data);
      
      let items = searchData.items?.item || [];
      if (!Array.isArray(items)) items = [items];
      
      const topItems = items.slice(0, 10);
      if (topItems.length === 0) return res.json({ games: [] });
      
      const games = topItems.map((item: any) => ({
        id: `bgg-${item.id}`,
        sourceId: item.id,
        name: Array.isArray(item.name) ? item.name[0]?.value : item.name?.value,
        image: '' // A busca básica do BGG XML2 não retorna thumb, pegaremos no details
      }));

      return res.json({ games });
    } else {
      const token = process.env.LUDOPEDIA_ACCESS_TOKEN;
      const response = await axios.get(`https://ludopedia.com.br/api/v1/jogos?search=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const games = (response.data.jogos || []).map((jogo: any) => ({
        id: `ludo-${jogo.id_jogo}`,
        sourceId: jogo.id_jogo,
        name: jogo.nm_jogo,
        image: jogo.thumb || jogo.link_imagem || ''
      }));

      return res.json({ games });
    }
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
    if (source === 'bgg') {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      // Remover o prefixo 'bgg-' caso tenha vindo junto
      const cleanId = id.replace('bgg-', '');
      
      const detailsRes = await axios.get(`https://boardgamegeek.com/xmlapi2/thing?id=${cleanId}`);
      const detailsData = parser.parse(detailsRes.data);
      
      let item = detailsData.items?.item;
      if (!item) return res.status(404).json({ error: 'Jogo não encontrado no BGG' });
      
      const gameDetails = {
        id: `bgg-${item.id}`,
        sourceId: item.id,
        name: Array.isArray(item.name) ? item.name[0]?.value : item.name?.value,
        image: item.image || item.thumbnail || '',
        description: item.description || '',
        playtime: item.playingtime?.value || 'N/A'
      };

      return res.json({ game: gameDetails });
    } else {
      const token = process.env.LUDOPEDIA_ACCESS_TOKEN;
      const cleanId = id.replace('ludo-', '');

      const response = await axios.get(`https://ludopedia.com.br/api/v1/jogos/${cleanId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const jogo = response.data.jogo || response.data;

      const gameDetails = {
        id: `ludo-${jogo.id_jogo}`,
        sourceId: jogo.id_jogo,
        name: jogo.nm_jogo,
        image: jogo.link_imagem || jogo.thumb || '',
        description: jogo.ds_jogo || '',
        playtime: jogo.vl_tempo_jogo || 'N/A'
      };

      return res.json({ game: gameDetails });
    }
  } catch (error: any) {
    console.error('Erro ao buscar detalhes do jogo:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar detalhes do jogo' });
  }
};
