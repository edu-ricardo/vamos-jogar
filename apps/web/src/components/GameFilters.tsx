import type { CollectionFilters } from '../services/ludotecaFilters';
import './GameFilters.scss';

// Valores como saem dos campos (texto); toCollectionFilters converte para o filtro de verdade
export interface GameFilterValues {
  text: string;
  players: string;
  playtime: string;
}

export const emptyGameFilters: GameFilterValues = { text: '', players: '', playtime: '' };

export const toCollectionFilters = (values: GameFilterValues): CollectionFilters => ({
  text: values.text,
  players: Number(values.players) || undefined,
  maxPlaytime: Number(values.playtime) || undefined,
});

interface GameFiltersProps {
  values: GameFilterValues;
  onChange: (values: GameFilterValues) => void;
  // A busca por nome só faz sentido em listas longas (a ludoteca inteira)
  withText?: boolean;
}

// Filtros por nome, número de jogadores e duração, iguais na ludoteca e na sugestão de jogos
export const GameFilters = ({ values, onChange, withText = false }: GameFiltersProps) => (
  <div className={`game-filters${withText ? ' with-text' : ''}`}>
    {withText && (
      <input
        type="search"
        placeholder="Filtrar por nome..."
        value={values.text}
        onChange={(e) => onChange({ ...values, text: e.target.value })}
        aria-label="Filtrar por nome"
      />
    )}
    <select
      value={values.players}
      onChange={(e) => onChange({ ...values, players: e.target.value })}
      aria-label="Jogadores"
    >
      <option value="">Qualquer nº de jogadores</option>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <option key={n} value={n}>
          {n} {n === 1 ? 'jogador' : 'jogadores'}
        </option>
      ))}
    </select>
    <select
      value={values.playtime}
      onChange={(e) => onChange({ ...values, playtime: e.target.value })}
      aria-label="Duração"
    >
      <option value="">Qualquer duração</option>
      <option value="30">Até 30 min</option>
      <option value="60">Até 1 hora</option>
      <option value="90">Até 1h30</option>
      <option value="120">Até 2 horas</option>
    </select>
  </div>
);
