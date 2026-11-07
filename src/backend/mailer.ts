// Envio de e-mail via API REST do Resend (fetch nativo, sem SDK).
// Sem RESEND_API_KEY (dev), só loga o link no console.

export async function enviarEmailReset(para: string, nome: string, link: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log(`[mailer] RESEND_API_KEY ausente — link de reset para ${para}: ${link}`);
        return;
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: process.env.RESEND_FROM ?? 'SegurID <noreply@segurid.com.br>',
            to: [para],
            subject: 'SegurID — redefinição de senha',
            html: `<p>Olá, ${escapeHtml(nome)}.</p>
<p>Recebemos um pedido para redefinir a sua senha. O link abaixo vale por 1 hora e só pode ser usado uma vez:</p>
<p><a href="${link}">Redefinir minha senha</a></p>
<p>Se você não fez esse pedido, ignore este e-mail — a sua senha continua a mesma.</p>`,
        }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
