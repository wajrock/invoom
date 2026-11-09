import {effect, Injectable, signal} from '@angular/core';

type Theme = 'light' | 'dark';
// Pre-rename storage key, kept so existing users keep their saved theme
const KEY = 'fh-theme';
/** Same as --background, and as in public/theme-init.js */
const BAR_COLORS: Record<Theme, string> = {light: '#ffffff', dark: '#09090b'};

/** iPhone and iPad (iPadOS reports a Mac with a touch screen) */
const isIos = () =>
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** False when storage is unavailable: the theme then only lasts until the page is closed */
function save(theme: Theme): boolean {
    try {
        localStorage.setItem(KEY, theme);
        return true;
    } catch {
        return false;
    }
}

function initialTheme(): Theme {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Storage unavailable (private mode, blocked cookies).
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Browser bar colour for Chrome and older Safari; Safari 26 ignores it (see public/theme-init.js). */
function setBarColor(color: string) {
    for (const old of document.querySelectorAll('meta[name="theme-color"]')) old.remove();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.append(meta);
}

@Injectable({providedIn: 'root'})
export class ThemeService {
    readonly theme = signal<Theme>(initialTheme());

    constructor() {
        effect(() => {
            const t = this.theme();
            document.documentElement.classList.toggle('dark', t === 'dark');
            document.documentElement.style.backgroundColor = BAR_COLORS[t];
            setBarColor(BAR_COLORS[t]);
            save(t);
        });
    }

    toggle() {
        const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
        // iOS only reads the status bar colour when a page loads: reload with the new theme saved. Without storage
        // the reload would bring the old theme back, so the theme then changes in place (status bar unchanged).
        if (isIos() && save(next)) {
            location.reload();
            return;
        }
        this.theme.set(next);
    }
}
