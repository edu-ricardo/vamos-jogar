import axios from 'axios';
import type { GameProvider, HttpGet } from './GameProvider';
import { LudopediaProvider } from './LudopediaProvider';
import { BggProvider } from './BggProvider';

// Sem limite, uma API externa travada segura a requisição até o nginx desistir (504 sem explicação)
const EXTERNAL_API_TIMEOUT_MS = 15_000;

const httpGet: HttpGet = (url, headers) =>
  axios.get(url, { headers, timeout: EXTERNAL_API_TIMEOUT_MS });

const providers: Record<'ludopedia' | 'bgg', GameProvider> = {
  ludopedia: new LudopediaProvider(httpGet, () => process.env.LUDOPEDIA_ACCESS_TOKEN),
  bgg: new BggProvider(httpGet, () => process.env.BGG_API_KEY),
};

// Ludopedia é a fonte padrão, como antes da extração dos providers
export const getGameProvider = (source: unknown): GameProvider =>
  source === 'bgg' ? providers.bgg : providers.ludopedia;

export type { GameType } from './GameProvider';
