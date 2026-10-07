// Diferença (em ms) entre o relógio do fuso e o UTC no instante dado
const offsetMs = (utcMs: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asIfUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asIfUtc - utcMs;
};

// O evento guarda data e hora "do relógio" (2026-10-11 + 14:00); aqui vira o instante real no fuso
// do grupo (por padrão o de Brasília), independente do fuso do servidor.
export const zonedTime = (date: string, time: string, timeZone: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hours, minutes);
  // Segunda passada: se o primeiro palpite caiu do outro lado de uma mudança de horário
  const first = guess - offsetMs(guess, timeZone);
  return new Date(guess - offsetMs(first, timeZone));
};

// "2026-10-11" no fuso informado (o dia de hoje para quem está lá)
export const localDate = (now: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
