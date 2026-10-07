import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  eventService,
  type Event,
  type FavoriteLocation,
  type EventGameOption,
} from '../services/eventService';
import { ludotecaService, type Game } from '../services/ludotecaService';
import { groupService, type GroupMember } from '../services/groupService';
import {
  EVENT_STATUS_LABEL,
  countChoices,
  countGameVotes,
  rankGameOptions,
} from '../services/eventResults';
import { Modal } from '../components/Modal';
import { GameFilters, emptyGameFilters, toCollectionFilters } from '../components/GameFilters';
import { filterCollection } from '../services/ludotecaFilters';
import { buildIcs, downloadIcs } from '../services/calendarFile';
import { EventFormModal, type EventFormValues } from '../components/EventFormModal';
import toast from 'react-hot-toast';
import './EventDetails.scss';

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// Quantos votos a opção tem, com a barra proporcional ao total de quem já votou
const VoteBar = ({ votes, total }: { votes: number; total: number }) => (
  <div className="vote-bar" title={`${votes} voto(s)`}>
    <div className="vote-bar-track">
      <div
        className="vote-bar-fill"
        style={{ width: total ? `${(votes / total) * 100}%` : '0%' }}
      />
    </div>
    <span>{votes}</span>
  </div>
);

export const EventDetails = () => {
  const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [groupAdminId, setGroupAdminId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  // States para votação de Data/Local
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  // Confirmações de ações sem volta
  const [confirmAction, setConfirmAction] = useState<'delete' | 'advance' | null>(null);

  // States para a Fase 5 (Jogos)
  const [showSuggestGamesModal, setShowSuggestGamesModal] = useState(false);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [loadingMyGames, setLoadingMyGames] = useState(false);
  const [selectedGamesToSuggest, setSelectedGamesToSuggest] = useState<string[]>([]);
  const [suggestFilters, setSuggestFilters] = useState(emptyGameFilters);

  // Votos em jogos
  const [selectedGamesToVote, setSelectedGamesToVote] = useState<string[]>([]);

  // Encerramento da votação de jogos
  const [showCloseGamesModal, setShowCloseGamesModal] = useState(false);
  const [finalGameSelection, setFinalGameSelection] = useState<string[]>([]);

  const loadEvent = async () => {
    if (!groupId || !eventId) return;
    try {
      const [fetched, group, groupMembers] = await Promise.all([
        eventService.getEventDetails(groupId, eventId),
        groupService.fetchGroupDetails(groupId),
        groupService.fetchGroupMembers(groupId),
      ]);
      setEvent(fetched);
      setGroupAdminId(group?.adminId || '');
      setGroupName(group?.name || '');
      setMembers(groupMembers);

      if (user) {
        if (fetched.votesDate && fetched.votesDate[user.uid])
          setSelectedDate(fetched.votesDate[user.uid]);
        if (fetched.votesLocation && fetched.votesLocation[user.uid])
          setSelectedLocation(fetched.votesLocation[user.uid]);
        if (fetched.votesGames && fetched.votesGames[user.uid])
          setSelectedGamesToVote(fetched.votesGames[user.uid]);

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

  const handleDeleteEvent = async () => {
    if (!groupId || !eventId) return;
    try {
      await eventService.deleteEvent(groupId, eventId);
      toast.success('Evento excluído!');
      navigate(`/group/${groupId}`);
    } catch (err) {
      toast.error('Erro ao excluir evento.');
    }
  };

  const handleUpdateEvent = async ({ title, dates, locations }: EventFormValues) => {
    if (!groupId || !eventId || !user) return;
    try {
      for (const loc of locations) {
        if (loc.saveFavorite) {
          await eventService.saveFavoriteLocation(user.uid, {
            name: loc.name,
            address: loc.address,
          });
        }
      }

      await eventService.updateEvent(
        groupId,
        eventId,
        title,
        dates,
        locations.map(({ id, name, address }) => ({ id, name, address })),
      );

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
      await eventService.voteDateLocation(
        groupId,
        eventId,
        user.uid,
        selectedDate,
        selectedLocation,
      );
      toast.success('Seu voto foi registrado!');
      loadEvent();
    } catch (err) {
      toast.error('Erro ao votar');
    } finally {
      setSubmitting(false);
    }
  };

  const openAdvanceToGames = () => {
    if (!selectedDate || !selectedLocation) {
      toast.error('Você precisa selecionar uma Data e um Local para definir como vencedores.');
      return;
    }
    setConfirmAction('advance');
  };

  const handleAdvanceToGames = async () => {
    if (!groupId || !eventId) return;
    try {
      await eventService.advanceToGamesVoting(groupId, eventId, selectedDate, selectedLocation);
      toast.success('Votação de Jogos iniciada!');
      setConfirmAction(null);
      loadEvent();
    } catch (err) {
      toast.error('Erro ao avançar fase.');
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
      setSuggestFilters(emptyGameFilters);
    } catch (err) {
      toast.error('Erro ao buscar ludoteca');
    } finally {
      setLoadingMyGames(false);
    }
  };

  const handleSuggestGamesSubmit = async () => {
    if (!groupId || !eventId || !user) return;
    if (selectedGamesToSuggest.length === 0) {
      toast.error('Selecione pelo menos um jogo.');
      return;
    }

    setSubmitting(true);
    try {
      const gamesToAdd: EventGameOption[] = selectedGamesToSuggest.map((id) => {
        const g = myGames.find((gm) => gm.id === id)!;
        return {
          id: g.id,
          name: g.name,
          thumb: g.image || '', // corrigido de g.thumb para g.image
          suggesterId: user.uid,
          suggesterName: user.displayName || user.email?.split('@')[0] || 'Jogador',
        };
      });

      await eventService.suggestGames(groupId, eventId, gamesToAdd);
      toast.success('Jogos sugeridos com sucesso!');
      setShowSuggestGamesModal(false);
      loadEvent();
    } catch (err) {
      toast.error('Erro ao sugerir jogos');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteGames = async () => {
    if (!groupId || !eventId || !user) return;
    setSubmitting(true);
    try {
      await eventService.voteGames(groupId, eventId, user.uid, selectedGamesToVote);
      toast.success('Votos registrados!');
      loadEvent();
    } catch (err) {
      toast.error('Erro ao votar em jogos');
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
    const dateVotes = countChoices(event.votesDate);
    const sortedDates = [...event.dateOptions].sort(
      (a, b) => (dateVotes[b.id] || 0) - (dateVotes[a.id] || 0),
    );
    sortedDates.forEach((d) => {
      const votes = dateVotes[d.id] || 0;
      report += `- ${formatDate(d.date)} às ${d.startTime}: ${votes} voto(s)\n`;
    });
    report += '\n';

    // Locais
    report += `*📍 Locais:*\n`;
    const locationVotes = countChoices(event.votesLocation);
    const sortedLocs = [...event.locationOptions].sort(
      (a, b) => (locationVotes[b.id] || 0) - (locationVotes[a.id] || 0),
    );
    sortedLocs.forEach((l) => {
      const votes = locationVotes[l.id] || 0;
      report += `- ${l.name}: ${votes} voto(s)\n`;
    });

    // Jogos (se fase 5)
    if (event.gameOptions && event.gameOptions.length > 0) {
      report += '\n*🧩 Jogos:*\n';
      rankGameOptions(event.gameOptions, event.votesGames).forEach(({ game, votes }) => {
        report += `- ${game.name}: ${votes} voto(s)\n`;
      });
    }

    report += '\nAcesse o App para registrar seu voto!';
    return report;
  };

  const addToCalendar = () => {
    if (!event || !finalDate || !finalLocation) return;
    const ics = buildIcs({
      id: event.id ?? '',
      title: event.title,
      groupName,
      date: finalDate.date,
      startTime: finalDate.startTime,
      endTime: finalDate.endTime,
      locationName: finalLocation.name,
      address: finalLocation.address,
      url: window.location.href,
    });
    downloadIcs('jogatina.ics', ics);
  };

  const copyResults = () => {
    navigator.clipboard.writeText(getResultsReport());
    toast.success('Resultados copiados para a área de transferência!');
  };

  // Pré-seleciona os jogos que receberam ao menos um voto
  const openCloseGames = () => {
    if (!event) return;
    setFinalGameSelection(
      rankGameOptions(event.gameOptions, event.votesGames)
        .filter(({ votes }) => votes > 0)
        .map(({ game }) => game.id),
    );
    setShowCloseGamesModal(true);
  };

  const handleConfirmEvent = async () => {
    if (!groupId || !eventId) return;
    if (finalGameSelection.length === 0) {
      toast.error('Selecione pelo menos um jogo para a mesa.');
      return;
    }
    setSubmitting(true);
    try {
      await eventService.confirmEvent(groupId, eventId, finalGameSelection);
      toast.success('Jogatina confirmada!');
      setShowCloseGamesModal(false);
      loadEvent();
    } catch (err) {
      toast.error('Erro ao encerrar votação de jogos.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceReminders = async () => {
    if (!groupId || !eventId || !user) return;
    try {
      const toastId = toast.loading('Buscando quem está atrasado e enviando os corvos...');
      const response = await eventService.forceReminders(groupId, eventId, await user.getIdToken());
      toast.success(response.message || 'E-mails enviados!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar alertas');
    }
  };

  const toggle = (list: string[], id: string, checked: boolean) =>
    checked ? [...list, id] : list.filter((item) => item !== id);

  const suggestableGames = filterCollection(myGames, toCollectionFilters(suggestFilters));

  if (loading) return <p className="empty-state">Carregando evento...</p>;
  if (!event) return null;

  // Criador do evento ou admin do grupo podem editar, excluir, cobrar e fechar etapas
  const canManageEvent = !!user && (event.creatorId === user.uid || groupAdminId === user.uid);

  const finalDate = event.dateOptions.find((d) => d.id === event.finalDateId);
  const finalLocation = event.locationOptions.find((l) => l.id === event.finalLocationId);

  const dateVotes = countChoices(event.votesDate);
  const locationVotes = countChoices(event.votesLocation);
  const gameVotes = countGameVotes(event.votesGames);
  // Quem já votou na etapa atual (no evento confirmado não há mais votação)
  const phaseVotes = event.status === 'VOTING_GAMES' ? event.votesGames || {} : event.votesDate;
  const voterCount = Object.keys(phaseVotes).length;

  return (
    <div>
      <Link to={`/group/${groupId}`} className="btn-back">
        &larr; Voltar ao grupo
      </Link>

      <header className="page-header">
        <div>
          <h1>{event.title}</h1>
          <span className="chip event-status">{EVENT_STATUS_LABEL[event.status]}</span>
        </div>
      </header>

      <div className="event-columns">
        <div className="event-main">
          {finalDate && finalLocation && (
            <section className="card event-final">
              <div>
                <small className="muted">Definido para</small>
                <strong>
                  {formatDate(finalDate.date)} às {finalDate.startTime}
                  {finalDate.endTime ? ` até ${finalDate.endTime}` : ''}
                </strong>
                <span className="muted">
                  {finalLocation.name} ({finalLocation.address})
                </span>
              </div>
              <div className="event-final-actions">
                <button onClick={addToCalendar} className="btn-secondary btn-sm">
                  📅 Adicionar ao calendário
                </button>
                <a
                  href={mapsUrl(finalLocation.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-sm"
                >
                  📍 Abrir no mapa
                </a>
              </div>
            </section>
          )}

          {event.status === 'VOTING_DATE' && (
            <section className="card">
              <h2>Votação de data e local</h2>
              <p className="muted event-hint">
                Indique a sua preferência para organizarmos essa jogatina.
              </p>

              <h3 className="event-subtitle">Data e horário</h3>
              <div className="event-options">
                {event.dateOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`event-option${selectedDate === opt.id ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="date"
                      value={opt.id}
                      checked={selectedDate === opt.id}
                      onChange={() => setSelectedDate(opt.id)}
                    />
                    <div className="event-option-info">
                      <strong>{formatDate(opt.date)}</strong>
                      <span className="muted">
                        {opt.startTime} {opt.endTime ? `às ${opt.endTime}` : '(horário de início)'}
                      </span>
                    </div>
                    <VoteBar votes={dateVotes[opt.id] || 0} total={voterCount} />
                  </label>
                ))}
              </div>

              <h3 className="event-subtitle">Local</h3>
              <div className="event-options">
                {event.locationOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`event-option${selectedLocation === opt.id ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="location"
                      value={opt.id}
                      checked={selectedLocation === opt.id}
                      onChange={() => setSelectedLocation(opt.id)}
                    />
                    <div className="event-option-info">
                      <strong>{opt.name}</strong>
                      <a
                        href={mapsUrl(opt.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir no mapa"
                        className="muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📍 {opt.address}
                      </a>
                    </div>
                    <VoteBar
                      votes={locationVotes[opt.id] || 0}
                      total={Object.keys(event.votesLocation).length}
                    />
                  </label>
                ))}
              </div>

              <button
                onClick={handleVoteDate}
                disabled={submitting}
                className="btn-primary btn-block"
              >
                {submitting
                  ? 'Registrando...'
                  : user && event.votesDate[user.uid]
                    ? 'Atualizar voto'
                    : 'Confirmar voto'}
              </button>

              {canManageEvent && (
                <div className="event-close-step">
                  <p className="muted">
                    Como organizador, escolha as opções campeãs (acima) e feche essa etapa:
                  </p>
                  <button onClick={openAdvanceToGames} className="btn-success btn-block">
                    Cravar vencedores e ir para jogos &rarr;
                  </button>
                </div>
              )}
            </section>
          )}

          {event.status === 'VOTING_GAMES' && (
            <section className="card">
              <div className="event-section-header">
                <h2>O que vamos jogar?</h2>
                <button onClick={openSuggestGames} className="btn-secondary btn-sm">
                  + Sugerir jogos
                </button>
              </div>
              <p className="muted event-hint">
                Vote nos jogos que você quer que estejam na mesa. Pode votar em quantos quiser!
              </p>

              {!event.gameOptions || event.gameOptions.length === 0 ? (
                <p className="empty-state">
                  Nenhum jogo sugerido ainda. Puxe algo da sua Ludoteca!
                </p>
              ) : (
                <>
                  <div className="event-options">
                    {event.gameOptions.map((g) => (
                      <label
                        key={g.id}
                        className={`event-option${selectedGamesToVote.includes(g.id) ? ' selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGamesToVote.includes(g.id)}
                          onChange={(e) =>
                            setSelectedGamesToVote(
                              toggle(selectedGamesToVote, g.id, e.target.checked),
                            )
                          }
                        />
                        {g.thumb ? (
                          <img src={g.thumb} alt="" className="event-game-thumb" />
                        ) : (
                          <div className="event-game-thumb" />
                        )}
                        <div className="event-option-info">
                          <strong>{g.name}</strong>
                          <span className="muted">Sugerido por {g.suggesterName}</span>
                        </div>
                        <VoteBar votes={gameVotes[g.id] || 0} total={voterCount} />
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleVoteGames}
                    disabled={submitting}
                    className="btn-primary btn-block"
                  >
                    {submitting ? 'Registrando...' : 'Confirmar votos'}
                  </button>

                  {canManageEvent && (
                    <div className="event-close-step">
                      <p className="muted">
                        Quando todos tiverem votado, escolha os jogos da mesa e confirme a jogatina:
                      </p>
                      <button onClick={openCloseGames} className="btn-success btn-block">
                        Encerrar votação de jogos &rarr;
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {event.status === 'CONFIRMED' && (
            <section className="card">
              <h2 className="event-subtitle">Jogos da mesa</h2>
              <div className="event-options">
                {(event.gameOptions || [])
                  .filter((g) => event.finalGameIds?.includes(g.id))
                  .map((g) => (
                    <div key={g.id} className="event-option">
                      {g.thumb ? (
                        <img src={g.thumb} alt="" className="event-game-thumb" />
                      ) : (
                        <div className="event-game-thumb" />
                      )}
                      <div className="event-option-info">
                        <strong>{g.name}</strong>
                        <span className="muted">Leva: {g.suggesterName}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

        <aside className="event-aside">
          {event.status !== 'CONFIRMED' && (
            <section className="card">
              <h2 className="event-subtitle">
                Votaram {voterCount} de {members.length}
              </h2>
              <ul className="event-voters">
                {members.map((m) => (
                  <li key={m.id}>
                    <span>{m.name}</span>
                    {phaseVotes[m.id] ? (
                      <span className="event-voted">✓ votou</span>
                    ) : (
                      <span className="muted">pendente</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card event-actions">
            <button onClick={copyResults} className="btn-secondary btn-block">
              📋 Copiar resumo para o WhatsApp
            </button>
            {canManageEvent && event.status !== 'CONFIRMED' && (
              <button onClick={handleForceReminders} className="btn-secondary btn-block">
                🔔 Cobrar quem não votou
              </button>
            )}
            {canManageEvent && event.status === 'VOTING_DATE' && (
              <>
                <button onClick={() => setShowEditModal(true)} className="btn-secondary btn-block">
                  ✏️ Editar evento
                </button>
                <button onClick={() => setConfirmAction('delete')} className="btn-danger btn-block">
                  🗑️ Excluir evento
                </button>
              </>
            )}
          </section>
        </aside>
      </div>

      {showEditModal && (
        <EventFormModal
          heading="Editar evento"
          submitLabel="Atualizar evento"
          initial={{
            title: event.title,
            dates: event.dateOptions,
            locations: event.locationOptions,
          }}
          favorites={favorites}
          onSubmit={handleUpdateEvent}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {confirmAction === 'delete' && (
        <Modal
          title="Excluir evento?"
          size="sm"
          onClose={() => setConfirmAction(null)}
          footer={
            <>
              <button onClick={() => setConfirmAction(null)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleDeleteEvent} className="btn-danger">
                Sim, excluir
              </button>
            </>
          }
        >
          <p className="muted">Os votos serão perdidos. Esta ação não pode ser desfeita.</p>
        </Modal>
      )}

      {confirmAction === 'advance' && (
        <Modal
          title="Encerrar votação de data e local?"
          size="sm"
          onClose={() => setConfirmAction(null)}
          footer={
            <>
              <button onClick={() => setConfirmAction(null)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleAdvanceToGames} className="btn-success">
                Confirmar e ir para jogos
              </button>
            </>
          }
        >
          <p className="muted">
            A jogatina fica marcada para{' '}
            <strong>
              {formatDate(event.dateOptions.find((d) => d.id === selectedDate)?.date ?? '')}
            </strong>{' '}
            em <strong>{event.locationOptions.find((l) => l.id === selectedLocation)?.name}</strong>
            , as opções que você selecionou. Depois disso ninguém mais vota em data e local.
          </p>
        </Modal>
      )}

      {showSuggestGamesModal && (
        <Modal
          title="Sugerir jogos da minha ludoteca"
          onClose={() => setShowSuggestGamesModal(false)}
          footer={
            <>
              <button onClick={() => setShowSuggestGamesModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleSuggestGamesSubmit}
                disabled={submitting || myGames.length === 0}
                className="btn-primary"
              >
                Enviar para a mesa
              </button>
            </>
          }
        >
          {loadingMyGames ? (
            <p className="empty-state">Carregando sua ludoteca...</p>
          ) : myGames.length === 0 ? (
            <p className="empty-state">Sua ludoteca está vazia. Adicione jogos primeiro!</p>
          ) : (
            <>
              <p className="muted event-hint">
                Filtre pelo número de pessoas e pela duração para ver só o que cabe na mesa.
              </p>
              <GameFilters values={suggestFilters} onChange={setSuggestFilters} />
              <button
                type="button"
                onClick={() =>
                  setSelectedGamesToSuggest([
                    ...new Set([...selectedGamesToSuggest, ...suggestableGames.map((g) => g.id)]),
                  ])
                }
                className="btn-link event-select-all"
              >
                Selecionar {suggestableGames.length === myGames.length ? 'todos' : 'os filtrados'}
              </button>
              {suggestableGames.length === 0 && (
                <p className="empty-state">Nenhum jogo da sua ludoteca combina com os filtros.</p>
              )}
              <div className="event-options">
                {suggestableGames.map((g) => (
                  <label
                    key={g.id}
                    className={`event-option${selectedGamesToSuggest.includes(g.id) ? ' selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGamesToSuggest.includes(g.id)}
                      onChange={(e) =>
                        setSelectedGamesToSuggest(
                          toggle(selectedGamesToSuggest, g.id, e.target.checked),
                        )
                      }
                    />
                    {g.image ? (
                      <img src={g.image} alt="" className="event-game-thumb" />
                    ) : (
                      <div className="event-game-thumb" />
                    )}
                    <div className="event-option-info">
                      <strong>{g.name}</strong>
                      <span className="muted">
                        {[
                          g.playtime && `⏱ ${g.playtime} min`,
                          (g.minPlayers || g.maxPlayers) &&
                            `👥 ${g.minPlayers || '?'}${g.maxPlayers && g.maxPlayers !== g.minPlayers ? `-${g.maxPlayers}` : ''}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {showCloseGamesModal && (
        <Modal
          title="Encerrar votação de jogos"
          onClose={() => setShowCloseGamesModal(false)}
          footer={
            <>
              <button onClick={() => setShowCloseGamesModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleConfirmEvent} disabled={submitting} className="btn-primary">
                {submitting ? 'Confirmando...' : 'Confirmar jogatina'}
              </button>
            </>
          }
        >
          <p className="muted event-hint">
            Marque os jogos que vão para a mesa. Depois de confirmar, ninguém mais vota.
          </p>
          <div className="event-options">
            {rankGameOptions(event.gameOptions, event.votesGames).map(({ game, votes }) => (
              <label
                key={game.id}
                className={`event-option${finalGameSelection.includes(game.id) ? ' selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={finalGameSelection.includes(game.id)}
                  onChange={(e) =>
                    setFinalGameSelection(toggle(finalGameSelection, game.id, e.target.checked))
                  }
                />
                <strong className="event-option-info">{game.name}</strong>
                <span className="muted">{votes} voto(s)</span>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
