/// <reference path="../pb_data/types.d.ts" />

// Backup automático do banco: todo dia às 4h (horário do servidor), guardando os 7 mais recentes
// em /pb_data/backups. Só define se ainda não houver agendamento, para não desfazer um ajuste
// feito pelo painel.
onBootstrap((e) => {
  e.next();

  const settings = e.app.settings();
  if (settings.backups.cron) return;

  settings.backups.cron = '0 4 * * *';
  settings.backups.cronMaxKeep = 7;
  e.app.save(settings);
  console.log('Backup automático diário configurado (4h, mantém 7)');
});
