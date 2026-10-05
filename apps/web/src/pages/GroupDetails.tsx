import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventService, type Event, type FavoriteLocation } from '../services/eventService';
import { EVENT_STATUS_LABEL } from '../services/eventResults';
import { groupService, type Group } from '../services/groupService';
import { ludotecaService, type Game } from '../services/ludotecaService';
import { Modal } from '../components/Modal';
import { EventFormModal, type EventFormValues } from '../components/EventFormModal';
import toast from 'react-hot-toast';
import './GroupDetails.scss';

export const GroupDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  const [groupDetails, setGroupDetails] = useState<Group | null>(null);
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

      await eventService.createEvent(
        id,
        user.uid,
        title,
        dates,
        locations.map(({ id, name, address }) => ({ id, name, address })),
      );

      toast.success('Evento criado e pronto para votação!');
      setShowModal(false);
      loadEvents();
      loadFavorites(); // Recarregar favoritos recém salvos
    } catch (err) {
      toast.error('Erro ao criar evento.');
    }
  };

  const isAdmin = !!user && groupDetails?.adminId === user.uid;

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
        <section>
          <h2 className="group-section-title">Eventos</h2>
          {loading ? (
            <p className="empty-state">Carregando eventos...</p>
          ) : events.length === 0 ? (
            <p className="card empty-state">
              Nenhum evento criado ainda. Que tal marcar a próxima jogatina?
            </p>
          ) : (
            <ul className="group-events">
              {events.map((ev) => (
                <li key={ev.id}>
                  <Link to={`/event/${id}/${ev.id}`} className="card group-event">
                    <div>
                      <h3>{ev.title}</h3>
                      <span className="chip">{EVENT_STATUS_LABEL[ev.status]}</span>
                    </div>
                    <span className="muted">&rarr;</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="card group-members">
          <h2 className="group-section-title">Membros ({members.length})</h2>
          <ul>
            {members.map((m) => (
              <li key={m.id}>
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
        </aside>
      </div>

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
            <p className="empty-state">Carregando jogos...</p>
          ) : memberGames.length === 0 ? (
            <p className="empty-state">Nenhum jogo na ludoteca.</p>
          ) : (
            <ul className="group-member-games">
              {memberGames.map((g) => (
                <li key={g.id}>
                  {g.image ? <img src={g.image} alt="" /> : <div className="group-game-thumb" />}
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
