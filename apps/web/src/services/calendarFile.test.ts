import { describe, expect, it } from 'vitest';
import { buildIcs, type CalendarEvent } from './calendarFile';

const event: CalendarEvent = {
  id: 'abc123',
  title: 'Noite dos euros',
  groupName: 'Sexta',
  date: '2026-10-11',
  startTime: '14:00',
  endTime: '18:30',
  locationName: 'Casa do Edu',
  address: 'Rua das Flores, 100',
};

const NOW = new Date('2026-10-07T12:34:56.789Z');
const lines = (ics: string) => ics.split('\r\n');

describe('buildIcs', () => {
  it('monta um VEVENT válido, com horário local e fim informado', () => {
    const ics = buildIcs(event, NOW);

    expect(lines(ics)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vamos Jogar//PT-BR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:abc123@vamos-jogar',
      'DTSTAMP:20261007T123456Z',
      'DTSTART:20261011T140000',
      'DTEND:20261011T183000',
      'SUMMARY:Jogatina: Noite dos euros (Sexta)',
      'LOCATION:Casa do Edu\\, Rua das Flores\\, 100',
      'DESCRIPTION:Evento do grupo Sexta.',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('sem horário de fim, dura 4 horas sem passar da meia-noite', () => {
    expect(lines(buildIcs({ ...event, endTime: undefined }, NOW))).toContain(
      'DTEND:20261011T180000',
    );
    expect(lines(buildIcs({ ...event, startTime: '21:30', endTime: undefined }, NOW))).toContain(
      'DTEND:20261011T235900',
    );
  });

  it('escapa vírgula, ponto e vírgula, barra e quebra de linha', () => {
    const ics = buildIcs({ ...event, title: 'A; B, C\\D', address: 'Rua X\nap 2' }, NOW);

    expect(ics).toContain('SUMMARY:Jogatina: A\\; B\\, C\\\\D (Sexta)');
    expect(ics).toContain('LOCATION:Casa do Edu\\, Rua X\\nap 2');
  });

  it('inclui o endereço do evento na descrição quando informado', () => {
    const ics = buildIcs({ ...event, url: 'https://app.test/event/g1/e1' }, NOW);
    expect(ics).toContain('DESCRIPTION:Evento do grupo Sexta.\\nhttps://app.test/event/g1/e1');
  });

  it('quebra linhas longas em até 75 bytes, com continuação iniciada por espaço', () => {
    const longTitle = Array(40).fill('Ação').join(' ');
    const ics = buildIcs({ ...event, title: longTitle }, NOW);

    const encoder = new TextEncoder();
    for (const line of lines(ics)) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    // Desfazendo a quebra, o texto original volta inteiro
    expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:Jogatina: ${longTitle} (Sexta)`);
  });

  it('usa CRLF e termina com quebra de linha', () => {
    const ics = buildIcs(event, NOW);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });
});
