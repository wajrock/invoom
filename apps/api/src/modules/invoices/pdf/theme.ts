import {readFileSync} from 'node:fs';

export const COLORS = {
    ink: '#1f2330',
    muted: '#6b7080',
    accent: '#4338ca',
    /** Pastel accent (≈ 14 % on white) for secondary bands */
    accentSoft: '#e6e4f8',
    soft: '#f5f6f9',
    border: '#e2e4ea',
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
