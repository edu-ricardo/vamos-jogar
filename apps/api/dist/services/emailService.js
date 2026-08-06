"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY || 're_dummy_key');
exports.emailService = {
    sendReminderEmail: async (toEmail, eventTitle, groupName) => {
        const htmlContent = `
      <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
        <h1 style="color: #c084fc;">Vamos Jogar!</h1>
        <div style="background: #1e293b; padding: 20px; border-radius: 12px; max-width: 500px; margin: 0 auto; text-align: left;">
          <h2 style="margin-top: 0; color: #fff;">Lembrete de Votação Pendente</h2>
          <p style="color: #94a3b8; font-size: 16px;">
            A galera do grupo <strong>${groupName}</strong> está esperando você votar no evento <strong>${eventTitle}</strong>.
          </p>
          <p style="color: #94a3b8; font-size: 16px;">
            Não deixe para a última hora, senão a mesa fica sem os seus jogos preferidos ou a data fecha sem você!
          </p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:5177" style="background: #7e22ce; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Ir para Votação
            </a>
          </div>
        </div>
      </div>
    `;
        try {
            if (!process.env.RESEND_API_KEY) {
                console.log(`(SIMULAÇÃO) E-mail de lembrete enviado para ${toEmail}`);
                return { success: true, simulated: true };
            }
            const { data, error } = await resend.emails.send({
                from: 'Vamos Jogar <onboarding@resend.dev>', // Usando dominio de teste do resend
                to: [toEmail],
                subject: `Lembrete: Votação Pendente - ${eventTitle}`,
                html: htmlContent
            });
            if (error) {
                console.error('Erro no resend:', error);
                return { success: false, error };
            }
            return { success: true, data };
        }
        catch (err) {
            console.error('Falha ao disparar email:', err);
            return { success: false, error: err };
        }
    }
};
