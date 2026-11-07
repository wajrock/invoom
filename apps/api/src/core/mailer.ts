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

/** Sends through SMTP when `smtpUrl` is set; otherwise prints emails to the console (development). */
export function createMailer(opts: {smtpUrl?: string; from: string}): Mailer {
    if (!opts.smtpUrl) {
        return {
            async send(mail) {
                console.warn(
                    `\n[email not sent: SMTP_URL is not set] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`,
                );
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
