import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ludotecaService, getGameSource, type Game } from '../services/ludotecaService';
import { isManualGame, newManualGameId } from '../services/manualGame';
import { filterCollection, sortCollection, type GameSort } from '../services/ludotecaFilters';
import { Modal } from '../components/Modal';
import { GameFilters, emptyGameFilters, toCollectionFilters } from '../components/GameFilters';
import toast from 'react-hot-toast';
import { SkeletonGrid, SkeletonRows } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
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
  // Antes de a coleção chegar, não dá para dizer que ela está vazia
  const [loadingCollection, setLoadingCollection] = useState(true);

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

  // Filtros e ordenação da coleção
  const [filters, setFilters] = useState(emptyGameFilters);
  const [sort, setSort] = useState<GameSort>('added');

  // Cadastro manual (jogo que a Ludopedia e o BGG não têm)
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');

  const loadCollection = async () => {
    if (!user) return;
    try {
      const collection = await ludotecaService.fetchUserCollection(user.uid);
      setMyCollection(collection);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCollection(false);
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

  const openManualModal = () => {
    setManualName('');
    setObservation('');
    setPlaytime('');
    setMinPlayers('');
    setMaxPlayers('');
    setManualOpen(true);
  };

  const confirmManualGame = async () => {
    if (!user) return;
    if (!manualName.trim()) {
      toast.error('Informe o nome do jogo.');
      return;
    }
    try {
      await ludotecaService.addGameToCollection(user.uid, {
        id: newManualGameId(),
        sourceId: '',
        name: manualName.trim(),
        image: '',
        playtime,
        minPlayers: minPlayers ? Number(minPlayers) : undefined,
        maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
        observation,
      });
      toast.success('Adicionado à sua Ludoteca!');
      setManualOpen(false);
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

  const filteredCollection = sortCollection(
    filterCollection(myCollection, toCollectionFilters(filters)),
    sort,
  );

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

          <button type="button" className="btn-link ludoteca-manual" onClick={openManualModal}>
            Não achou? Cadastrar jogo manualmente
          </button>

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
              Meus jogos
              {!loadingCollection &&
                ` (${
                  filteredCollection.length === myCollection.length
                    ? myCollection.length
                    : `${filteredCollection.length} de ${myCollection.length}`
                })`}
            </h2>
            <GameFilters
              values={filters}
              onChange={setFilters}
              withText
              sort={sort}
              onSortChange={setSort}
            />
          </div>

          {loadingCollection ? (
            <SkeletonGrid label="Carregando sua ludoteca" />
          ) : myCollection.length === 0 ? (
            <EmptyState icon="🎲" title="Sua ludoteca está vazia.">
              Pesquise um jogo ao lado e adicione à sua coleção, ou cadastre um manualmente.
            </EmptyState>
          ) : filteredCollection.length === 0 ? (
            <EmptyState icon="🔎" title="Nenhum jogo combina com os filtros." />
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
            <SkeletonRows label="Buscando detalhes do jogo" rows={2} />
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

      {manualOpen && (
        <Modal
          title="Cadastrar jogo manualmente"
          onClose={() => setManualOpen(false)}
          footer={
            <>
              <button onClick={() => setManualOpen(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={confirmManualGame} className="btn-primary">
                Adicionar à ludoteca
              </button>
            </>
          }
        >
          <div className="ludoteca-fields">
            <div className="field">
              <label htmlFor="manual-name">Nome do jogo</label>
              <input
                id="manual-name"
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ex: Meu jogo de cartas"
                autoFocus
              />
            </div>
            {gameFields}
          </div>
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
            <div className="ludoteca-fields">
              {isManualGame(editingGame.id) && (
                <div className="field">
                  <label htmlFor="edit-name">Nome do jogo</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editingGame.name}
                    onChange={(e) => setEditingGame({ ...editingGame, name: e.target.value })}
                  />
                </div>
              )}
              {gameFields}
            </div>

            {!isManualGame(editingGame.id) && (
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
            )}
          </div>

          {!isManualGame(editingGame.id) && (
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
          )}
        </Modal>
      )}
    </div>
  );
};
