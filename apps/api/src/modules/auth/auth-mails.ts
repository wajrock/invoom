import type {Mail} from '../../core/mailer.ts';

const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch]!);

const EXPIRY_NOTE =
    'Ce lien est valable 30 minutes et ne fonctionne qu’une fois. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.';

function layout(title: string, intro: string, cta: string, url: string): Pick<Mail, 'text' | 'html'> {
    const text = `${title}\n\n${intro}\n\n${cta} : ${url}\n\n${EXPIRY_NOTE}`;
    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:14px;border:1px solid #e4e4e7" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700;font-size:20px;letter-spacing:-0.5px">invoom</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;line-height:1.5;color:#3f3f46">${escapeHtml(intro)}</p>
<a href="${escapeHtml(url)}" style="display:inline-block;background:#0a0a0b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(cta)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#71717a">${escapeHtml(EXPIRY_NOTE)}</p>
</td></tr></table></td></tr></table></body></html>`;
    return {text, html};
}

export const authMails = {
    signup: (to: string, url: string): Mail => ({
        to,
        subject: 'Crée ton compte Invoom',
        ...layout(
            'Bienvenue !',
            'Confirme ton adresse et crée la passkey qui te servira à te connecter, sans mot de passe.',
            'Créer mon compte',
            url,
        ),
    }),
    recover: (to: string, url: string): Mail => ({
        to,
        subject: 'Accède à ton compte Invoom',
        ...layout(
            'Accès à ton compte',
            'Ouvre ce lien sur l’appareil que tu veux utiliser : tu pourras y créer une nouvelle passkey et te reconnecter.',
            'Accéder à mon compte',
            url,
        ),
    }),
};
