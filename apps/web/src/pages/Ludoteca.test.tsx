// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { ludotecaService } from '../services/ludotecaService';
import { Ludoteca } from './Ludoteca';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/ludotecaService', () => ({
  getGameSource: () => 'ludopedia',
  ludotecaService: {
    fetchUserCollection: vi.fn(),
    removeGameFromCollection: vi.fn(),
    searchExternalGames: vi.fn(),
  },
}));

const game = (id: string, name: string, playtime: string, min: number, max: number) => ({
  id,
  sourceId: id,
  name,
  image: '',
  playtime,
  minPlayers: min,
  maxPlayers: max,
});

describe('Ludoteca', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(ludotecaService.fetchUserCollection).mockResolvedValue([
      game('1', 'Catan', '60', 3, 4),
      game('2', 'Azul', '45', 2, 4),
      game('3', '7 Wonders Duel', '30', 2, 2),
    ]);
  });

  it('mostra a coleção com contagem, duração e jogadores', async () => {
    renderPage(<Ludoteca />);

    expect(await screen.findByRole('heading', { name: 'Meus jogos (3)' })).toBeTruthy();
    expect(screen.getByText('⏱ 60 min')).toBeTruthy();
    expect(screen.getByText('👥 3 - 4 jogadores')).toBeTruthy();
  });

  it('filtra por número de jogadores e por duração, e mostra "N de total"', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    await user.selectOptions(screen.getByLabelText('Jogadores'), '2');
    expect(screen.queryByText('Catan')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Meus jogos (2 de 3)' })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Duração'), '30');
    expect(screen.queryByText('Azul')).toBeNull();
    expect(screen.getByText('7 Wonders Duel')).toBeTruthy();
  });

  it('filtra pelo nome sem diferenciar maiúsculas e avisa quando nada combina', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    await user.type(screen.getByLabelText('Filtrar por nome'), 'AZU');
    expect(screen.getByText('Azul')).toBeTruthy();
    expect(screen.queryByText('Catan')).toBeNull();

    await user.type(screen.getByLabelText('Filtrar por nome'), 'xyz');
    expect(screen.getByText('Nenhum jogo combina com os filtros.')).toBeTruthy();
  });

  it('remove um jogo da coleção', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    await user.click(screen.getAllByRole('button', { name: 'Remover' })[0]);
    expect(ludotecaService.removeGameFromCollection).toHaveBeenCalledWith('u-edu', '1');
  });

  it('mostra o erro da busca externa', async () => {
    vi.mocked(ludotecaService.searchExternalGames).mockRejectedValue(
      new Error('Erro ao buscar jogos externos'),
    );
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    await user.type(screen.getByPlaceholderText(/Nome do jogo/), 'Catan');
    await user.click(screen.getByRole('button', { name: 'Pesquisar' }));

    expect(await screen.findByText('Erro ao buscar jogos externos')).toBeTruthy();
  });
});
