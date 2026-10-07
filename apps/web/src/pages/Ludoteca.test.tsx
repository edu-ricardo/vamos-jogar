// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { resetAuth } from '../test/auth';
import { renderPage } from '../test/renderPage';
import { ludotecaService } from '../services/ludotecaService';
import { deferred } from '../test/deferred';
import { Ludoteca } from './Ludoteca';

vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock);
vi.mock('react-hot-toast', async () => (await import('../test/auth')).toastModuleMock);
vi.mock('../services/ludotecaService', () => ({
  getGameSource: () => 'ludopedia',
  ludotecaService: {
    fetchUserCollection: vi.fn(),
    removeGameFromCollection: vi.fn(),
    searchExternalGames: vi.fn(),
    addGameToCollection: vi.fn(),
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

describe('Ludoteca — ordenação', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(ludotecaService.fetchUserCollection).mockResolvedValue([
      game('1', 'Catan', '60', 3, 4),
      game('2', 'Azul', '45', 2, 4),
      game('3', '7 Wonders Duel', '30', 2, 2),
    ]);
  });

  const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

  it('começa na ordem de adição e deixa trocar a ordenação', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');
    expect(titles()).toEqual(['Catan', 'Azul', '7 Wonders Duel']);

    await user.selectOptions(screen.getByLabelText('Ordenar'), 'name');
    expect(titles()).toEqual(['7 Wonders Duel', 'Azul', 'Catan']);

    await user.selectOptions(screen.getByLabelText('Ordenar'), 'playtime');
    expect(titles()).toEqual(['7 Wonders Duel', 'Azul', 'Catan']);

    await user.selectOptions(screen.getByLabelText('Ordenar'), 'players');
    expect(titles()).toEqual(['Azul', 'Catan', '7 Wonders Duel']);

    await user.selectOptions(screen.getByLabelText('Ordenar'), 'recent');
    expect(titles()).toEqual(['7 Wonders Duel', 'Azul', 'Catan']);
  });

  it('a ordenação vale junto com os filtros', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    await user.selectOptions(screen.getByLabelText('Jogadores'), '4');
    await user.selectOptions(screen.getByLabelText('Ordenar'), 'name');

    expect(titles()).toEqual(['Azul', 'Catan']);
  });
});

describe('Ludoteca — cadastro manual', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(ludotecaService.fetchUserCollection).mockResolvedValue([
      game('1', 'Catan', '60', 3, 4),
      { ...game('manual-abc', 'Meu jogo', '20', 2, 6), sourceId: '' },
    ]);
  });

  const openManual = async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');
    await user.click(screen.getByRole('button', { name: /Cadastrar jogo manualmente/ }));
    return { user, dialog: within(screen.getByRole('dialog')) };
  };

  it('cadastra o jogo com id próprio, sem fonte externa e sem imagem', async () => {
    const { user, dialog } = await openManual();

    await user.type(dialog.getByLabelText('Nome do jogo'), '  Jogo da vovó ');
    await user.type(dialog.getByLabelText('Tempo de jogo (minutos)'), '30');
    await user.type(dialog.getByLabelText('Mín. jogadores'), '2');
    await user.type(dialog.getByLabelText('Máx. jogadores'), '4');
    await user.type(dialog.getByLabelText(/Observações/), 'Falta uma peça');
    await user.click(dialog.getByRole('button', { name: 'Adicionar à ludoteca' }));

    expect(ludotecaService.addGameToCollection).toHaveBeenCalledWith('u-edu', {
      id: expect.stringMatching(/^manual-/),
      sourceId: '',
      name: 'Jogo da vovó',
      image: '',
      playtime: '30',
      minPlayers: 2,
      maxPlayers: 4,
      observation: 'Falta uma peça',
    });
    expect(toast.success).toHaveBeenCalledWith('Adicionado à sua Ludoteca!');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exige o nome do jogo', async () => {
    const { user, dialog } = await openManual();

    await user.type(dialog.getByLabelText('Nome do jogo'), '   ');
    await user.click(dialog.getByRole('button', { name: 'Adicionar à ludoteca' }));

    expect(toast.error).toHaveBeenCalledWith('Informe o nome do jogo.');
    expect(ludotecaService.addGameToCollection).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('jogo manual pode ter o nome editado e não oferece expansões da Ludopedia', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Meu jogo');

    const card = within(screen.getByText('Meu jogo').closest('li')!);
    await user.click(card.getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));

    const name = dialog.getByLabelText('Nome do jogo');
    await user.clear(name);
    await user.type(name, 'Meu jogo 2');
    expect(dialog.queryByText('Buscar e adicionar expansão')).toBeNull();
    expect(dialog.queryByText('Expansões adicionadas')).toBeNull();

    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));
    expect(ludotecaService.addGameToCollection).toHaveBeenCalledWith(
      'u-edu',
      expect.objectContaining({ id: 'manual-abc', name: 'Meu jogo 2' }),
    );
  });

  it('jogo da Ludopedia continua com expansões e sem campo de nome', async () => {
    const user = userEvent.setup();
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    const card = within(screen.getByText('Catan').closest('li')!);
    await user.click(card.getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.queryByLabelText('Nome do jogo')).toBeNull();
    expect(dialog.getByText('Buscar e adicionar expansão')).toBeTruthy();
    expect(dialog.getByText('Expansões adicionadas')).toBeTruthy();
  });
});

describe('Ludoteca — carregamento e estado vazio', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
  });

  it('antes de a coleção chegar não diz que ela está vazia: mostra o esqueleto', async () => {
    const collection = deferred<never[]>();
    vi.mocked(ludotecaService.fetchUserCollection).mockReturnValue(collection.promise);
    renderPage(<Ludoteca />);

    expect(screen.getByText('Carregando sua ludoteca')).toBeTruthy();
    expect(screen.queryByText('Sua ludoteca está vazia.')).toBeNull();
    // Sem contagem enquanto não se sabe quantos jogos são
    expect(screen.getByRole('heading', { name: 'Meus jogos' })).toBeTruthy();

    collection.resolve([]);
    expect(await screen.findByText('Sua ludoteca está vazia.')).toBeTruthy();
    expect(screen.queryByText('Carregando sua ludoteca')).toBeNull();
  });

  it('se a coleção falhar ao carregar, o esqueleto não fica para sempre', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(ludotecaService.fetchUserCollection).mockRejectedValue(new Error('fora do ar'));
    renderPage(<Ludoteca />);

    expect(await screen.findByText('Sua ludoteca está vazia.')).toBeTruthy();
    expect(screen.queryByText('Carregando sua ludoteca')).toBeNull();
  });
});

describe('Ludoteca — capas', () => {
  beforeEach(() => {
    resetAuth();
    vi.clearAllMocks();
    vi.mocked(ludotecaService.fetchUserCollection).mockResolvedValue([
      { ...game('1', 'Catan', '60', 3, 4), image: 'capa-catan.jpg' },
      game('2', '7 Wonders Duel', '30', 2, 2),
    ]);
  });

  it('jogo com imagem mostra a capa; sem imagem, um quadrado colorido com as iniciais', async () => {
    renderPage(<Ludoteca />);
    await screen.findByText('Catan');

    const catan = within(screen.getByText('Catan').closest('li')!);
    expect(catan.getByRole('presentation', { hidden: true }).getAttribute('src')).toBe(
      'capa-catan.jpg',
    );

    const duel = within(screen.getByText('7 Wonders Duel').closest('li')!);
    expect(duel.getByText('7W')).toBeTruthy();
  });
});
