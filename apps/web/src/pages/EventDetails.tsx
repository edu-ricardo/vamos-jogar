import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  eventService,
  type Event,
  type FavoriteLocation,
  type EventGameOption,
  type AnnounceKind,
  type AttendanceAnswer,
  type AttendanceStatus,
} from '../services/eventService';
import { ludotecaService, type Game } from '../services/ludotecaService';
import { groupService, type GroupMember } from '../services/groupService';
import {
  EVENT_STATUS_LABEL,
  countChoices,
  countDateVotes,
  countGamePoints,
  countGameVotes,
  findLeaders,
  moveGameVote,
  rankGameOptions,
} from '../services/eventResults';
import { Modal } from '../components/Modal';
import { GameFilters, emptyGameFilters, toCollectionFilters } from '../components/GameFilters';
import { filterCollection } from '../services/ludotecaFilters';
import { buildIcs, downloadIcs } from '../services/calendarFile';
import { gameMeta } from '../services/gameMeta';
import { EventFormModal, type EventFormValues } from '../components/EventFormModal';
import toast from 'react-hot-toast';
import './EventDetails.scss';

const RSVP_BUTTONS: { status: AttendanceStatus; label: string }[] = [
  { status: 'yes', label: 'Vou' },
  { status: 'maybe', label: 'Talvez' },
  { status: 'no', label: 'Não vou' },
];

