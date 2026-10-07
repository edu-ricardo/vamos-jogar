import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardEntry } from '../services/dashboardInsights';
import {
  MONTHS,
  WEEKDAYS,
  buildMonthGrid,
  eventsByDay,
  monthLabel,
  shiftMonth,
  type MonthCursor,
} from '../services/calendarMonth';
import { EVENT_STATUS_LABEL } from '../services/eventResults';
import './MonthCalendar.scss';

// Quantas bolinhas cabem sob o número do dia
const MAX_DOTS = 3;

// "2026-10-11" → "11 de outubro"
const spokenDay = (date: string) => {
  const [, month, day] = date.split('-');
  return `${Number(day)} de ${MONTHS[Number(month) - 1]}`;
};

interface MonthCalendarProps {
  entries: DashboardEntry[];
  // Hoje, como YYYY-MM-DD (no relógio de quem usa)
  today: string;
}

// Calendário do mês com os eventos de todos os grupos. Dias com evento viram botões; tocar mostra
// o que há naquele dia.
export const MonthCalendar = ({ entries, today }: MonthCalendarProps) => {
  const current: MonthCursor = {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  };
  const [cursor, setCursor] = useState<MonthCursor>(current);
  const [selected, setSelected] = useState<string | null>(null);
  const days = useMemo(() => eventsByDay(entries), [entries]);

  const goTo = (next: MonthCursor) => {
    setCursor(next);
    setSelected(null);
  };
  const isCurrentMonth = cursor.year === current.year && cursor.month === current.month;
  const selectedEvents = selected ? (days[selected] ?? []) : [];

  return (
    <section className="card month-calendar" aria-label="Calendário">
      <header className="month-calendar-header">
        <button
          type="button"
          className="btn-secondary btn-sm"
          aria-label="Mês anterior"
          onClick={() => goTo(shiftMonth(cursor, -1))}
        >
          ‹
        </button>
        <h2 aria-live="polite">{monthLabel(cursor)}</h2>
        <button
          type="button"
          className="btn-secondary btn-sm"
          aria-label="Próximo mês"
          onClick={() => goTo(shiftMonth(cursor, 1))}
        >
          ›
        </button>
      </header>
      {!isCurrentMonth && (
        <button
          type="button"
          className="btn-link month-calendar-today"
          onClick={() => goTo(current)}
        >
          Voltar para hoje
        </button>
      )}

      <table>
        <thead>
          <tr>
            {WEEKDAYS.map((name) => (
              <th key={name} scope="col">
                <abbr title={name}>{name[0].toUpperCase()}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buildMonthGrid(cursor).map((week) => (
            <tr key={week[0].date}>
              {week.map((cell) => {
                const items = days[cell.date] ?? [];
                const classes = [
                  'month-cell',
                  cell.inMonth ? '' : 'outside',
                  cell.date === today ? 'today' : '',
                  cell.date < today ? 'past' : '',
                  cell.date === selected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td key={cell.date} className={classes}>
                    {items.length > 0 ? (
                      <button
                        type="button"
                        aria-pressed={cell.date === selected}
                        aria-label={`${spokenDay(cell.date)}: ${items.length} ${items.length === 1 ? 'evento' : 'eventos'}`}
                        onClick={() => setSelected(cell.date === selected ? null : cell.date)}
                      >
                        <span>{cell.day}</span>
                        <span className="month-dots" aria-hidden="true">
                          {items.slice(0, MAX_DOTS).map((item, i) => (
                            <span key={i} className={`month-dot month-dot-${item.kind}`} />
                          ))}
                        </span>
                      </button>
                    ) : (
                      <span className="month-day">{cell.day}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="month-legend muted">
        <span className="month-dot month-dot-confirmed" aria-hidden="true" /> data definida
        <span className="month-dot month-dot-option" aria-hidden="true" /> opção em votação
      </p>

      {selected && (
        <div className="month-day-events">
          <h3>{spokenDay(selected)}</h3>
          <ul>
            {selectedEvents.map(({ entry, kind, startTime }) => (
              <li key={`${entry.event.id}-${kind}`}>
                <Link to={`/event/${entry.groupId}/${entry.event.id}`}>{entry.event.title}</Link>
                <span className="muted">
                  {startTime} · {entry.groupName}
                </span>
                <span className="chip">
                  {kind === 'confirmed' ? EVENT_STATUS_LABEL[entry.event.status] : 'Opção de data'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
