import axios from 'axios';
import type { GameProvider, HttpGet } from './GameProvider';
import { LudopediaProvider } from './LudopediaProvider';
import { BggProvider } from './BggProvider';

const httpGet: HttpGet = (url, headers) => axios.get(url, { headers });

const providers: Record<'ludopedia' | 'bgg', GameProvider> = {
  ludopedia: new LudopediaProvider(httpGet, () => process.env.LUDOPEDIA_ACCESS_TOKEN),
  bgg: new BggProvider(httpGet, () => process.env.BGG_API_KEY),
};

// Ludopedia é a fonte padrão, como antes da extração dos providers
export const getGameProvider = (source: unknown): GameProvider =>
  source === 'bgg' ? providers.bgg : providers.ludopedia;

export type { GameType } from './GameProvider';
