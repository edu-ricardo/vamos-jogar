import { initialsOf, toneOf } from '../services/avatar';
import './Avatar.scss';

// Círculo colorido com as iniciais da pessoa. É só enfeite: o nome sempre aparece ao lado, por
// isso fica escondido dos leitores de tela.
export const Avatar = ({ name, size = 'md' }: { name: string; size?: 'xs' | 'sm' | 'md' }) => (
  <span className={`avatar avatar-${size} tone-${toneOf(name)}`} aria-hidden="true">
    {initialsOf(name)}
  </span>
);
