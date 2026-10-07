import React from 'react';
import './EmptyState.scss';

interface EmptyStateProps {
  // Emoji ou símbolo grande, só ilustrativo
  icon: string;
  title: string;
  // Explicação curta do que fazer em seguida
  children?: React.ReactNode;
  // Botão ou link que resolve o vazio (ex.: "Criar evento")
  action?: React.ReactNode;
  // Dentro de um cartão que já existe: sem borda própria
  compact?: boolean;
}

// Tela vazia com ícone, título e o próximo passo, no lugar de uma linha solta de texto
export const EmptyState = ({ icon, title, children, action, compact = false }: EmptyStateProps) => (
  <div className={`empty-block${compact ? ' compact' : ' card'}`}>
    <span className="empty-icon" aria-hidden="true">
      {icon}
    </span>
    <p className="empty-title">{title}</p>
    {children && <p className="muted empty-text">{children}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);
