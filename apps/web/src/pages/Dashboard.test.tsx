// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { groupService } from '../services/groupService';
import { eventService } from '../services/eventService';
import { deferred } from '../test/deferred';
import { Dashboard } from './Dashboard';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('../services/groupService', () => ({ groupService: { fetchUserGroups: vi.fn() } }));
vi.mock('../services/eventService', () => ({
  eventService: { fetchGroupEvents: vi.fn(), getAttendance: vi.fn() },
}));

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Evento em votação de data (sem data definida) ou, com `defined`, com data e local definidos
const event = (id: string, title: string, status: string, date: string, extra = {}) =>
  ({
    id,
    groupId: 'g1',
    creatorId: 'u-ana',
    title,
    status,
    dateOptions: [{ id: 'd1', date, startTime: '19:00' }],
    locationOptions: [{ id: 'l1', name: 'Casa do Edu', address: 'Rua das Flores, 100' }],
    votesDate: {},
    votesLocation: {},
    createdAt: '',
    ...extra,
  }) as never;

const defined = (id: string, title: string, date: string, extra = {}) =>
  event(id, title, 'CONFIRMED', date, { finalDateId: 'd1', finalLocationId: 'l1', ...extra });

const answer = (status: 'yes' | 'maybe' | 'no' | null) => [
  { userId: 'u-edu', name: 'Edu', status },
  { userId: 'u-bia', name: 'Bia', status: 'yes' as const },
];

const eventList = async () =>
  within((await screen.findByRole('heading', { name: 'Próximos eventos' })).closest('section')!);

