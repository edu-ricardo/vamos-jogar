import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService, type Group } from '../services/groupService';
import { eventService, type Event } from '../services/eventService';
import { EVENT_STATUS_LABEL } from '../services/eventResults';
import './Dashboard.scss';

// "2026-10-09" → "out"
const monthLabel = (date: string) =>
  new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

export const Dashboard = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<
    {
      event: Event;
      groupName: string;
      groupId: string;
      displayDate: string;
      displayTime: string;
      displayEndTime: string;
      displayLocation: string;
      isDateConfirmed: boolean;
    }[]
  >([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const loadUpcomingEvents = async () => {
      if (!user) return;
      try {
        const groups = await groupService.fetchUserGroups(user.uid);
        setGroups(groups);
        let allFutureEvents: {
          event: Event;
          groupName: string;
          groupId: string;
          displayDate: string;
          displayTime: string;
          displayEndTime: string;
          displayLocation: string;
          isDateConfirmed: boolean;
        }[] = [];

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Considerar eventos a partir de hoje

        for (const group of groups) {
          const events = await eventService.fetchGroupEvents(group.id);
          const futureEvents = events
            .filter((e: Event) => {
              const dateStr = e.finalDateId
                ? e.dateOptions.find((d) => d.id === e.finalDateId)?.date
                : e.dateOptions[0]?.date;

              if (!dateStr) return false;

              // 'T00:00:00' força o fuso local; sem isso a data é lida em UTC e eventos de hoje somem
              const eventDate = new Date(dateStr + 'T00:00:00');
              return eventDate >= now;
            })
            .map((e: Event) => {
              const dateObj = e.finalDateId
                ? e.dateOptions.find((d) => d.id === e.finalDateId)
                : e.dateOptions[0];
              const locObj = e.finalLocationId
                ? e.locationOptions.find((l) => l.id === e.finalLocationId)
                : e.locationOptions[0];

              return {
                event: e,
                groupName: group.name,
                groupId: group.id,
                displayDate: dateObj?.date || '',
                displayTime: dateObj?.startTime || '',
                displayEndTime: dateObj?.endTime || '',
                displayLocation: locObj?.name || 'Local a definir',
                isDateConfirmed: e.status === 'VOTING_GAMES' || e.status === 'CONFIRMED',
              };
            });

          allFutureEvents = [...allFutureEvents, ...futureEvents];
        }

        // Ordenar do mais próximo pro mais distante
        allFutureEvents.sort(
          (a, b) => new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime(),
        );

        setUpcomingEvents(allFutureEvents);
      } catch (err) {
        console.error('Erro ao carregar eventos globais:', err);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadUpcomingEvents();
  }, [user]);

  const generateGoogleCalendarUrl = (item: any) => {
    const text = encodeURIComponent(`Jogatina: ${item.event.title} (${item.groupName})`);
    const details = encodeURIComponent(`Evento do grupo ${item.groupName}.`);
    const location = encodeURIComponent(item.displayLocation);

    const startDate = item.displayDate.replace(/-/g, '');
    const startTime = item.displayTime.replace(/:/g, '') + '00';
    let endTime = '';

    if (item.displayEndTime) {
      endTime = item.displayEndTime.replace(/:/g, '') + '00';
    } else {
      const h = parseInt(item.displayTime.split(':')[0]);
      const m = item.displayTime.split(':')[1];
      const endH = Math.min(23, h + 4)
        .toString()
        .padStart(2, '0');
      endTime = endH + m + '00';
    }

    const dates = `${startDate}T${startTime}/${startDate}T${endTime}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  };

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Olá{user?.displayName ? `, ${user.displayName}` : ''}!</h1>
          <p className="muted">Suas próximas jogatinas e grupos.</p>
        </div>
      </header>

      <div className="dashboard-columns">
        <section className="card">
          <h2 className="dashboard-section-title">Próximos eventos</h2>

          {loadingEvents ? (
            <p className="empty-state">Buscando eventos...</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="empty-state">Nenhum evento agendado para o futuro.</p>
          ) : (
            <ul className="dashboard-events">
              {upcomingEvents.map((item) => (
                <li key={item.event.id} className="dashboard-event">
                  <Link to={`/event/${item.groupId}/${item.event.id}`}>
                    <div className="dashboard-event-date">
                      <strong>{item.displayDate.slice(8, 10)}</strong>
                      <span>{monthLabel(item.displayDate)}</span>
                    </div>
                    <div className="dashboard-event-info">
                      <h3>{item.event.title}</h3>
                      <p className="muted">
                        {item.groupName} · {item.displayTime} · {item.displayLocation}
                      </p>
                      <span className="chip">{EVENT_STATUS_LABEL[item.event.status]}</span>
                    </div>
                  </Link>
                  {item.isDateConfirmed && (
                    <a
                      href={generateGoogleCalendarUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm"
                    >
                      + Agenda
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="dashboard-section-title">
            <h2>Seus grupos</h2>
            <Link to="/grupos" className="btn-link">
              Ver todos
            </Link>
          </div>
          {groups.length === 0 ? (
            <p className="empty-state">
              Você ainda não participa de nenhum grupo. <Link to="/grupos">Crie um</Link> ou peça um
              convite.
            </p>
          ) : (
            <ul className="dashboard-groups">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link to={`/group/${g.id}`}>
                    <span>{g.name}</span>
                    <span className="muted">&rarr;</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/ludoteca" className="btn-secondary btn-block dashboard-ludoteca">
            🎲 Minha ludoteca
          </Link>
        </section>
      </div>
    </div>
  );
};
