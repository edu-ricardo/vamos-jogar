export interface CalendarEvent {
  id: string;
  title: string;
  groupName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm; sem ele, a jogatina dura 4 horas (como no link do Google Agenda)
  locationName: string;
  address: string;
  // Endereço do evento no app, para abrir de volta a partir do calendário
  url?: string;
}

const DEFAULT_DURATION_HOURS = 4;

// "2026-10-11" + "14:00" → "20261011T140000" (horário do relógio, sem fuso: vale onde a pessoa está)
const localStamp = (date: string, time: string) =>
  `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`;

// Fim da jogatina; sem horário de fim, soma a duração padrão sem passar da meia-noite
const endStamp = (event: CalendarEvent) => {
  if (event.endTime) return localStamp(event.date, event.endTime);
  const [hours, minutes] = event.startTime.split(':').map(Number);
  const endHours = Math.min(23, hours + DEFAULT_DURATION_HOURS);
  return localStamp(
    event.date,
    `${String(endHours).padStart(2, '0')}:${String(endHours === 23 ? 59 : minutes).padStart(2, '0')}`,
  );
};

// Em texto do iCalendar, \ ; , e quebras de linha precisam de escape
const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Linhas do iCalendar têm no máximo 75 bytes: o excesso continua na linha seguinte, com um espaço
const foldLine = (line: string): string => {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // A primeira linha comporta 75 bytes; as seguintes, 74 (o espaço inicial conta)
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
};

const utcStamp = (now: Date) =>
  now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

// Arquivo .ics (iCalendar) de um evento: abre no Apple Calendário, Outlook, Google Agenda etc.
export const buildIcs = (event: CalendarEvent, now: Date = new Date()): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vamos Jogar//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@vamos-jogar`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(event.date, event.startTime)}`,
    `DTEND:${endStamp(event)}`,
    `SUMMARY:${escapeText(`Jogatina: ${event.title} (${event.groupName})`)}`,
    `LOCATION:${escapeText(`${event.locationName}, ${event.address}`)}`,
    `DESCRIPTION:${escapeText(`Evento do grupo ${event.groupName}.${event.url ? `\n${event.url}` : ''}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
};

// Baixa o arquivo no navegador
export const downloadIcs = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
