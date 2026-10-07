// Quantas cores diferentes existem (as classes tone-0..tone-7 no CSS global)
export const TONE_COUNT = 8;

type InitialsStyle = 'person' | 'game';

// Primeira letra ou número da palavra, ignorando símbolos soltos como "(" ou "-"
const firstChar = (word: string): string => {
  const clean = word.replace(/^[^\p{L}\p{N}]+/u, '');
  return clean ? [...clean][0].toLocaleUpperCase('pt-BR') : '';
};

// Iniciais para o avatar ou a capa:
// - pessoa: a primeira letra do primeiro e do último nome ("Ana Souza" → "AS"; "Edu" → "E")
// - jogo: a primeira letra das duas primeiras palavras ("7 Wonders Duel" → "7W"; "Catan" → "C")
export const initialsOf = (name: string, style: InitialsStyle = 'person'): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => firstChar(word));
  if (words.length === 0) return '?';
  if (words.length === 1) return firstChar(words[0]);
  const second = style === 'person' ? words[words.length - 1] : words[1];
  return firstChar(words[0]) + firstChar(second);
};

// Cor estável do nome (0 a TONE_COUNT-1): a mesma pessoa ou jogo tem sempre a mesma cor, e
// maiúsculas, acentos e espaços nas pontas não mudam o resultado
export const toneOf = (name: string): number => {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  let hash = 0;
  for (const char of normalized) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % TONE_COUNT;
};
