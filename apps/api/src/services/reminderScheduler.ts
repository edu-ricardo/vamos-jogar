const HOUR_MS = 60 * 60 * 1000;

// Verifica os lembretes de hora em hora dentro da própria API (sem serviço externo de cron).
// Quanto cada lembrete se repete (ex.: 3 dias por evento) é regra do serviço, não deste relógio.
export const startReminderScheduler = (
  processScheduledReminders: () => Promise<number>,
  intervalMs = HOUR_MS,
  label = 'Lembretes de voto',
) => {
  const run = async () => {
    try {
      const notified = await processScheduledReminders();
      if (notified > 0) console.log(`${label} enviados para ${notified} pessoa(s)`);
    } catch (err) {
      console.error(`Falha ao processar lembretes (${label}):`, (err as Error).message);
    }
  };
  // Primeira verificação um minuto depois de subir, para o PocketBase já estar pronto
  const first = setTimeout(run, 60 * 1000);
  const timer = setInterval(run, intervalMs);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
};
