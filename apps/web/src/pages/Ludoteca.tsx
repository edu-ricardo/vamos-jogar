import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ludotecaService, type Game } from '../services/ludotecaService';
import toast from 'react-hot-toast';

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

  // Estados de Expansão
  const [expSearchQuery, setExpSearchQuery] = useState('');
  const [expSearchResults, setExpSearchResults] = useState<Game[]>([]);
  const [expSearchLoading, setExpSearchLoading] = useState(false);

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
        observation: observation
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
    setExpSearchResults([]);
    setExpSearchQuery('');
  };

  const handleExpSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expSearchQuery.trim() || !user) return;
    setExpSearchLoading(true);
    try {
      const token = await user.getIdToken();
      // Utiliza a fonte atual (ludopedia/bgg) e 'expansion'
      const results = await ludotecaService.searchExternalGames(expSearchQuery, source, token, 'expansion');
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
      const details = await ludotecaService.getGameDetails(expBasic.id, source, token);
      const newExp = { ...expBasic, ...details };
      const currentExpansions = editingGame.expansions || [];
      
      if (currentExpansions.find(e => e.id === newExp.id)) {
        toast.error('Expansão já adicionada!');
        return;
      }
      
      setEditingGame({
        ...editingGame,
        expansions: [...currentExpansions, newExp]
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
      expansions: (editingGame.expansions || []).filter(e => e.id !== expId)
    });
  };

  const confirmEdit = async () => {
    if (!user || !editingGame) return;
    try {
      const gameToSave = {
        ...editingGame,
        playtime: playtime,
        observation: observation
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

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
      <h1>Sua Ludoteca</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '30px' }}>Pesquise e adicione jogos que você possui à sua coleção para levá-los aos grupos de jogatina.</p>

      <section style={{ marginBottom: '50px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px' }}>
        <h2>Buscar Jogos</h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <input 
            type="text" 
            placeholder="Nome do jogo (ex: Catan)..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <select 
            value={source} 
            onChange={(e) => setSource(e.target.value as any)}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          >
            <option value="ludopedia">Ludopedia (BR)</option>
            <option value="bgg">BoardGameGeek (INTL)</option>
          </select>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Buscando...' : 'Pesquisar'}
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', marginTop: '10px' }}>{error}</p>}
        
        {searchResults.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {searchResults.map(game => (
              <div key={game.id} style={{ background: '#1c1c1f', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <img src={game.image || 'https://via.placeholder.com/200x200?text=Sem+Imagem'} alt={game.name} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h4 style={{ margin: '0 0 5px 0' }}>{game.name}</h4>
                  <button onClick={() => openDetailsModal(game)} className="btn-primary" style={{ marginTop: 'auto', padding: '8px' }}>
                    + Adicionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Meus Jogos ({myCollection.length})</h2>
        {myCollection.length === 0 ? (
          <p style={{ color: '#a1a1aa' }}>Sua ludoteca está vazia.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {myCollection.map(game => (
              <div key={game.id} style={{ background: '#1c1c1f', borderRadius: '12px', overflow: 'hidden', border: '1px solid #6366f1' }}>
                <img src={game.image || 'https://via.placeholder.com/200x200?text=Sem+Imagem'} alt={game.name} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                <div style={{ padding: '15px' }}>
                  <h4 style={{ margin: '0 0 5px 0' }}>{game.name}</h4>
                  <small style={{ color: '#a1a1aa', display: 'block' }}>⏱ {game.playtime} min</small>
                  {game.observation && <small style={{ color: '#fbbf24', display: 'block', marginTop: '4px' }}>📝 {game.observation}</small>}
                  {game.expansions && game.expansions.length > 0 && (
                    <small style={{ color: '#34d399', display: 'block', marginTop: '4px' }}>🧩 {game.expansions.length} expansão(ões)</small>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={() => openEditModal(game)} style={{ flex: 1, padding: '8px', background: '#3f3f46', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => removeFromCollection(game.id)} style={{ flex: 1, padding: '8px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer' }}>
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL DE ADIÇÃO DE JOGO */}
      {selectedGame && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1c1c1f', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #444', padding: '30px' }}>
            
            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <h3>Buscando detalhes do jogo...</h3>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                  <img src={selectedGame.image || 'https://via.placeholder.com/150'} alt={selectedGame.name} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div>
                    <h2 style={{ marginTop: 0, marginBottom: '10px' }}>{selectedGame.name}</h2>
                    <p style={{ fontSize: '0.9rem', color: '#a1a1aa', maxHeight: '100px', overflowY: 'auto' }}>
                      {selectedGame.description ? selectedGame.description.replace(/<[^>]+>/g, '') : 'Sem descrição disponível.'}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#a1a1aa' }}>Tempo de Jogo (minutos)</label>
                  <input 
                    type="text" 
                    value={playtime} 
                    onChange={(e) => setPlaytime(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  />
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#a1a1aa' }}>Observações (ex: Falta um meeple, Edição KS)</label>
                  <input 
                    type="text" 
                    value={observation} 
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Sua observação sobre esta cópia..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setSelectedGame(null)} className="btn-danger" style={{ padding: '10px 20px', border: 'none', background: 'transparent' }}>
                    Cancelar
                  </button>
                  <button onClick={confirmAddToCollection} className="btn-primary" style={{ padding: '10px 20px' }}>
                    Confirmar Adição
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO E EXPANSÕES */}
      {editingGame && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1c1c1f', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #444', padding: '30px' }}>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <img src={editingGame.image || 'https://via.placeholder.com/150'} alt={editingGame.name} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Editando: {editingGame.name}</h2>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#a1a1aa' }}>Tempo de Jogo (minutos)</label>
                  <input 
                    type="text" 
                    value={playtime} 
                    onChange={(e) => setPlaytime(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  />
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#a1a1aa' }}>Observações</label>
                  <input 
                    type="text" 
                    value={observation} 
                    onChange={(e) => setObservation(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>Expansões Adicionadas</h3>
                {(!editingGame.expansions || editingGame.expansions.length === 0) ? (
                  <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Nenhuma expansão cadastrada.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {editingGame.expansions.map(exp => (
                      <li key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.9rem' }}>{exp.name}</span>
                        <button onClick={() => removeExpansion(exp.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}>Remover</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '30px 0' }} />

            <div style={{ marginBottom: '30px' }}>
              <h3>Buscar e Adicionar Expansão</h3>
              <form onSubmit={handleExpSearch} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Nome da expansão..." 
                  value={expSearchQuery}
                  onChange={(e) => setExpSearchQuery(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                />
                <button type="submit" className="btn-primary" disabled={expSearchLoading} style={{ padding: '10px 20px' }}>
                  {expSearchLoading ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {expSearchResults.length > 0 && (
                <div style={{ marginTop: '20px', maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {expSearchResults.map(exp => (
                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272a', padding: '10px 15px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <img src={exp.image || 'https://via.placeholder.com/50'} alt={exp.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                        <span style={{ fontSize: '0.95rem' }}>{exp.name}</span>
                      </div>
                      <button onClick={() => addExpansion(exp)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        + Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setEditingGame(null)} className="btn-danger" style={{ padding: '10px 20px', border: 'none', background: 'transparent' }}>
                Cancelar
              </button>
              <button onClick={confirmEdit} className="btn-primary" style={{ padding: '10px 20px' }}>
                Salvar Alterações
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
