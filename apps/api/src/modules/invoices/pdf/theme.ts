import {readFileSync} from 'node:fs';

/** Same palette as the app (apps/web/src/styles.css): petrol accent on warm neutrals */
export const COLORS = {
    ink: '#24201c',
    muted: '#6f665d',
    accent: '#005461',
    /** Pastel accent for secondary bands (the app's accent surface) */
    accentSoft: '#dfecea',
    soft: '#f7f5f2',
    border: '#e6e0d8',
    /** Body text of the terms, a step lighter than ink */
    text: '#3b3129',
    white: '#ffffff',
};

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const M = 48;
export const CW = PAGE_W - 2 * M;
export const BOTTOM = PAGE_H - 56;

/** Geist font (SIL OFL, see assets/fonts/Geist-OFL.txt), embedded in every PDF. */
export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
const FONT_FILES: Record<Weight, string> = {
    regular: 'Geist-Regular.ttf',
    medium: 'Geist-Medium.ttf',
    semibold: 'Geist-SemiBold.ttf',
    bold: 'Geist-Bold.ttf',
};
export const FONTS = Object.fromEntries(
    Object.entries(FONT_FILES).map(([w, file]) => [
        w,
        readFileSync(new URL(`../../../../assets/fonts/${file}`, import.meta.url)),
    ]),
) as Record<Weight, Buffer>;

/** Geist vertical metrics (em), used to center text in a band. */
export const GEIST_ASCENT = 1.005;
export const GEIST_CAP = 0.71;