// Como a lista de respostas é agrupada, na ordem em que aparece
const RSVP_GROUPS: { status: AttendanceStatus | null; label: string }[] = [
  { status: 'yes', label: 'Vão' },
  { status: 'maybe', label: 'Talvez' },
  { status: 'no', label: 'Não vão' },
  { status: null, label: 'Sem resposta' },
];

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// Quanto a opção tem (votos ou pontos), com a barra proporcional ao total (ou ao maior valor)
const VoteBar = ({
  votes,
  total,
  unit = 'voto(s)',
}: {
  votes: number;
  total: number;
  unit?: string;
}) => (
  <div className="vote-bar" title={`${votes} ${unit}`}>
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
  const [attendance, setAttendance] = useState<AttendanceAnswer[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  // States para votação de Data/Local
  // Datas em que a pessoa pode (várias); o local é uma escolha só
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  // Confirmações de ações sem volta
  const [confirmAction, setConfirmAction] = useState<'delete' | 'advance' | null>(null);
  // Data e local que o organizador escolhe como vencedores ao fechar a etapa
  const [winner, setWinner] = useState({ date: '', location: '' });

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

      // "Você vai?" só existe depois que a data foi definida; uma falha aqui não derruba a página
      if (user && fetched.finalDateId) {
        try {
          setAttendance(await eventService.getAttendance(eventId, await user.getIdToken()));
        } catch (err) {
          console.warn('Presenças não carregadas:', err);
        }
      }

      if (user) {
        if (fetched.votesDate && fetched.votesDate[user.uid]) {
          // Descarta datas que o organizador removeu depois do voto
          setSelectedDates(
            fetched.votesDate[user.uid].filter((id) =>
              fetched.dateOptions.some((d) => d.id === id),
            ),
          );
        }
        if (fetched.votesLocation && fetched.votesLocation[user.uid])
          setSelectedLocation(fetched.votesLocation[user.uid]);
        if (fetched.votesGames && fetched.votesGames[user.uid]) {
          // A ordem do voto é a preferência da pessoa; descarta jogos que não estão mais na lista
          setSelectedGamesToVote(
            fetched.votesGames[user.uid].filter((id) =>
              (fetched.gameOptions ?? []).some((g) => g.id === id),
            ),
          );
        }

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
    if (selectedDates.length === 0 || !selectedLocation) {
      toast.error('Marque ao menos uma data e escolha um local para votar.');
      return;
    }
    setSubmitting(true);
    try {
      await eventService.voteDateLocation(
        groupId,
        eventId,
        user.uid,
        selectedDates,
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

  // Abre a escolha dos vencedores já com a opção líder marcada; em empate (ou sem votos), o
  // organizador decide
  const openAdvanceToGames = () => {
    if (!event) return;
    const [dateLeader, ...otherDateLeaders] = findLeaders(
      event.dateOptions.map((d) => d.id),
      countDateVotes(event.votesDate),
    );
    const [locationLeader, ...otherLocationLeaders] = findLeaders(
      event.locationOptions.map((l) => l.id),
      countChoices(event.votesLocation),
    );
    setWinner({
      date: otherDateLeaders.length === 0 ? (dateLeader ?? '') : '',
      location: otherLocationLeaders.length === 0 ? (locationLeader ?? '') : '',
    });
    setConfirmAction('advance');
  };

  const handleAttendance = async (status: AttendanceStatus) => {
    if (!eventId || !user) return;
    const previous = attendance;
    // Mostra a escolha na hora; se a API recusar, volta ao que era
    setAttendance(attendance.map((a) => (a.userId === user.uid ? { ...a, status } : a)));
    try {
      const token = await user.getIdToken();
      await eventService.setAttendance(eventId, status, token);
      setAttendance(await eventService.getAttendance(eventId, token));
    } catch (err) {
      setAttendance(previous);
      toast.error((err as Error).message || 'Erro ao salvar a sua resposta.');
    }
  };

  // Avisa o grupo por notificação, em segundo plano: se falhar, a ação principal não é afetada
  const announce = (kind: AnnounceKind) => {
    if (!user || !eventId) return;
    user
      .getIdToken()
      .then((token) => eventService.notifyGroup(eventId, kind, token))
      .catch(() => {});
  };

  const handleAdvanceToGames = async () => {
    if (!groupId || !eventId) return;
    try {
      await eventService.advanceToGamesVoting(groupId, eventId, winner.date, winner.location);
      announce('date_set');
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
    const dateVotes = countDateVotes(event.votesDate);
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
      rankGameOptions(event.gameOptions, event.votesGames).forEach(({ game, votes, points }) => {
        report += `- ${game.name}: ${points} pt(s) (${votes} voto(s))\n`;
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
      announce('confirmed');
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

  const myAttendance = attendance.find((a) => a.userId === user?.uid)?.status ?? null;

  const dateVotes = countDateVotes(event.votesDate);
  const locationVotes = countChoices(event.votesLocation);
  const dateLeaders = findLeaders(
    event.dateOptions.map((d) => d.id),
    dateVotes,
  );
  const locationLeaders = findLeaders(
    event.locationOptions.map((l) => l.id),
    locationVotes,
  );
  // "Líder" quando só uma opção tem mais votos; "Empate" quando várias dividem o topo
  const leaderChip = (leaders: string[], id: string) =>
    leaders.includes(id) ? (
      <span className="chip event-leader">{leaders.length > 1 ? 'Empate' : 'Líder'}</span>
    ) : null;
  const gameVotes = countGameVotes(event.votesGames);
  const gameIds = (event.gameOptions ?? []).map((g) => g.id);
  const gamePoints = countGamePoints(gameIds, event.votesGames);
  const maxGamePoints = Math.max(0, ...Object.values(gamePoints));
  const gameLeaders = findLeaders(gameIds, gamePoints);
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
                Marque todas as datas em que você pode e escolha um local.
              </p>

              <h3 className="event-subtitle">Datas e horários</h3>
              <div className="event-options">
                {event.dateOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`event-option${selectedDates.includes(opt.id) ? ' selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      value={opt.id}
                      checked={selectedDates.includes(opt.id)}
                      onChange={(e) =>
                        setSelectedDates(toggle(selectedDates, opt.id, e.target.checked))
                      }
                    />
                    <div className="event-option-info">
                      <strong>
                        {formatDate(opt.date)}
                        {leaderChip(dateLeaders, opt.id)}
                      </strong>
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
                      <strong>
                        {opt.name}
                        {leaderChip(locationLeaders, opt.id)}
                      </strong>
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
                    Como organizador, quando todos tiverem votado, escolha a data e o local
                    vencedores e feche essa etapa:
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
                Marque os jogos que você quer na mesa e ordene do mais ao menos desejado: o 1º vale
                mais pontos.
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
                          <strong>
                            {g.name}
                            {leaderChip(gameLeaders, g.id)}
                          </strong>
                          <span className="muted">
                            Sugerido por {g.suggesterName} · {gameVotes[g.id] || 0} voto(s)
                          </span>
                        </div>
                        <VoteBar votes={gamePoints[g.id] || 0} total={maxGamePoints} unit="pt(s)" />
                      </label>
                    ))}
                  </div>

                  {selectedGamesToVote.length > 0 && (
                    <div className="event-ranking">
                      <h3 className="event-subtitle">Sua ordem de preferência</h3>
                      <ol>
                        {selectedGamesToVote.map((id, index) => {
                          const game = event.gameOptions?.find((g) => g.id === id);
                          if (!game) return null;
                          return (
                            <li key={id}>
                              <span className="event-ranking-position">{index + 1}º</span>
                              <span className="event-ranking-name">{game.name}</span>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                aria-label={`Subir ${game.name}`}
                                disabled={index === 0}
                                onClick={() =>
                                  setSelectedGamesToVote(moveGameVote(selectedGamesToVote, id, -1))
                                }
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                aria-label={`Descer ${game.name}`}
                                disabled={index === selectedGamesToVote.length - 1}
                                onClick={() =>
                                  setSelectedGamesToVote(moveGameVote(selectedGamesToVote, id, 1))
                                }
                              >
                                ↓
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}

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
          {finalDate && (
            <section className="card event-rsvp">
              <h2 className="event-subtitle">Você vai?</h2>
              <div className="event-rsvp-buttons">
                {RSVP_BUTTONS.map(({ status, label }) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={myAttendance === status}
                    className={`btn-sm ${myAttendance === status ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleAttendance(status)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ul className="event-rsvp-list">
                {RSVP_GROUPS.map(({ status, label }) => {
                  const names = attendance.filter((a) => a.status === status).map((a) => a.name);
                  if (names.length === 0) return null;
                  return (
                    <li key={label}>
                      <strong>
                        {label} ({names.length})
                      </strong>
                      <span className="muted">{names.join(', ')}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

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
          title="Escolher data e local vencedores"
          onClose={() => setConfirmAction(null)}
          footer={
            <>
              <button onClick={() => setConfirmAction(null)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleAdvanceToGames}
                disabled={!winner.date || !winner.location}
                className="btn-success"
              >
                Confirmar e ir para jogos
              </button>
            </>
          }
        >
          <p className="muted event-hint">
            A jogatina fica marcada com as opções escolhidas. Depois disso ninguém mais vota em data
            e local.
          </p>

          <h3 className="event-subtitle">Data e horário</h3>
          {dateLeaders.length > 1 && (
            <p className="muted event-hint">Empate nos votos: escolha uma das datas.</p>
          )}
          <div className="event-options">
            {event.dateOptions.map((opt) => (
              <label
                key={opt.id}
                className={`event-option${winner.date === opt.id ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="winner-date"
                  checked={winner.date === opt.id}
                  onChange={() => setWinner({ ...winner, date: opt.id })}
                />
                <div className="event-option-info">
                  <strong>
                    {formatDate(opt.date)}
                    {leaderChip(dateLeaders, opt.id)}
                  </strong>
                  <span className="muted">{opt.startTime}</span>
                </div>
                <span className="muted">{dateVotes[opt.id] || 0} voto(s)</span>
              </label>
            ))}
          </div>

          <h3 className="event-subtitle">Local</h3>
          {locationLeaders.length > 1 && (
            <p className="muted event-hint">Empate nos votos: escolha um dos locais.</p>
          )}
          <div className="event-options">
            {event.locationOptions.map((opt) => (
              <label
                key={opt.id}
                className={`event-option${winner.location === opt.id ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="winner-location"
                  checked={winner.location === opt.id}
                  onChange={() => setWinner({ ...winner, location: opt.id })}
                />
                <div className="event-option-info">
                  <strong>
                    {opt.name}
                    {leaderChip(locationLeaders, opt.id)}
                  </strong>
                  <span className="muted">{opt.address}</span>
                </div>
                <span className="muted">{locationVotes[opt.id] || 0} voto(s)</span>
              </label>
            ))}
          </div>
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
                      <span className="muted">{gameMeta(g)}</span>
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
            {rankGameOptions(event.gameOptions, event.votesGames).map(({ game, votes, points }) => (
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
                <span className="muted">
                  {points} pt(s) · {votes} voto(s)
                </span>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
