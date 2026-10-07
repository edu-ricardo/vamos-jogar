import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventService, type Event, type FavoriteLocation } from '../services/eventService';
import { EVENT_STATUS_LABEL } from '../services/eventResults';
import { groupService, type Group } from '../services/groupService';
import { ludotecaService, type Game } from '../services/ludotecaService';
import { searchGroupGames, type GroupGame } from '../services/groupGames';
import { gameMeta } from '../services/gameMeta';
import {
  eventWhen,
  rankPlayedGames,
  splitEvents,
  tableGameNames,
  todayLocal,
} from '../services/groupHistory';
import { Modal } from '../components/Modal';
import { EventFormModal, type EventFormValues } from '../components/EventFormModal';
import toast from 'react-hot-toast';
import { SkeletonRows } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { GameCover } from '../components/GameCover';
import { Avatar } from '../components/Avatar';
import './GroupDetails.scss';
import { usePageTitle } from '../hooks/usePageTitle';

// Quantas jogatinas anteriores aparecem antes de "Mostrar todas"
const PAST_EVENTS_SHOWN = 5;

export const GroupDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const navigate = useNavigate();
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Jogos de todos os membros (carregados só quando a pessoa pede)
  const [groupGames, setGroupGames] = useState<GroupGame[] | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesQuery, setGamesQuery] = useState('');
  const [showAllPast, setShowAllPast] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  const [groupDetails, setGroupDetails] = useState<Group | null>(null);
  usePageTitle(groupDetails?.name ?? 'Grupo');
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  // Member collection states
  const [viewingCollectionUserId, setViewingCollectionUserId] = useState<string | null>(null);
  const [viewingCollectionName, setViewingCollectionName] = useState<string>('');
  const [memberGames, setMemberGames] = useState<Game[]>([]);
  const [loadingMemberGames, setLoadingMemberGames] = useState(false);

  const loadGroupData = async () => {
    if (!id) return;
    try {
      const [details, membersList] = await Promise.all([
        groupService.fetchGroupDetails(id),
        groupService.fetchGroupMembers(id),
      ]);
      setGroupDetails(details);
      setMembers(membersList);
    } catch (err) {
      console.error(err);
    }
  };

  const loadEvents = async () => {
    if (!id) return;
    try {
      const fetched = await eventService.fetchGroupEvents(id);
      setEvents(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!user) return;
    const favs = await eventService.fetchFavoriteLocations(user.uid);
    setFavorites(favs);
  };

  useEffect(() => {
    loadEvents();
    loadFavorites();
    loadGroupData();
  }, [id, user]);

  const handleRemoveMember = async (memberId: string) => {
    if (!id || !user) return;
    try {
      await groupService.removeMember(id, memberId);
      toast.success('Membro removido.');
      loadGroupData();
    } catch (err) {
      toast.error('Erro ao remover membro.');
    }
  };

  const loadGroupGames = async () => {
    setGamesLoading(true);
    try {
      setGroupGames(await ludotecaService.fetchGroupGames(members));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar as ludotecas do grupo.');
    } finally {
      setGamesLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!id || !user) return;
    try {
      const { groupDeleted } = await groupService.leaveGroup(id, await user.getIdToken());
      toast.success(groupDeleted ? 'Você saiu e o grupo foi apagado.' : 'Você saiu do grupo.');
      navigate('/grupos');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao sair do grupo.');
    }
  };

  const handleViewCollection = async (userId: string, userName: string) => {
    setViewingCollectionUserId(userId);
    setViewingCollectionName(userName);
    setLoadingMemberGames(true);
    try {
      const games = await ludotecaService.fetchUserCollection(userId);
      setMemberGames(games);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar ludoteca do membro.');
    } finally {
      setLoadingMemberGames(false);
    }
  };

  const handleCreateEvent = async ({ title, dates, locations }: EventFormValues) => {
    if (!id || !user) return;
    try {
      for (const loc of locations) {
        if (loc.saveFavorite) {
          await eventService.saveFavoriteLocation(user.uid, {
            name: loc.name,
            address: loc.address,
          });
        }
      }

      const eventId = await eventService.createEvent(
        id,
        user.uid,
        title,
        dates,
        locations.map(({ id, name, address }) => ({ id, name, address })),
      );
      // Sem esperar: o evento já existe, o aviso ao grupo segue em segundo plano
      user
        .getIdToken()
        .then((token) => eventService.notifyGroup(eventId, 'created', token))
        .catch(() => {});

      toast.success('Evento criado e pronto para votação!');
      setShowModal(false);
      loadEvents();
      loadFavorites(); // Recarregar favoritos recém salvos
    } catch (err) {
      toast.error('Erro ao criar evento.');
    }
  };

  const isAdmin = !!user && groupDetails?.adminId === user.uid;

  // Próximos e em votação de um lado; o que já aconteceu vira histórico
  const today = todayLocal();
  const { upcoming, past } = splitEvents(events, today);
  const playedGames = rankPlayedGames(events, today);
  const visiblePast = showAllPast ? past : past.slice(0, PAST_EVENTS_SHOWN);

  return (
    <div>
      <Link to="/grupos" className="btn-back">
        &larr; Voltar a Grupos
      </Link>

      <header className="page-header">
        <h1>{groupDetails?.name ?? 'Grupo'}</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Criar evento
        </button>
      </header>

      <div className="group-columns">
        <div className="group-main">
          <section>
            <h2 className="group-section-title">Eventos</h2>
            {loading ? (
              <SkeletonRows label="Carregando eventos" rows={3} thumb={false} />
            ) : events.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="Nenhum evento criado ainda."
                action={
                  <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
                    + Criar evento
                  </button>
                }
              >
                Que tal marcar a próxima jogatina?
              </EmptyState>
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="Nenhum evento em andamento."
                action={
                  <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
                    + Criar evento
                  </button>
                }
              >
                Que tal marcar a próxima jogatina?
              </EmptyState>
            ) : (
              <ul className="group-events">
                {upcoming.map((ev) => (
                  <li key={ev.id}>
                    <Link to={`/event/${id}/${ev.id}`} className="card group-event">
                      <div>
                        <h3>{ev.title}</h3>
                        {eventWhen(ev) && <p className="muted group-event-when">{eventWhen(ev)}</p>}
                        <span className="chip">{EVENT_STATUS_LABEL[ev.status]}</span>
                      </div>
                      <span className="muted">&rarr;</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="group-section-title">Histórico</h2>
              <div className="card group-history">
                {playedGames.length > 0 && (
                  <div>
                    <h3>Jogos mais jogados</h3>
                    <ol className="group-played">
                      {playedGames.slice(0, 5).map((g) => (
                        <li key={g.name}>
                          <strong>{g.name}</strong>
                          <span className="muted">
                            {g.times} {g.times === 1 ? 'vez' : 'vezes'} · última em{' '}
                            {g.lastDate.split('-').reverse().join('/')}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div>
                  <h3>Jogatinas anteriores</h3>
                  <ul className="group-past">
                    {visiblePast.map((ev) => (
                      <li key={ev.id}>
                        <Link to={`/event/${id}/${ev.id}`}>
                          <strong>{ev.title}</strong>
                          <span className="muted">{eventWhen(ev)}</span>
                          {ev.status === 'CONFIRMED' ? (
                            tableGameNames(ev).length > 0 && (
                              <small className="muted">Mesa: {tableGameNames(ev).join(', ')}</small>
                            )
                          ) : (
                            <small className="muted">Não chegou a ser confirmado</small>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {past.length > PAST_EVENTS_SHOWN && !showAllPast && (
                    <button className="btn-link" onClick={() => setShowAllPast(true)}>
                      Mostrar todas ({past.length})
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="group-section-title">Jogos do grupo</h2>
            {groupGames === null ? (
              <div className="card group-games-intro">
                <p className="muted">Veja todos os jogos que os membros têm e quem leva cada um.</p>
                <button
                  onClick={loadGroupGames}
                  disabled={gamesLoading || members.length === 0}
                  className="btn-secondary"
                >
                  {gamesLoading ? 'Carregando...' : 'Ver jogos do grupo'}
                </button>
              </div>
            ) : (
              <div className="card group-games">
                <input
                  type="search"
                  placeholder="Buscar jogo ou pessoa..."
                  aria-label="Buscar nos jogos do grupo"
                  value={gamesQuery}
                  onChange={(e) => setGamesQuery(e.target.value)}
                />
                {groupGames.length === 0 ? (
                  <EmptyState icon="🎲" title="Nenhum membro cadastrou jogos ainda." compact />
                ) : searchGroupGames(groupGames, gamesQuery).length === 0 ? (
                  <EmptyState
                    icon="🔎"
                    title="Nenhum jogo ou pessoa combina com a busca."
                    compact
                  />
                ) : (
                  <ul className="group-games-list">
                    {searchGroupGames(groupGames, gamesQuery).map((g) => (
                      <li key={g.key}>
                        <GameCover name={g.name} image={g.image} className="group-game-thumb" />
                        <div>
                          <strong>{g.name}</strong>
                          {gameMeta(g) && <small className="muted">{gameMeta(g)}</small>}
                          <small className="group-game-owners">
                            Com: {g.owners.map((o) => o.name).join(', ')}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="card group-members">
          <h2 className="group-section-title">Membros ({members.length})</h2>
          <ul>
            {members.map((m) => (
              <li key={m.id}>
                <Avatar name={m.name} size="sm" />
                <span className="group-member-name">
                  {m.name}
                  {m.id === groupDetails?.adminId && <small className="muted"> (admin)</small>}
                </span>
                <button
                  onClick={() => handleViewCollection(m.id, m.name)}
                  className="btn-link"
                  title={`Ver a ludoteca de ${m.name}`}
                >
                  Ludoteca
                </button>
                {isAdmin && m.id !== user?.uid && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="btn-link group-member-remove"
                  >
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button onClick={() => setShowLeaveModal(true)} className="btn-link group-leave">
            Sair do grupo
          </button>
        </aside>
      </div>

      {showLeaveModal && (
        <Modal
          title="Sair do grupo?"
          size="sm"
          onClose={() => setShowLeaveModal(false)}
          footer={
            <>
              <button onClick={() => setShowLeaveModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleLeaveGroup} className="btn-danger">
                Sim, sair
              </button>
            </>
          }
        >
          <p className="muted">
            {members.length <= 1
              ? 'Você é o único membro: o grupo e todos os eventos dele serão apagados.'
              : isAdmin
                ? 'Você é o admin: a administração passa ao membro mais antigo do grupo.'
                : 'Seus votos e sugestões nos eventos em aberto são removidos.'}{' '}
            Para voltar, será preciso um novo convite.
          </p>
        </Modal>
      )}

      {showModal && (
        <EventFormModal
          heading="Nova jogatina"
          submitLabel="Criar e abrir votação"
          favorites={favorites}
          onSubmit={handleCreateEvent}
          onClose={() => setShowModal(false)}
        />
      )}

      {viewingCollectionUserId && (
        <Modal
          title={`Ludoteca de ${viewingCollectionName}`}
          onClose={() => setViewingCollectionUserId(null)}
        >
          {loadingMemberGames ? (
            <SkeletonRows label="Carregando jogos" rows={4} />
          ) : memberGames.length === 0 ? (
            <EmptyState icon="🎲" title="Nenhum jogo na ludoteca." compact />
          ) : (
            <ul className="group-member-games">
              {memberGames.map((g) => (
                <li key={g.id}>
                  <GameCover name={g.name} image={g.image} className="group-game-thumb" />
                  <div>
                    <strong>{g.name}</strong>
                    {g.playtime && <small className="muted">⏱ {g.playtime} min</small>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
};
