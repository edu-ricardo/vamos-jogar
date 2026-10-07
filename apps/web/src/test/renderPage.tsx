import { afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

afterEach(cleanup);

// Renderiza a tela na rota indicada (path pode ter parâmetros, ex.: /event/:groupId/:eventId)
export const renderPage = (
  ui: ReactElement,
  { path = '/', route = path }: { path?: string; route?: string } = {},
) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="*" element={<div data-testid="outra-rota" />} />
      </Routes>
    </MemoryRouter>,
  );
