// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../test/renderPage';
import { MonthCalendar } from './MonthCalendar';
import type { DashboardEntry } from '../services/dashboardInsights';
import type { Event } from '../services/eventService';

const TODAY = '2026-10-10';

const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id,
  groupId: 'g1',
  creatorId: 'u1',
  title: `Evento ${id}`,
  status: 'VOTING_DATE',
  dateOptions: [{ id: 'd1', date: '2026-10-20', startTime: '19:00' }],
  locationOptions: [{ id: 'l1', name: 'Casa', address: 'Rua A' }],
  votesDate: {},
  votesLocation: {},
  createdAt: '',
  ...extra,
});

const confirmed = (id: string, date: string, time = '19:00'): DashboardEntry => ({
  event: event(id, {
    status: 'CONFIRMED',
    dateOptions: [{ id: 'd1', date, startTime: time }],
    finalDateId: 'd1',
  }),
  groupId: 'g1',
  groupName: 'Sexta',
});

const voting = (id: string, dates: string[]): DashboardEntry => ({
  event: event(id, {
    dateOptions: dates.map((date, i) => ({ id: `d${i}`, date, startTime: '19:00' })),
  }),
  groupId: 'g1',
  groupName: 'Sexta',
});

const renderCalendar = (entries: DashboardEntry[]) =>
  renderPage(<MonthCalendar entries={entries} today={TODAY} />);

describe('MonthCalendar', () => {
  it('mostra o mês de hoje por extenso, os dias da semana e o dia de hoje marcado', () => {
    renderCalendar([]);

    expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByTitle('domingo').textContent).toBe('D');
    expect(screen.getByText('10').closest('td')!.className).toContain('today');
    expect(screen.getByText('9').closest('td')!.className).toContain('past');
  });

  it('só os dias com evento são botões, com o dia e a quantidade ditos para leitores de tela', () => {
    renderCalendar([confirmed('a', '2026-10-20'), confirmed('b', '2026-10-20', '20:00')]);

    expect(screen.getByRole('button', { name: '20 de outubro: 2 eventos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^21 de outubro/ })).toBeNull();
    // Mês anterior, próximo mês e nada mais: o resto dos dias é texto
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('tocar num dia lista os eventos dele, e tocar de novo fecha', async () => {
    const user = userEvent.setup();
    renderCalendar([
      confirmed('a', '2026-10-20', '19:00'),
      voting('b', ['2026-10-20', '2026-10-25']),
    ]);

    const day = screen.getByRole('button', { name: '20 de outubro: 2 eventos' });
    await user.click(day);

    expect(day.getAttribute('aria-pressed')).toBe('true');
    const list = within(screen.getByRole('heading', { name: '20 de outubro' }).parentElement!);
    expect(list.getByRole('link', { name: 'Evento a' }).getAttribute('href')).toBe('/event/g1/a');
    expect(list.getByText('Confirmado')).toBeTruthy();
    expect(list.getByText('Opção de data')).toBeTruthy();
    expect(list.getAllByText('19:00 · Sexta')).toHaveLength(2);

    await user.click(day);
    expect(screen.queryByRole('heading', { name: '20 de outubro' })).toBeNull();
  });

  it('data definida e opção em votação têm marcas diferentes; no máximo 3 por dia', () => {
    const { container } = renderCalendar([
      confirmed('a', '2026-10-20'),
      voting('b', ['2026-10-20']),
    ]);
    const cell = screen.getByRole('button', { name: /20 de outubro/ }).closest('td')!;

    expect(cell.querySelectorAll('.month-dot-confirmed')).toHaveLength(1);
    expect(cell.querySelectorAll('.month-dot-option')).toHaveLength(1);
    expect(container.querySelector('.month-legend')!.textContent).toContain('data definida');
  });

  it('com 4 eventos no dia mostra só 3 bolinhas, mas diz que são 4', () => {
    renderCalendar(['a', 'b', 'c', 'd'].map((id) => confirmed(id, '2026-10-20')));

    const button = screen.getByRole('button', { name: '20 de outubro: 4 eventos' });
    expect(button.querySelectorAll('.month-dot')).toHaveLength(3);
  });

  it('navega entre os meses, virando o ano, e volta para hoje', async () => {
    const user = userEvent.setup();
    renderCalendar([confirmed('a', '2026-12-25')]);

    expect(screen.queryByRole('button', { name: 'Voltar para hoje' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByRole('heading', { name: 'dezembro de 2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '25 de dezembro: 1 evento' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByRole('heading', { name: 'janeiro de 2027' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Voltar para hoje' }));
    expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByRole('heading', { name: 'setembro de 2026' })).toBeTruthy();
  });

  it('trocar de mês fecha a lista do dia aberto', async () => {
    const user = userEvent.setup();
    renderCalendar([confirmed('a', '2026-10-20')]);

    await user.click(screen.getByRole('button', { name: '20 de outubro: 1 evento' }));
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(screen.queryByRole('heading', { name: '20 de outubro' })).toBeNull();
  });

  it('eventos de dias do mês vizinho que aparecem na grade também são clicáveis (esmaecidos)', () => {
    renderCalendar([confirmed('a', '2026-09-28')]);

    // Outubro de 2026 começa numa quinta: a primeira semana mostra 27 a 30 de setembro
    const button = screen.getByRole('button', { name: '28 de setembro: 1 evento' });
    expect(button.closest('td')!.className).toContain('outside');
  });
});