describe('Início', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([
      { id: 'g1', name: 'Sexta', adminId: 'u-edu', inviteToken: 'tok' },
    ]);
    vi.mocked(eventService.getAttendance).mockResolvedValue(answer('yes'));
  });

  it('cumprimenta pelo nome e lista só os eventos de hoje em diante, com título e etapa', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      event('e1', 'Noite dos euros', 'VOTING_DATE', isoDay(3)),
      event('e2', 'Evento antigo', 'CONFIRMED', isoDay(-5), {
        finalDateId: 'd1',
        finalLocationId: 'l1',
      }),
    ]);
    renderPage(<Dashboard />);

    expect(screen.getByRole('heading', { name: 'Olá, Edu!' })).toBeTruthy();
    const list = await eventList();
    expect(await list.findByText('Noite dos euros')).toBeTruthy();
    expect(list.getByText('Votando data e local')).toBeTruthy();
    expect(list.getByText('Sexta · 19:00 · Casa do Edu')).toBeTruthy();
    expect(screen.queryByText('Evento antigo')).toBeNull();
  });

  it('mostra os grupos e os estados vazios', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    renderPage(<Dashboard />);

    await waitFor(() => expect(screen.getByText(/Nenhum evento agendado/)).toBeTruthy());
    expect(screen.getByRole('link', { name: /Sexta/ }).getAttribute('href')).toBe('/group/g1');
    expect(screen.queryByRole('heading', { name: /Precisa de você/ })).toBeNull();

    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([]);
    renderPage(<Dashboard />);
    expect(await screen.findByText(/não participa de nenhum grupo/)).toBeTruthy();
  });

  describe('próxima jogatina em destaque', () => {
    it('destaca a mais próxima com data definida, com contagem e atalhos', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        defined('longe', 'Jogatina de novembro', isoDay(20)),
        defined('perto', 'Noite dos euros', isoDay(1)),
        event('votando', 'Ainda votando', 'VOTING_DATE', isoDay(2)),
      ]);
      renderPage(<Dashboard />);

      const hero = within(await screen.findByRole('region', { name: 'Próxima jogatina' }));
      expect(hero.getByRole('heading', { name: 'Noite dos euros' })).toBeTruthy();
      expect(hero.getByText('Amanhã às 19:00')).toBeTruthy();
      expect(hero.getByText(/Sexta · .* · Casa do Edu/)).toBeTruthy();
      expect(hero.getByText('Confirmado')).toBeTruthy();
      expect(hero.getByRole('link', { name: 'Abrir evento' }).getAttribute('href')).toBe(
        '/event/g1/perto',
      );
      expect(hero.getByRole('link', { name: '+ Agenda' }).getAttribute('href')).toContain(
        'calendar.google.com',
      );
    });

    it('não há destaque enquanto nenhum evento tem data definida', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        event('e1', 'Ainda votando', 'VOTING_DATE', isoDay(2)),
      ]);
      renderPage(<Dashboard />);

      await (await eventList()).findByText('Ainda votando');
      expect(screen.queryByRole('region', { name: 'Próxima jogatina' })).toBeNull();
    });

    it('mostra se a pessoa já respondeu à presença', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        defined('e1', 'Noite dos euros', isoDay(1)),
      ]);
      vi.mocked(eventService.getAttendance).mockResolvedValue(answer('maybe'));
      renderPage(<Dashboard />);

      const hero = within(await screen.findByRole('region', { name: 'Próxima jogatina' }));
      expect(await hero.findByText('Você marcou talvez')).toBeTruthy();
    });

    it('avisa quando a pessoa ainda não respondeu', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        defined('e1', 'Noite dos euros', isoDay(1)),
      ]);
      vi.mocked(eventService.getAttendance).mockResolvedValue(answer(null));
      renderPage(<Dashboard />);

      const hero = within(await screen.findByRole('region', { name: 'Próxima jogatina' }));
      expect(await hero.findByText('Você ainda não respondeu')).toBeTruthy();
    });
  });

  describe('precisa de você', () => {
    const games = [{ id: 'g1', name: 'Catan', thumb: '', suggesterId: 'u-ana' }];

    it('pede o voto de data a quem ainda não votou, levando ao evento', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        event('e1', 'Noite dos euros', 'VOTING_DATE', isoDay(3)),
        event('e2', 'Já votei', 'VOTING_DATE', isoDay(4), { votesDate: { 'u-edu': ['d1'] } }),
      ]);
      renderPage(<Dashboard />);

      const card = within(
        (await screen.findByRole('heading', { name: /Precisa de você/ })).closest('section')!,
      );
      expect(card.getByText(/Votar na data e no local/)).toBeTruthy();
      expect(card.getByRole('link', { name: /Noite dos euros/ }).getAttribute('href')).toBe(
        '/event/g1/e1',
      );
      expect(card.queryByText('Já votei')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Precisa de você 1' })).toBeTruthy();
    });

    it('pede os jogos e a presença de eventos com data definida', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        defined('e1', 'Noite dos euros', isoDay(5), { status: 'VOTING_GAMES', gameOptions: games }),
      ]);
      vi.mocked(eventService.getAttendance).mockResolvedValue(answer(null));
      renderPage(<Dashboard />);

      const card = within(
        (await screen.findByRole('heading', { name: /Precisa de você/ })).closest('section')!,
      );
      expect(card.getByText(/Escolher os jogos/)).toBeTruthy();
      expect(await card.findByText(/Confirmar presença/)).toBeTruthy();
    });

    it('com tudo respondido mostra "Tudo em dia"', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        defined('e1', 'Noite dos euros', isoDay(5)),
      ]);
      vi.mocked(eventService.getAttendance).mockResolvedValue(answer('yes'));
      renderPage(<Dashboard />);

      expect(await screen.findByText(/Tudo em dia por aqui/)).toBeTruthy();
      expect(screen.queryByText(/Confirmar presença/)).toBeNull();
    });

    it('se a presença não carregar, a página funciona e só não cobra a resposta', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
        defined('e1', 'Noite dos euros', isoDay(5)),
      ]);
      vi.mocked(eventService.getAttendance).mockRejectedValue(new Error('fora do ar'));
      renderPage(<Dashboard />);

      expect(await screen.findByText(/Tudo em dia por aqui/)).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Próxima jogatina' })).toBeTruthy();
    });

    it('consulta a presença só dos 5 próximos eventos com data definida', async () => {
      vi.mocked(eventService.fetchGroupEvents).mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => defined(`e${i}`, `Jogatina ${i}`, isoDay(i + 1))),
      );
      renderPage(<Dashboard />);

      await screen.findByText(/Tudo em dia por aqui/);
      await waitFor(() => expect(eventService.getAttendance).toHaveBeenCalledTimes(5));
    });
  });

  it('só oferece "+ Agenda" na lista quando a data já está definida', async () => {
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      event('e1', 'Ainda votando', 'VOTING_DATE', isoDay(2)),
      defined('e2', 'Data fechada', isoDay(4)),
    ]);
    renderPage(<Dashboard />);

    const list = await eventList();
    await list.findByText('Data fechada');
    const links = list.getAllByRole('link', { name: '+ Agenda' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('calendar.google.com');
  });
});

