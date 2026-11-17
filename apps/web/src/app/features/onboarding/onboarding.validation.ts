/** Field checks of the first-run setup: each returns the message to show, or '' when the value is fine. */

const digitsOf = (s: string) => s.replace(/[\s.-]/g, '');

/** Luhn checksum, used by SIREN and SIRET numbers */
function luhn(digits: string): boolean {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        let d = Number(digits[digits.length - 1 - i]);
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    return sum % 10 === 0;
}

export function siretError(value: string): string {
    const siret = digitsOf(value);
    if (!siret) return 'Indique ton SIRET.';
    // La Poste's establishments do not follow Luhn: the sum of their digits is a multiple of 5 instead
    const valid =
        /^\d{14}$/.test(siret) &&
        (siret.startsWith('356000000') ? [...siret].reduce((s, d) => s + Number(d), 0) % 5 === 0 : luhn(siret));
    return valid ? '' : 'Saisis un SIRET valide.';
}

/** "12345678900012" → "123 456 789 00012", as printed on invoices; other input is left as typed */
export function formatSiret(value: string): string {
    const s = digitsOf(value);
    return /^\d{14}$/.test(s) ? `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}` : value;
}

export function emailError(value: string): string {
    const email = value.trim();
    if (!email) return 'Indique l’adresse e-mail où tes clients peuvent te joindre.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? ''
        : 'Cette adresse e-mail n’est pas valide (exemple : nom@domaine.fr).';
}

export function addressError(value: string): string {
    const address = value.trim();
    if (!address) return 'Indique ton adresse : rue, code postal et ville.';
    return /\d{4,5}/.test(address) ? '' : 'Ajoute le code postal et la ville.';
}

/** Optional: checked only when filled in (ISO 13616, mod 97) */
export function ibanError(value: string): string {
    const iban = value.replace(/\s/g, '').toUpperCase();
    if (!iban) return '';
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) {
        return 'Un IBAN commence par 2 lettres et 2 chiffres (exemple : FR76 3000 6000 …).';
    }
    const rearranged = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let rest = 0;
    for (const d of rearranged) rest = (rest * 10 + Number(d)) % 97;
    return rest === 1 ? '' : 'Cet IBAN n’est pas valide : vérifie les chiffres.';
}

export function bicError(value: string): string {
    const bic = value.replace(/\s/g, '').toUpperCase();
    if (!bic) return '';
    return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)
        ? ''
        : 'Un BIC fait 8 ou 11 caractères (exemple : AGRIFRPP).';
}
