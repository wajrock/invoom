import {computed, Injectable, signal} from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Choices offered in Settings › Preferences */
export const THEME_OPTIONS: {value: ThemeMode; label: string; icon: string}[] = [
    {value: 'system', label: 'Système', icon: 'lucideMonitor'},
    {value: 'light', label: 'Clair', icon: 'lucideSun'},
    {value: 'dark', label: 'Sombre', icon: 'lucideMoon'},
];

/** Same key and colours as public/theme-init.js, which applies the theme before Angular starts */
const KEY = 'invoom-theme';
const BAR_COLORS = {light: '#f4f4f4', dark: '#121212'};

function savedMode(): ThemeMode {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Storage unavailable (private browsing): follow the device
    }
    return 'system';
}

/** iPhone and iPad (iPadOS reports a Mac with a touch screen) */
const isIos = () =>
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * Light or dark theme: the device setting by default, or the one chosen in Settings › Preferences. Applied as
 * <html data-theme>, which switches the palette in styles.css.
 */
@Injectable({providedIn: 'root'})
export class ThemeService {
    readonly mode = signal<ThemeMode>(savedMode());
    private readonly systemQuery = matchMedia('(prefers-color-scheme: dark)');
    private readonly systemDark = signal(this.systemQuery.matches);
    readonly theme = computed(() => {
        const mode = this.mode();
        return mode === 'system' ? (this.systemDark() ? 'dark' : 'light') : mode;
    });

    constructor() {
        // The device can switch on its own (automatic dark mode at sunset)
        this.systemQuery.addEventListener('change', (e) => {
            this.systemDark.set(e.matches);
            this.apply();
        });
        this.apply();
    }

    /** Right away rather than in an effect: what reads the colours next (the chart) must see the new ones */
    private apply() {
        const theme = this.theme();
        document.documentElement.dataset['theme'] = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[theme]);
    }

    set(mode: ThemeMode) {
        const before = this.theme();
        try {
            if (mode === 'system') localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, mode);
        } catch {
            // Not saved: the choice lasts until the page is closed
        }
        this.mode.set(mode);
        this.apply();
        // iOS Safari only reads the status bar colour when a page loads: reload so it follows the new theme
        if (isIos() && this.theme() !== before) location.reload();
    }
}
