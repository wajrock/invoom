import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { ThemeService } from './core/theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToasterImports],
  template: `
    <router-outlet />
    <hlm-toaster [theme]="theme.theme()" position="bottom-right" richColors />
  `,
})
export class App {
  protected readonly theme = inject(ThemeService);
}
