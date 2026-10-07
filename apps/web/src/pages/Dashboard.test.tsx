// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { groupService } from '../services/groupService';
import { eventService } from '../services/eventService';
import { Dashboard } from './Dashboard';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('../services/groupService', () => ({ groupService: { fetchUserGroups: vi.fn() } }));
vi.mock('../services/eventService', () => ({ eventService: { fetchGroupEvents: vi.fn() } }));

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const event = (id: string, title: string, status: string, date: string) =>
  ({
    id,
    groupId: 'g1',
    creatorId: 'u-edu',
    title,
    status,
    dateOptions: [{ id: 'd1', date, startTime: '19:00' }],
    locationOptions: [{ id: 'l1', name: 'Casa do Edu', address: 'Rua das Flores, 100' }],
    votesDate: {},
    votesLocation: {},
    createdAt: '',
  }) as never;

describe('Início', () => {
  beforeEach(() => {
    resetAuth();
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([
      { id: 'g1', name: 'Sexta', adminId: 'u-edu', inviteToken: 'tok' },
    ]);
  });

  it('cumprimenta pelo nome e lista só os eventos de hoje em diante, com título e etapa', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      event('e1', 'Noite dos euros', 'VOTING_DATE', isoDay(3)),
      event('e2', 'Evento antigo', 'CONFIRMED', isoDay(-5)),
    ]);
    renderPage(<Dashboard />);

    expect(screen.getByRole('heading', { name: 'Olá, Edu!' })).toBeTruthy();
    expect(await screen.findByText('Noite dos euros')).toBeTruthy();
    expect(screen.getByText('Votando data e local')).toBeTruthy();
    expect(screen.getByText('Sexta · 19:00 · Casa do Edu')).toBeTruthy();
    expect(screen.queryByText('Evento antigo')).toBeNull();
    expect(screen.getByRole('link', { name: /Noite dos euros/ }).getAttribute('href')).toBe(
      '/event/g1/e1',
    );
  });

  it('só oferece "+ Agenda" quando a data já está definida', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      event('e1', 'Ainda votando', 'VOTING_DATE', isoDay(2)),
      event('e2', 'Data fechada', 'VOTING_GAMES', isoDay(4)),
    ]);
    renderPage(<Dashboard />);

    await screen.findByText('Data fechada');
    const links = screen.getAllByRole('link', { name: '+ Agenda' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('calendar.google.com');
  });

  it('mostra os grupos e os estados vazios', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    renderPage(<Dashboard />);

    await waitFor(() => expect(screen.getByText(/Nenhum evento agendado/)).toBeTruthy());
    expect(screen.getByRole('link', { name: /Sexta/ }).getAttribute('href')).toBe('/group/g1');

    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([]);
    renderPage(<Dashboard />);
    expect(await screen.findByText(/não participa de nenhum grupo/)).toBeTruthy();
  });
});
