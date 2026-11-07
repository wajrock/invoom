import {toast} from '@spartan-ng/brain/sonner';
import {Pipe, type PipeTransform} from '@angular/core';

const eur = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'});
const eurRound = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});

/** Centimes → "1 234,56 €" */
export function formatCents(cents: number | null | undefined, round = false): string {
    if (cents === null || cents === undefined) return '—';
    return (round ? eurRound : eur).format(cents / 100);
}

export function formatMoney(cents: number, currency: string): string {
    try {
        return new Intl.NumberFormat('fr-FR', {style: 'currency', currency}).format(cents / 100);
    } catch {
        return `${(cents / 100).toFixed(2)} ${currency}`;
    }
}

/** "1 234,56" ou "1234.56" → centimes (null si vide ou invalide) */
export function parseEuros(input: string | number | null | undefined): number | null {
    if (input === null || input === undefined) return null;
    const s = String(input)
        .replace(/[\s €]/g, '')
        .replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Centimes → "1234,56" pour un champ de saisie */
export function centsToInput(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return '';
    return (cents / 100).toFixed(2).replace('.', ',');
}

/** "2026-03-15" → "15 mars 2026" */
export function formatDate(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: style === 'long' ? 'long' : 'short',
        year: 'numeric',
    });
}

export function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nombre de jours entre aujourd'hui et la date (négatif si passée) */
export function daysUntil(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    const target = new Date(y, m - 1, d).getTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((target - today) / 864e5);
}

export function relativeDays(iso: string): string {
    const n = daysUntil(iso);
    if (n === 0) return "aujourd'hui";
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
}

export function formatPercent(rate: number, digits = 1): string {
    return `${(rate * 100).toLocaleString('fr-FR', {maximumFractionDigits: digits})} %`;
}

export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

@Pipe({name: 'eur'})
export class EurPipe implements PipeTransform {
    transform(cents: number | null | undefined, round = false): string {
        return formatCents(cents, round);
    }
}

@Pipe({name: 'frDate'})
export class FrDatePipe implements PipeTransform {
    transform(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
        return formatDate(iso, style);
    }
}

/** Copie dans le presse-papiers avec notification */
export async function copyToClipboard(text: string, what = 'Copié'): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${what} dans le presse-papiers`);
    } catch {
        toast.error('Copie impossible');
    }
}
