import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService, type Group } from '../services/groupService';
import { eventService, type AttendanceStatus } from '../services/eventService';
import { EVENT_STATUS_LABEL } from '../services/eventResults';
import { finalDateOf, finalLocationOf, todayLocal } from '../services/groupHistory';
import {
  describeCountdown,
  displayDateOf,
  nextEntry,
  pendingActions,
  upcomingEntries,
  type DashboardEntry,
} from '../services/dashboardInsights';
import { SkeletonCard, SkeletonRows } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { MonthCalendar } from '../components/MonthCalendar';
import './Dashboard.scss';

// Quantos dos próximos eventos têm a presença consultada (uma chamada à API por evento)
const MAX_RSVP_CHECKS = 5;

const RSVP_CHIP: Record<AttendanceStatus | 'none', string> = {
  yes: 'Você vai',
  maybe: 'Você marcou talvez',
  no: 'Você não vai',
  none: 'Você ainda não respondeu',
};

// "2026-10-09" → "out"
const monthLabel = (date: string) =>
  new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

interface CalendarItem {
  title: string;
  groupName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
}

const googleCalendarUrl = (item: CalendarItem) => {
  const text = encodeURIComponent(`Jogatina: ${item.title} (${item.groupName})`);
  const details = encodeURIComponent(`Evento do grupo ${item.groupName}.`);
  const location = encodeURIComponent(item.location);

  const startDate = item.date.replace(/-/g, '');
  const startTime = item.startTime.replace(/:/g, '') + '00';
  let endTime = '';

  if (item.endTime) {
    endTime = item.endTime.replace(/:/g, '') + '00';
  } else {
    const h = parseInt(item.startTime.split(':')[0]);
    const m = item.startTime.split(':')[1];
    const endH = Math.min(23, h + 4)
      .toString()
      .padStart(2, '0');
    endTime = endH + m + '00';
  }

  const dates = `${startDate}T${startTime}/${startDate}T${endTime}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
};

// Data, hora e local que o Início mostra de um evento
const describeEntry = ({ event, groupName }: DashboardEntry, today: string) => {
  const date = displayDateOf(event, today);
  const location = finalLocationOf(event) ?? event.locationOptions[0];
  return {
    date: date?.date ?? '',
    startTime: date?.startTime ?? '',
    endTime: date?.endTime ?? '',
    location: location?.name ?? 'Local a definir',
    calendar: {
      title: event.title,
      groupName,
      date: date?.date ?? '',
      startTime: date?.startTime ?? '',
      endTime: date?.endTime ?? '',
      location: location?.name ?? 'Local a definir',
    },
  };
};

export const Dashboard = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [entries, setEntries] = useState<DashboardEntry[]>([]);
  // Resposta da pessoa à presença; null = ainda não respondeu (só dos próximos eventos)
  const [rsvp, setRsvp] = useState<Record<string, AttendanceStatus | null>>({});
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const userGroups = await groupService.fetchUserGroups(user.uid);
        setGroups(userGroups);
        const perGroup = await Promise.all(
          userGroups.map(async (group) =>
            (await eventService.fetchGroupEvents(group.id)).map((event) => ({
              event,
              groupId: group.id,
              groupName: group.name,
            })),
          ),
        );
        const loaded = perGroup.flat();
        setEntries(loaded);
        setLoadingEvents(false);

        // A presença chega depois e sem pressa: uma falha só deixa de cobrar a resposta
        const token = await user.getIdToken();
        const toCheck = upcomingEntries(loaded, todayLocal())
          .filter((e) => finalDateOf(e.event) && e.event.id)
          .slice(0, MAX_RSVP_CHECKS);
        const answers = await Promise.all(
          toCheck.map(async ({ event }) => {
            try {
              const list = await eventService.getAttendance(event.id!, token);
              return [event.id!, list.find((a) => a.userId === user.uid)?.status ?? null] as const;
            } catch {
              return null;
            }
          }),
        );
        setRsvp(Object.fromEntries(answers.filter((a) => a !== null)));
      } catch (err) {
        console.error('Erro ao carregar eventos globais:', err);
      } finally {
        setLoadingEvents(false);
      }
    };

    load();
  }, [user]);

  const now = new Date();
  const today = todayLocal(now);
  const upcoming = upcomingEntries(entries, today);
  const next = nextEntry(entries, today);
  const actions = user ? pendingActions(entries, user.uid, today, rsvp) : [];

  const nextInfo = next && describeEntry(next, today);
  const countdown = nextInfo && describeCountdown(nextInfo.date, nextInfo.startTime, now);
  const nextRsvp = next?.event.id ? rsvp[next.event.id] : undefined;

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Olá{user?.displayName ? `, ${user.displayName}` : ''}!</h1>
          <p className="muted">Suas próximas jogatinas e grupos.</p>
        </div>
      </header>

      {loadingEvents && (
        <div className="dashboard-skeleton-hero">
          <SkeletonCard label="Carregando a próxima jogatina" lines={3} />
        </div>
      )}

      {next && nextInfo && countdown && (
        <section
          className={`card dashboard-hero dashboard-hero-${countdown.urgency}`}
          aria-label="Próxima jogatina"
        >
          <p className="dashboard-hero-kicker">Próxima jogatina</p>
          <p className="dashboard-hero-countdown">{countdown.label}</p>
          <h2>
            <Link to={`/event/${next.groupId}/${next.event.id}`}>{next.event.title}</Link>
          </h2>
          <p className="muted">
            {next.groupName} · {nextInfo.date.split('-').reverse().join('/')} · {nextInfo.location}
          </p>
          <div className="dashboard-hero-chips">
            <span className="chip">{EVENT_STATUS_LABEL[next.event.status]}</span>
            {nextRsvp !== undefined && (
              <span className={`chip${nextRsvp === null ? ' chip-warning' : ''}`}>
                {RSVP_CHIP[nextRsvp ?? 'none']}
              </span>
            )}
          </div>
          <div className="dashboard-hero-actions">
            <Link to={`/event/${next.groupId}/${next.event.id}`} className="btn-primary btn-sm">
              Abrir evento
            </Link>
            <a
              href={googleCalendarUrl(nextInfo.calendar)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm"
            >
              + Agenda
            </a>
          </div>
        </section>
      )}

      <div className="dashboard-columns">
        <div className="dashboard-main">
          {loadingEvents && <SkeletonCard label="Carregando o que precisa de você" lines={2} />}
          {!loadingEvents && (actions.length > 0 || upcoming.length > 0) && (
            <section className="card dashboard-actions">
              <h2 className="dashboard-section-title">
                Precisa de você{' '}
                {actions.length > 0 && <span className="chip">{actions.length}</span>}
              </h2>
              {actions.length === 0 ? (
                <p className="dashboard-allclear">✓ Tudo em dia por aqui.</p>
              ) : (
                <ul className="dashboard-action-list">
                  {actions.map((action) => (
                    <li key={action.key}>
                      <Link to={`/event/${action.groupId}/${action.eventId}`}>
                        <span>
                          <strong>{action.title}</strong>
                          <small className="muted">{action.groupName}</small>
                        </span>
                        <span className="dashboard-action-label">{action.label} &rarr;</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="card">
            <h2 className="dashboard-section-title">Próximos eventos</h2>

            {loadingEvents ? (
              <SkeletonRows label="Carregando eventos" rows={3} />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Nenhum evento agendado para o futuro."
                action={
                  <Link to="/grupos" className="btn-secondary btn-sm">
                    Ver meus grupos
                  </Link>
                }
                compact
              >
                Crie um evento em um dos seus grupos para marcar a próxima jogatina.
              </EmptyState>
            ) : (
              <ul className="dashboard-events">
                {upcoming.map((entry) => {
                  const info = describeEntry(entry, today);
                  const { event } = entry;
                  return (
                    <li key={event.id} className="dashboard-event">
                      <Link to={`/event/${entry.groupId}/${event.id}`}>
                        <div className="dashboard-event-date">
                          <strong>{info.date.slice(8, 10)}</strong>
                          <span>{monthLabel(info.date)}</span>
                        </div>
                        <div className="dashboard-event-info">
                          <h3>{event.title}</h3>
                          <p className="muted">
                            {entry.groupName} · {info.startTime} · {info.location}
                          </p>
                          <span className="chip">{EVENT_STATUS_LABEL[event.status]}</span>
                        </div>
                      </Link>
                      {finalDateOf(event) && (
                        <a
                          href={googleCalendarUrl(info.calendar)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm"
                        >
                          + Agenda
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="dashboard-side">
          {loadingEvents ? (
            <SkeletonCard label="Carregando o calendário" lines={5} />
          ) : (
            <MonthCalendar entries={entries} today={today} />
          )}

          <section className="card">
            <div className="dashboard-section-title">
              <h2>Seus grupos</h2>
              <Link to="/grupos" className="btn-link">
                Ver todos
              </Link>
            </div>
            {groups.length === 0 && loadingEvents ? (
              <SkeletonRows label="Carregando grupos" rows={2} thumb={false} />
            ) : groups.length === 0 ? (
              <EmptyState
                icon="👥"
                title="Você ainda não participa de nenhum grupo."
                action={
                  <Link to="/grupos" className="btn-primary btn-sm">
                    Criar um grupo
                  </Link>
                }
                compact
              >
                Crie um grupo ou peça um convite a quem organiza as jogatinas.
              </EmptyState>
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
    </div>
  );
};
