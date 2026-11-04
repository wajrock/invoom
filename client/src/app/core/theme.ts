import { effect, Injectable, signal } from '@angular/core';

type Theme = 'light' | 'dark';
const KEY = 'fh-theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* stockage indisponible */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(initialTheme());

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.classList.toggle('dark', t === 'dark');
      try {
        localStorage.setItem(KEY, t);
      } catch {
        /* stockage indisponible */
      }
    });
  }

  toggle() {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}
