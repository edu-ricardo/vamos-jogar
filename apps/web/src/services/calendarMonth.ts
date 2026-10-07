import type { DashboardEntry } from './dashboardInsights';
import { finalDateOf } from './groupHistory';

export interface MonthCursor {
  year: number;
  // 0 a 11, como em Date
  month: number;
}

export interface CalendarCell {
  // YYYY-MM-DD
  date: string;
  day: number;
  // Falso nos dias do mês anterior ou seguinte que completam a primeira e a última semana
  inMonth: boolean;
}

export const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const monthLabel = ({ year, month }: MonthCursor): string => `${MONTHS[month]} de ${year}`;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

// Mês anterior (-1) ou seguinte (1), virando o ano quando preciso
export const shiftMonth = ({ year, month }: MonthCursor, delta: number): MonthCursor => {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
};

// Semanas do mês começando no domingo; só as linhas necessárias (4 a 6)
export const buildMonthGrid = ({ year, month }: MonthCursor): CalendarCell[][] => {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const weeks = Math.ceil((leading + daysInMonth) / 7);

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      // Date normaliza dias fora do mês (0, -1, 32...) para o mês vizinho
      const d = new Date(year, month, week * 7 + weekday - leading + 1);
      return {
        date: iso(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        inMonth: d.getMonth() === month,
      };
    }),
  );
};

export interface DayEvent {
  entry: DashboardEntry;
  // confirmed: a data já está definida; option: uma das opções que ainda estão em votação
  kind: 'confirmed' | 'option';
  startTime: string;
}

// Eventos de cada dia: com data definida, só esse dia; em votação, um registro por opção de data
export const eventsByDay = (entries: DashboardEntry[]): Record<string, DayEvent[]> => {
  const days: Record<string, DayEvent[]> = {};
  const add = (date: string, item: DayEvent) => (days[date] ??= []).push(item);

  for (const entry of entries) {
    const final = finalDateOf(entry.event);
    if (final) {
      add(final.date, { entry, kind: 'confirmed', startTime: final.startTime });
      continue;
    }
    for (const option of entry.event.dateOptions) {
      add(option.date, { entry, kind: 'option', startTime: option.startTime });
    }
  }
  for (const list of Object.values(days)) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return days;
};
