import './Skeleton.scss';

export type SkeletonVariant = 'line' | 'short' | 'title' | 'thumb' | 'chip' | 'block';

// Bloco cinza que pulsa no lugar do conteúdo que ainda está chegando. Só decoração: quem usa um
// leitor de tela ouve o rótulo do SkeletonRegion, não os blocos.
export const Skeleton = ({ variant = 'line' }: { variant?: SkeletonVariant }) => (
  <span className={`skeleton skeleton-${variant}`} aria-hidden="true" />
);

interface RegionProps {
  // Anunciado aos leitores de tela, ex.: "Carregando eventos"
  label: string;
  className?: string;
  children: React.ReactNode;
}

// Área que está carregando: avisa os leitores de tela e marca como ocupada
export const SkeletonRegion = ({ label, className = '', children }: RegionProps) => (
  <div className={`skeleton-region ${className}`.trim()} role="status" aria-busy="true">
    <span className="visually-hidden">{label}</span>
    {children}
  </div>
);

// Lista de linhas (capa + dois textos): eventos, membros, jogos, usuários...
export const SkeletonRows = ({
  label,
  rows = 3,
  thumb = true,
}: {
  label: string;
  rows?: number;
  thumb?: boolean;
}) => (
  <SkeletonRegion label={label} className="skeleton-rows">
    {Array.from({ length: rows }, (_, i) => (
      <div className="skeleton-row" key={i} aria-hidden="true">
        {thumb && <Skeleton variant="thumb" />}
        <div className="skeleton-row-text">
          <Skeleton variant="title" />
          <Skeleton variant="short" />
        </div>
      </div>
    ))}
  </SkeletonRegion>
);

// Grade de cartões com imagem (jogos, grupos)
export const SkeletonGrid = ({ label, count = 6 }: { label: string; count?: number }) => (
  <SkeletonRegion label={label} className="skeleton-grid">
    {Array.from({ length: count }, (_, i) => (
      <div className="skeleton-tile" key={i} aria-hidden="true">
        <Skeleton variant="block" />
        <Skeleton variant="title" />
        <Skeleton variant="short" />
      </div>
    ))}
  </SkeletonRegion>
);

// Cartão com título e algumas linhas de texto
export const SkeletonCard = ({ label, lines = 3 }: { label: string; lines?: number }) => (
  <SkeletonRegion label={label} className="card skeleton-card">
    <Skeleton variant="title" />
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} variant={i === lines - 1 ? 'short' : 'line'} />
    ))}
  </SkeletonRegion>
);
