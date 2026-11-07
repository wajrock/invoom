import nodemailer from 'nodemailer';

export interface Mail {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export interface Mailer {
    send(mail: Mail): Promise<void>;
}

/**
 * Envoi par SMTP (Brevo, Resend, Postmark, Scaleway…) si SMTP_URL est défini ;
 * sinon les e-mails sont écrits dans la console (développement).
 */
export function createMailer(opts: {smtpUrl?: string; from: string; log?: (line: string) => void}): Mailer {
    if (!opts.smtpUrl) {
        const log = opts.log ?? ((line: string) => console.log(line));
        return {
            async send(mail) {
                log(`\n[e-mail non envoyé — SMTP_URL absent] À : ${mail.to}\nObjet : ${mail.subject}\n${mail.text}\n`);
            },
        };
    }
    const transport = nodemailer.createTransport(opts.smtpUrl);
    return {
        async send(mail) {
            await transport.sendMail({from: opts.from, ...mail});
        },
    };
}

const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);

function layout(title: string, intro: string, cta: string, url: string, outro: string): Pick<Mail, 'text' | 'html'> {
    const text = `${title}\n\n${intro}\n\n${cta} : ${url}\n\n${outro}`;
    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:14px;border:1px solid #e4e4e7" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700;font-size:18px">Freelance Hub</p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
<p style="margin:0 0 24px;line-height:1.5;color:#3f3f46">${esc(intro)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#0a0a0b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(cta)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#71717a">${esc(outro)}</p>
</td></tr></table></td></tr></table></body></html>`;
    return {text, html};
}

const TTL_NOTE =
    'Ce lien est valable 30 minutes et ne fonctionne qu’une fois. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.';

export const mails = {
    signup: (to: string, url: string): Mail => ({
        to,
        subject: 'Crée ton compte Freelance Hub',
        ...layout(
            'Bienvenue !',
            'Confirme ton adresse et crée la passkey qui te servira à te connecter, sans mot de passe.',
            'Créer mon compte',
            url,
            TTL_NOTE,
        ),
    }),
    recover: (to: string, url: string): Mail => ({
        to,
        subject: 'Accède à ton compte Freelance Hub',
        ...layout(
            'Accès à ton compte',
            'Ouvre ce lien sur l’appareil que tu veux utiliser : tu pourras y créer une nouvelle passkey et te reconnecter.',
            'Accéder à mon compte',
            url,
            TTL_NOTE,
        ),
    }),
};
