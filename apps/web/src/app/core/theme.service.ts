import {effect, Injectable, signal} from '@angular/core';

type Theme = 'light' | 'dark';
// Pre-rename storage key, kept so existing users keep their saved theme
const KEY = 'fh-theme';

function initialTheme(): Theme {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Storage unavailable (private mode, blocked cookies).
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({providedIn: 'root'})
export class ThemeService {
    readonly theme = signal<Theme>(initialTheme());

    constructor() {
        effect(() => {
            const t = this.theme();
            document.documentElement.classList.toggle('dark', t === 'dark');
            try {
                localStorage.setItem(KEY, t);
            } catch {
                // Storage unavailable: the theme just won't persist.
            }
        });
    }

    toggle() {
        this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
    }
}
