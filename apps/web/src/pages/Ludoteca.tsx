import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ludotecaService, getGameSource, type Game } from '../services/ludotecaService';
import { filterCollection } from '../services/ludotecaFilters';
import { Modal } from '../components/Modal';
import toast from 'react-hot-toast';
import './Ludoteca.scss';

// Capa do jogo ou um quadro vazio quando a fonte não tem imagem
const GameThumb = ({ game }: { game: Game }) =>
  game.image ? (
    <img src={game.image} alt="" className="game-thumb" loading="lazy" />
  ) : (
    <div className="game-thumb" aria-hidden="true" />
  );

export const Ludoteca = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'ludopedia' | 'bgg'>('ludopedia');
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [myCollection, setMyCollection] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados do Modal
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [observation, setObservation] = useState('');
  const [playtime, setPlaytime] = useState('');
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');

  // Estados de Expansão
  const [expSearchQuery, setExpSearchQuery] = useState('');
  const [expSearchResults, setExpSearchResults] = useState<Game[]>([]);
  const [expSearchLoading, setExpSearchLoading] = useState(false);

  // Filtros da coleção
  const [filterText, setFilterText] = useState('');
  const [filterPlayers, setFilterPlayers] = useState('');
  const [filterPlaytime, setFilterPlaytime] = useState('');

  const loadCollection = async () => {
    if (!user) return;
    try {
      const collection = await ludotecaService.fetchUserCollection(user.uid);
      setMyCollection(collection);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCollection();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) return;
    setLoading(true);
    setError('');

    try {
      const token = await user.getIdToken();
      const results = await ludotecaService.searchExternalGames(query, source, token);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || 'Erro ao pesquisar');
    } finally {
      setLoading(false);
    }
  };

  const openDetailsModal = async (gameBasic: Game) => {
    if (!user) return;
    setSelectedGame(gameBasic);
    setDetailsLoading(true);
    setObservation('');
    setPlaytime('');
    try {
      const token = await user.getIdToken();
      const details = await ludotecaService.getGameDetails(gameBasic.id, source, token);
      setSelectedGame({ ...gameBasic, ...details });
      setPlaytime(details.playtime || '');
      setMinPlayers(details.minPlayers ? String(details.minPlayers) : '');
      setMaxPlayers(details.maxPlayers ? String(details.maxPlayers) : '');
    } catch (err) {
      toast.error('Erro ao carregar detalhes do jogo.');
      setSelectedGame(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const confirmAddToCollection = async () => {
    if (!user || !selectedGame) return;
    try {
      const gameToSave = {
        ...selectedGame,
        playtime: playtime,
        minPlayers: minPlayers ? Number(minPlayers) : undefined,
        maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
        observation: observation,
      };
      await ludotecaService.addGameToCollection(user.uid, gameToSave);
      toast.success('Adicionado à sua Ludoteca!');
      setSelectedGame(null);
      loadCollection();
    } catch (err) {
      toast.error('Erro ao adicionar');
    }
  };

  const openEditModal = (game: Game) => {
    setEditingGame(game);
    setObservation(game.observation || '');
    setPlaytime(game.playtime || '');
    setMinPlayers(game.minPlayers ? String(game.minPlayers) : '');
    setMaxPlayers(game.maxPlayers ? String(game.maxPlayers) : '');
    setExpSearchResults([]);
    setExpSearchQuery('');
  };

  const handleExpSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingGame) return;
    setExpSearchLoading(true);
    try {
      const token = await user.getIdToken();
      // Utiliza a fonte de origem do jogo base (ludopedia/bgg) e 'expansion'
      const results = await ludotecaService.searchExternalGames(
        expSearchQuery,
        getGameSource(editingGame.id),
        token,
        'expansion',
        editingGame.sourceId,
      );
      setExpSearchResults(results);
    } catch (err: any) {
      toast.error('Erro ao pesquisar expansão');
    } finally {
      setExpSearchLoading(false);
    }
  };

  const addExpansion = async (expBasic: Game) => {
    if (!editingGame || !user) return;
    try {
      const token = await user.getIdToken();
      const details = await ludotecaService.getGameDetails(
        expBasic.id,
        getGameSource(expBasic.id),
        token,
      );
      const newExp = { ...expBasic, ...details };
      const currentExpansions = editingGame.expansions || [];

      if (currentExpansions.find((e) => e.id === newExp.id)) {
        toast.error('Expansão já adicionada!');
        return;
      }

      setEditingGame({
        ...editingGame,
        expansions: [...currentExpansions, newExp],
      });
      toast.success('Expansão anexada!');
    } catch (err) {
      toast.error('Erro ao buscar detalhes da expansão');
    }
  };

  const removeExpansion = (expId: string) => {
    if (!editingGame) return;
    setEditingGame({
      ...editingGame,
      expansions: (editingGame.expansions || []).filter((e) => e.id !== expId),
    });
  };

  const confirmEdit = async () => {
    if (!user || !editingGame) return;
    try {
      const gameToSave = {
        ...editingGame,
        playtime: playtime,
        minPlayers: minPlayers ? Number(minPlayers) : undefined,
        maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
        observation: observation,
      };
      await ludotecaService.addGameToCollection(user.uid, gameToSave);
      toast.success('Jogo atualizado!');
      setEditingGame(null);
      loadCollection();
    } catch (err) {
      toast.error('Erro ao atualizar jogo');
    }
  };

  const removeFromCollection = async (gameId: string) => {
    if (!user) return;
    try {
      await ludotecaService.removeGameFromCollection(user.uid, gameId);
      loadCollection();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCollection = filterCollection(myCollection, {
    text: filterText,
    players: Number(filterPlayers) || undefined,
    maxPlaytime: Number(filterPlaytime) || undefined,
  });

  const gameFields = (
    <div className="ludoteca-fields">
      <div className="field">
        <label htmlFor="game-playtime">Tempo de jogo (minutos)</label>
        <input
          id="game-playtime"
          type="text"
          value={playtime}
          onChange={(e) => setPlaytime(e.target.value)}
        />
      </div>
      <div className="ludoteca-fields-row">
        <div className="field">
          <label htmlFor="game-min">Mín. jogadores</label>
          <input
            id="game-min"
            type="number"
            value={minPlayers}
            onChange={(e) => setMinPlayers(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="game-max">Máx. jogadores</label>
          <input
            id="game-max"
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="game-observation">Observações (ex: Falta um meeple, Edição KS)</label>
        <input
          id="game-observation"
          type="text"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Sua observação sobre esta cópia..."
        />
      </div>
    </div>
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Sua ludoteca</h1>
          <p className="muted">
            Pesquise e adicione os jogos que você tem para levá-los às jogatinas dos grupos.
          </p>
        </div>
      </header>

      <div className="ludoteca-columns">
        <section className="card ludoteca-search">
          <h2>Buscar jogos</h2>
          <form onSubmit={handleSearch} className="ludoteca-search-form">
            <input
              type="text"
              placeholder="Nome do jogo (ex: Catan)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'ludopedia' | 'bgg')}
              aria-label="Fonte"
            >
              <option value="ludopedia">Ludopedia (BR)</option>
              <option value="bgg">BoardGameGeek (INTL)</option>
            </select>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Buscando...' : 'Pesquisar'}
            </button>
          </form>
          {error && <p className="ludoteca-error">{error}</p>}

          {searchResults.length > 0 && (
            <ul className="ludoteca-results">
              {searchResults.map((game) => (
                <li key={game.id}>
                  <GameThumb game={game} />
                  <span>{game.name}</span>
                  <button onClick={() => openDetailsModal(game)} className="btn-secondary btn-sm">
                    + Adicionar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="ludoteca-collection-header">
            <h2>
              Meus jogos (
              {filteredCollection.length === myCollection.length
                ? myCollection.length
                : `${filteredCollection.length} de ${myCollection.length}`}
              )
            </h2>
            <div className="ludoteca-filters">
              <input
                type="search"
                placeholder="Filtrar por nome..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                aria-label="Filtrar por nome"
              />
              <select
                value={filterPlayers}
                onChange={(e) => setFilterPlayers(e.target.value)}
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
                value={filterPlaytime}
                onChange={(e) => setFilterPlaytime(e.target.value)}
                aria-label="Duração"
              >
                <option value="">Qualquer duração</option>
                <option value="30">Até 30 min</option>
                <option value="60">Até 1 hora</option>
                <option value="90">Até 1h30</option>
                <option value="120">Até 2 horas</option>
              </select>
            </div>
          </div>

          {myCollection.length === 0 ? (
            <p className="card empty-state">Sua ludoteca está vazia.</p>
          ) : filteredCollection.length === 0 ? (
            <p className="card empty-state">Nenhum jogo combina com os filtros.</p>
          ) : (
            <ul className="ludoteca-grid">
              {filteredCollection.map((game) => (
                <li key={game.id} className="ludoteca-game">
                  <GameThumb game={game} />
                  <div className="ludoteca-game-body">
                    <h3>{game.name}</h3>
                    {game.playtime && <small className="muted">⏱ {game.playtime} min</small>}
                    {(game.minPlayers || game.maxPlayers) && (
                      <small className="muted">
                        👥 {game.minPlayers || '?'}
                        {game.maxPlayers && game.maxPlayers !== game.minPlayers
                          ? ` - ${game.maxPlayers}`
                          : ''}{' '}
                        jogadores
                      </small>
                    )}
                    {game.observation && (
                      <small className="ludoteca-note">📝 {game.observation}</small>
                    )}
                    {game.expansions && game.expansions.length > 0 && (
                      <small className="ludoteca-expansions">
                        🧩 {game.expansions.length} expansão(ões)
                      </small>
                    )}
                    <div className="ludoteca-game-actions">
                      <button onClick={() => openEditModal(game)} className="btn-secondary btn-sm">
                        Editar
                      </button>
                      <button
                        onClick={() => removeFromCollection(game.id)}
                        className="btn-link ludoteca-remove"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedGame && (
        <Modal
          title={selectedGame.name}
          onClose={() => setSelectedGame(null)}
          footer={
            !detailsLoading && (
              <>
                <button onClick={() => setSelectedGame(null)} className="btn-secondary">
                  Cancelar
                </button>
                <button onClick={confirmAddToCollection} className="btn-primary">
                  Confirmar adição
                </button>
              </>
            )
          }
        >
          {detailsLoading ? (
            <p className="empty-state">Buscando detalhes do jogo...</p>
          ) : (
            <>
              <div className="ludoteca-details">
                <GameThumb game={selectedGame} />
                <p className="muted">
                  {selectedGame.description
                    ? selectedGame.description.replace(/<[^>]+>/g, '')
                    : 'Sem descrição disponível.'}
                </p>
              </div>
              {gameFields}
            </>
          )}
        </Modal>
      )}

      {editingGame && (
        <Modal
          title={`Editando: ${editingGame.name}`}
          size="lg"
          onClose={() => setEditingGame(null)}
          footer={
            <>
              <button onClick={() => setEditingGame(null)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={confirmEdit} className="btn-primary">
                Salvar alterações
              </button>
            </>
          }
        >
          <div className="ludoteca-edit">
            {gameFields}

            <div className="ludoteca-edit-expansions">
              <h3>Expansões adicionadas</h3>
              {!editingGame.expansions || editingGame.expansions.length === 0 ? (
                <p className="muted">Nenhuma expansão cadastrada.</p>
              ) : (
                <ul>
                  {editingGame.expansions.map((exp) => (
                    <li key={exp.id}>
                      <span>{exp.name}</span>
                      <button
                        onClick={() => removeExpansion(exp.id)}
                        className="btn-link ludoteca-remove"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="ludoteca-exp-search">
            <h3>Buscar e adicionar expansão</h3>
            <form onSubmit={handleExpSearch} className="ludoteca-search-form">
              <input
                type="text"
                placeholder="Nome da expansão (deixe em branco para ver todas)..."
                value={expSearchQuery}
                onChange={(e) => setExpSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={expSearchLoading}>
                {expSearchLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {expSearchResults.length > 0 && (
              <ul className="ludoteca-results">
                {expSearchResults.map((exp) => (
                  <li key={exp.id}>
                    <GameThumb game={exp} />
                    <span>{exp.name}</span>
                    <button onClick={() => addExpansion(exp)} className="btn-secondary btn-sm">
                      + Adicionar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
