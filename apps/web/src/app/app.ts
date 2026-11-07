import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { ThemeService } from './core/theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToasterImports],
  template: `
    <router-outlet />
    <hlm-toaster [theme]="theme.theme()" [position]="mobile() ? 'top-center' : 'bottom-right'" richColors />
  `,
})
export class App {
  protected readonly theme = inject(ThemeService);

  /** Sur mobile, les notifications arrivent en haut pour ne pas masquer la barre d'onglets */
  private readonly query = matchMedia('(width < 48rem)');
  protected readonly mobile = signal(this.query.matches);

  constructor() {
    this.query.addEventListener('change', (e) => this.mobile.set(e.matches));
  }
}
