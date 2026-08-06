import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventService, type Event, type EventDateOption, type EventLocationOption, type FavoriteLocation, type EventGameOption } from '../services/eventService';
import { ludotecaService, type Game } from '../services/ludotecaService';
import toast from 'react-hot-toast';

export const EventDetails = () => {
  const { groupId, eventId } = useParams<{ groupId: string, eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  // States para votação de Data/Local
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // States para edição do Evento
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDateInputs, setEditDateInputs] = useState<EventDateOption[]>([]);
  const [editLocationInputs, setEditLocationInputs] = useState<(EventLocationOption & { saveFavorite: boolean })[]>([]);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  // States para a Fase 5 (Jogos)
  const [showSuggestGamesModal, setShowSuggestGamesModal] = useState(false);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [loadingMyGames, setLoadingMyGames] = useState(false);
  const [selectedGamesToSuggest, setSelectedGamesToSuggest] = useState<string[]>([]);
  
  // Votos em jogos
  const [selectedGamesToVote, setSelectedGamesToVote] = useState<string[]>([]);

  // Parciais de Votação
  const [showResultsModal, setShowResultsModal] = useState(false);

  const loadEvent = async () => {
    if (!groupId || !eventId) return;
    try {
      const fetched = await eventService.getEventDetails(groupId, eventId);
      setEvent(fetched);
      
      if (user) {
        if (fetched.votesDate && fetched.votesDate[user.uid]) setSelectedDate(fetched.votesDate[user.uid]);
        if (fetched.votesLocation && fetched.votesLocation[user.uid]) setSelectedLocation(fetched.votesLocation[user.uid]);
        if (fetched.votesGames && fetched.votesGames[user.uid]) setSelectedGamesToVote(fetched.votesGames[user.uid]);
        
        const favs = await eventService.fetchFavoriteLocations(user.uid);
        setFavorites(favs);
      }
    } catch (err) {
      toast.error('Erro ao carregar evento');
      navigate(`/group/${groupId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [groupId, eventId, user]);

  const openEditModal = () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDateInputs(event.dateOptions);
    setEditLocationInputs(event.locationOptions.map(l => ({ ...l, saveFavorite: false })));
    setShowEditModal(true);
  };

  const handleDeleteEvent = async () => {
    if (!groupId || !eventId) return;
    if (window.confirm("Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.")) {
      try {
        await eventService.deleteEvent(groupId, eventId);
        toast.success("Evento excluído!");
        navigate(`/group/${groupId}`);
      } catch (err) {
        toast.error("Erro ao excluir evento.");
      }
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !eventId || !user) return;

    const validDates = editDateInputs.filter(d => d.date && d.startTime);
    const validLocations = editLocationInputs.filter(l => l.name.trim() !== '' && l.address.trim() !== '');

    if (validDates.length === 0 || validLocations.length === 0) {
      toast.error('Preencha corretamente pelo menos uma data e um local.');
      return;
    }

    try {
      for (const loc of validLocations) {
        if (loc.saveFavorite) {
          await eventService.saveFavoriteLocation(user.uid, { name: loc.name, address: loc.address });
        }
      }

      await eventService.updateEvent(groupId, eventId, editTitle, validDates, validLocations.map(({ id, name, address }) => ({ id, name, address })));
      
      toast.success('Evento atualizado!');
      setShowEditModal(false);
      loadEvent();
    } catch (err) {
      toast.error('Erro ao atualizar evento.');
    }
  };

  const handleVoteDate = async () => {
    if (!groupId || !eventId || !user) return;
    if (!selectedDate || !selectedLocation) {
      toast.error('Escolha uma data e um local para votar.');
      return;
    }
    setSubmitting(true);
    try {
      await eventService.voteDateLocation(groupId, eventId, user.uid, selectedDate, selectedLocation);
      toast.success('Seu voto foi registrado!');
      loadEvent(); 
    } catch (err) {
      toast.error('Erro ao votar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceToGames = async () => {
    if (!groupId || !eventId || !user) return;
    if (!selectedDate || !selectedLocation) {
      toast.error('Você precisa selecionar uma Data e um Local para definir como vencedores.');
      return;
    }
    if (window.confirm("Isso encerrará a votação de datas e fixará a data e local que você acabou de selecionar. Tem certeza?")) {
      try {
        await eventService.advanceToGamesVoting(groupId, eventId, selectedDate, selectedLocation);
        toast.success("Votação de Jogos iniciada!");
        loadEvent();
      } catch(err) {
        toast.error("Erro ao avançar fase.");
      }
    }
  };

  const openSuggestGames = async () => {
    if (!user) return;
    setShowSuggestGamesModal(true);
    setLoadingMyGames(true);
    try {
      const myCollection = await ludotecaService.fetchUserCollection(user.uid);
      setMyGames(myCollection);
      setSelectedGamesToSuggest([]);
    } catch (err) {
      toast.error("Erro ao buscar ludoteca");
    } finally {
      setLoadingMyGames(false);
    }
  };

  const handleSuggestGamesSubmit = async () => {
    if (!groupId || !eventId || !user) return;
    if (selectedGamesToSuggest.length === 0) {
      toast.error("Selecione pelo menos um jogo.");
      return;
    }
    
    setSubmitting(true);
    try {
      const gamesToAdd: EventGameOption[] = selectedGamesToSuggest.map(id => {
        const g = myGames.find(gm => gm.id === id)!;
        return {
          id: g.id,
          name: g.name,
          thumb: g.image || '', // corrigido de g.thumb para g.image
          suggesterId: user.uid,
          suggesterName: user.displayName || user.email?.split('@')[0] || 'Jogador'
        };
      });

      await eventService.suggestGames(groupId, eventId, gamesToAdd);
      toast.success("Jogos sugeridos com sucesso!");
      setShowSuggestGamesModal(false);
      loadEvent();
    } catch (err) {
      toast.error("Erro ao sugerir jogos");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteGames = async () => {
    if (!groupId || !eventId || !user) return;
    setSubmitting(true);
    try {
      await eventService.voteGames(groupId, eventId, user.uid, selectedGamesToVote);
      toast.success("Votos registrados!");
      loadEvent();
    } catch (err) {
      toast.error("Erro ao votar em jogos");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getResultsReport = () => {
    if (!event) return '';
    let report = `🎲 *Resultados Parciais: ${event.title}* 🎲\n\n`;

    // Datas
    report += `*🗓️ Datas:*\n`;
    const dateVotes = Object.values(event.votesDate || {}).reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {} as Record<string, number>);
    const sortedDates = [...event.dateOptions].sort((a, b) => (dateVotes[b.id] || 0) - (dateVotes[a.id] || 0));
    sortedDates.forEach(d => {
      const votes = dateVotes[d.id] || 0;
      report += `- ${formatDate(d.date)} às ${d.startTime}: ${votes} voto(s)\n`;
    });
    report += '\n';

    // Locais
    report += `*📍 Locais:*\n`;
    const locationVotes = Object.values(event.votesLocation || {}).reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {} as Record<string, number>);
    const sortedLocs = [...event.locationOptions].sort((a, b) => (locationVotes[b.id] || 0) - (locationVotes[a.id] || 0));
    sortedLocs.forEach(l => {
      const votes = locationVotes[l.id] || 0;
      report += `- ${l.name}: ${votes} voto(s)\n`;
    });
    
    // Jogos (se fase 5)
    if (event.gameOptions && event.gameOptions.length > 0) {
      report += '\n*🧩 Jogos:*\n';
      const allGameVotes = Object.values(event.votesGames || {}).flat();
      const gameVotesCount = allGameVotes.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {} as Record<string, number>);
      const sortedGames = [...event.gameOptions].sort((a, b) => (gameVotesCount[b.id] || 0) - (gameVotesCount[a.id] || 0));
      sortedGames.forEach(g => {
        const votes = gameVotesCount[g.id] || 0;
        report += `- ${g.name}: ${votes} voto(s)\n`;
      });
    }

    report += '\nAcesse o App para registrar seu voto!';
    return report;
  };

  const copyResults = () => {
    navigator.clipboard.writeText(getResultsReport());
    toast.success('Resultados copiados para a área de transferência!');
  };

  const handleForceReminders = async () => {
    if (!groupId || !eventId) return;
    try {
      const toastId = toast.loading('Buscando quem está atrasado e enviando os corvos...');
      const response = await eventService.forceReminders(groupId, eventId);
      toast.success(response.message || 'E-mails enviados!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar alertas');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando evento...</div>;
  if (!event) return null;

  const finalDate = event.dateOptions.find(d => d.id === event.finalDateId);
  const finalLocation = event.locationOptions.find(l => l.id === event.finalLocationId);

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => navigate(`/group/${groupId}`)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', marginBottom: '20px' }}>
        &larr; Voltar ao Grupo
      </button>

      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '10px' }}>{event.title}</h1>
          <span style={{ display: 'inline-block', padding: '5px 10px', background: 'var(--accent-primary-transparent)', color: 'var(--accent-primary)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 'bold' }}>
            STATUS: {event.status === 'VOTING_DATE' ? 'Votação de Data' : 'Votação de Jogos'}
          </span>
        </div>
        
        {user && event.creatorId === user.uid && event.status === 'VOTING_DATE' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={openEditModal} className="btn-primary" style={{ background: '#3f3f46', padding: '8px 16px', fontSize: '0.9rem' }}>✏️ Editar</button>
            <button onClick={handleDeleteEvent} className="btn-danger" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>🗑️ Excluir</button>
          </div>
        )}
      </header>

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {user && event.creatorId === user.uid && event.status !== 'CONFIRMED' && (
          <button onClick={handleForceReminders} className="btn-primary" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 16px', fontSize: '0.9rem' }}>
            🔔 Cobrar Atrasados
          </button>
        )}
        <button onClick={() => setShowResultsModal(true)} className="btn-primary" style={{ background: 'var(--accent-primary-transparent)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '8px 16px', fontSize: '0.9rem' }}>
          📊 Ver Parciais
        </button>
      </div>

      {/* TELA DE VOTING DATE */}
      {event.status === 'VOTING_DATE' && (
        <section style={{ background: 'var(--bg-tertiary)', padding: '30px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h2 style={{ marginBottom: '20px' }}>Votação de Data e Local</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Por favor, indique a sua preferência para organizarmos essa jogatina.</p>

          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '15px' }}>Data e Horário</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {event.dateOptions.map(opt => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', padding: '15px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: selectedDate === opt.id ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                  <input type="radio" name="date" value={opt.id} checked={selectedDate === opt.id} onChange={() => setSelectedDate(opt.id)} style={{ accentColor: 'var(--accent-primary)', transform: 'scale(1.2)' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '1.1rem' }}>{formatDate(opt.date)}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {opt.startTime} {opt.endTime ? `às ${opt.endTime}` : '(Horário de Início)'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ marginBottom: '15px' }}>Local</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {event.locationOptions.map(opt => {
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opt.address)}`;
                return (
                  <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', padding: '15px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: selectedLocation === opt.id ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                    <input type="radio" name="location" value={opt.id} checked={selectedLocation === opt.id} onChange={() => setSelectedLocation(opt.id)} style={{ accentColor: 'var(--accent-primary)', transform: 'scale(1.2)' }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '1.1rem' }}>{opt.name}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{opt.address}</span>
                    </div>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Abrir no Maps" style={{ fontSize: '1.5rem', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                      📍
                    </a>
                  </label>
                );
              })}
            </div>
          </div>

          <button onClick={handleVoteDate} disabled={submitting} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
            {submitting ? 'Registrando...' : (event.votesDate && user && event.votesDate[user.uid] ? 'Atualizar Voto' : 'Confirmar Voto')}
          </button>

          {user && event.creatorId === user.uid && (
            <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>Como administrador, escolha as opções campeãs (acima) e feche essa etapa:</p>
              <button onClick={handleAdvanceToGames} className="btn-primary" style={{ background: '#059669', width: '100%' }}>
                Cravar Vencedores e Ir p/ Jogos &rarr;
              </button>
            </div>
          )}
        </section>
      )}

      {/* TELA DE VOTING GAMES */}
      {event.status === 'VOTING_GAMES' && (
        <section>
          {finalDate && finalLocation && (
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Votação Encerrada. Definido para:</small>
                <strong>{formatDate(finalDate.date)} às {finalDate.startTime}</strong><br/>
                <span style={{ color: 'var(--text-secondary)' }}>{finalLocation.name} ({finalLocation.address})</span>
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(finalLocation.address)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '2rem', textDecoration: 'none' }}>📍</a>
            </div>
          )}

          <div style={{ background: 'var(--bg-tertiary)', padding: '30px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>O que vamos jogar?</h2>
              <button onClick={openSuggestGames} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                + Sugerir Jogos
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Vote nos jogos que você quer que estejam na mesa. Pode votar em quantos quiser!</p>

            {(!event.gameOptions || event.gameOptions.length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>Nenhum jogo sugerido ainda. Puxe algo da sua Ludoteca!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
                {event.gameOptions.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', padding: '15px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: selectedGamesToVote.includes(g.id) ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedGamesToVote.includes(g.id)} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedGamesToVote([...selectedGamesToVote, g.id]);
                        else setSelectedGamesToVote(selectedGamesToVote.filter(id => id !== g.id));
                      }} 
                      style={{ accentColor: 'var(--accent-primary)', transform: 'scale(1.2)' }} 
                    />
                    <img src={g.thumb} alt={g.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '1.1rem' }}>{g.name}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Sugerido por: {g.suggesterName}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {event.gameOptions && event.gameOptions.length > 0 && (
              <button onClick={handleVoteGames} disabled={submitting} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
                {submitting ? 'Registrando...' : 'Confirmar Votos'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Modal de Edição omitido pra limpar espaço, mantendo a logica anterior */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Editar Evento</h2>
            <form onSubmit={handleUpdateEvent}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Título do Evento</label>
                <input required type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
              </div>
              
              <div style={{ marginBottom: '30px', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold' }}>Opções de Datas e Horários</label>
                {editDateInputs.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input required={idx === 0} type="date" value={item.date} onChange={e => {
                      const n = [...editDateInputs]; n[idx].date = e.target.value; setEditDateInputs(n);
                    }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                    <input required={idx === 0} type="time" value={item.startTime} onChange={e => {
                      const n = [...editDateInputs]; n[idx].startTime = e.target.value; setEditDateInputs(n);
                    }} style={{ width: '120px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                  </div>
                ))}
                <button type="button" onClick={() => setEditDateInputs([...editDateInputs, { id: Date.now().toString(), date: '', startTime: '', endTime: '' }])} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', marginTop: '10px' }}>+ Adicionar outra data</button>
              </div>

              <div style={{ marginBottom: '30px', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold' }}>Opções de Locais</label>
                {editLocationInputs.map((item, idx) => (
                  <div key={item.id} style={{ marginBottom: '15px', padding: '15px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    {favorites.length > 0 && (
                      <div style={{ marginBottom: '10px', display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
                        {favorites.map(f => (
                          <button type="button" key={f.id} onClick={() => {
                            const n = [...editLocationInputs]; n[idx].name = f.name; n[idx].address = f.address; setEditLocationInputs(n); toast.success('Local carregado!');
                          }} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-primary-transparent)', color: 'var(--accent-primary)', border: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            ⭐ {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <input required={idx === 0} type="text" value={item.name} onChange={e => {
                      const n = [...editLocationInputs]; n[idx].name = e.target.value; setEditLocationInputs(n);
                    }} placeholder="Nome (Ex: Casa do Edu)" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                    <input required={idx === 0} type="text" value={item.address} onChange={e => {
                      const n = [...editLocationInputs]; n[idx].address = e.target.value; setEditLocationInputs(n);
                    }} placeholder="Endereço Completo" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                  </div>
                ))}
                <button type="button" onClick={() => setEditLocationInputs([...editLocationInputs, { id: Date.now().toString(), name: '', address: '', saveFavorite: false }])} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>+ Adicionar outro local</button>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-danger" style={{ background: 'transparent', border: 'none' }}>Cancelar</button>
                <button type="submit" className="btn-primary">Atualizar Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sugerir Jogos */}
      {showSuggestGamesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Sugerir Jogos da Minha Ludoteca</h2>
            
            {loadingMyGames ? (
              <p>Carregando sua Ludoteca...</p>
            ) : myGames.length === 0 ? (
              <p>Sua ludoteca está vazia. Adicione jogos primeiro!</p>
            ) : (
              <>
                <button type="button" onClick={() => setSelectedGamesToSuggest(myGames.map(g => g.id))} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', marginBottom: '15px', fontWeight: 'bold' }}>
                  Selecionar Todos
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px', maxHeight: '300px', overflowY: 'auto' }}>
                  {myGames.map(g => (
                    <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: selectedGamesToSuggest.includes(g.id) ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedGamesToSuggest.includes(g.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedGamesToSuggest([...selectedGamesToSuggest, g.id]);
                          else setSelectedGamesToSuggest(selectedGamesToSuggest.filter(id => id !== g.id));
                        }} 
                        style={{ accentColor: 'var(--accent-primary)' }} 
                      />
                      <img src={g.image || ''} alt={g.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                      <strong style={{ flex: 1, fontSize: '1rem' }}>{g.name}</strong>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowSuggestGamesModal(false)} className="btn-danger" style={{ background: 'transparent', border: 'none' }}>Cancelar</button>
              <button onClick={handleSuggestGamesSubmit} disabled={submitting || myGames.length === 0} className="btn-primary">
                Enviar para Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resultados Parciais */}
      {showResultsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, margin: 0 }}>📊 Parciais da Votação</h2>
              <button onClick={() => setShowResultsModal(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '15px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {getResultsReport()}
            </div>

            <button onClick={copyResults} className="btn-primary" style={{ width: '100%', background: '#10b981' }}>
              📋 Copiar para o WhatsApp
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