describe('Início — carregamento e estados vazios', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(eventService.getAttendance).mockResolvedValue([]);
  });

  it('enquanto carrega mostra esqueletos no destaque, em "Precisa de você" e nos eventos', async () => {
    const groups = deferred<{ id: string; name: string; adminId: string; inviteToken: string }[]>();
    vi.mocked(groupService.fetchUserGroups).mockReturnValue(groups.promise);
    renderPage(<Dashboard />);

    expect(screen.getByText('Carregando a próxima jogatina')).toBeTruthy();
    expect(screen.getByText('Carregando o que precisa de você')).toBeTruthy();
    expect(screen.getByText('Carregando eventos')).toBeTruthy();
    // Os grupos também ainda não chegaram: não dá para dizer que a pessoa não tem nenhum
    expect(screen.getByText('Carregando grupos')).toBeTruthy();
    expect(screen.queryByText(/Nenhum evento agendado/)).toBeNull();
    expect(screen.queryByText(/não participa de nenhum grupo/)).toBeNull();

    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    groups.resolve([{ id: 'g1', name: 'Sexta', adminId: 'u-edu', inviteToken: 't' }]);

    expect(await screen.findByText(/Nenhum evento agendado/)).toBeTruthy();
    expect(screen.queryByText('Carregando eventos')).toBeNull();
    expect(screen.queryByText('Carregando grupos')).toBeNull();
    expect(screen.getByRole('link', { name: /Sexta/ })).toBeTruthy();
    expect(screen.queryByText('Carregando a próxima jogatina')).toBeNull();
  });

  it('sem eventos, o estado vazio leva aos grupos', async () => {
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([
      { id: 'g1', name: 'Sexta', adminId: 'u-edu', inviteToken: 't' },
    ]);
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([]);
    renderPage(<Dashboard />);

    const link = await screen.findByRole('link', { name: 'Ver meus grupos' });
    expect(link.getAttribute('href')).toBe('/grupos');
  });

  it('sem grupos, o estado vazio oferece criar um', async () => {
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([]);
    renderPage(<Dashboard />);

    const link = await screen.findByRole('link', { name: 'Criar um grupo' });
    expect(link.getAttribute('href')).toBe('/grupos');
  });
});

describe('Início — calendário', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([
      { id: 'g1', name: 'Sexta', adminId: 'u-edu', inviteToken: 'tok' },
    ]);
    vi.mocked(eventService.getAttendance).mockResolvedValue([]);
  });

  it('enquanto carrega mostra o esqueleto do calendário e depois o mês com os eventos', async () => {
    const events = deferred<never[]>();
    vi.mocked(eventService.fetchGroupEvents).mockReturnValue(events.promise);
    renderPage(<Dashboard />);

    expect(screen.getByText('Carregando o calendário')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Calendário' })).toBeNull();

    events.resolve([defined('e1', 'Noite dos euros', isoDay(1))] as never[]);

    const calendar = within(await screen.findByRole('region', { name: 'Calendário' }));
    expect(calendar.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.queryByText('Carregando o calendário')).toBeNull();
  });

  it('o dia do próximo evento fica marcado e mostra o evento ao tocar', async () => {
    const user = userEvent.setup();
    const tomorrow = isoDay(1);
    vi.mocked(eventService.fetchGroupEvents).mockResolvedValue([
      defined('e1', 'Noite dos euros', tomorrow),
    ]);
    renderPage(<Dashboard />);

    const calendar = within(await screen.findByRole('region', { name: 'Calendário' }));
    await user.click(await calendar.findByRole('button', { name: /1 evento$/ }));

    expect(calendar.getByRole('link', { name: 'Noite dos euros' }).getAttribute('href')).toBe(
      '/event/g1/e1',
    );
  });
});

describe('Início — acessibilidade', () => {
  it('põe o título da aba', async () => {
    resetAuth();
    vi.mocked(groupService.fetchUserGroups).mockResolvedValue([]);
    renderPage(<Dashboard />);

    await screen.findByText(/não participa de nenhum grupo/);
    expect(document.title).toBe('Início · Vamos Jogar');
  });
});
