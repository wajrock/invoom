import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucideLock } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { errorMessage } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, NgIcon, HlmButtonImports, HlmCardImports, HlmInputImports, HlmLabelImports],
  providers: [provideIcons({ lucideLock, lucideLoader2 })],
  template: `
    <div class="bg-muted/40 grid min-h-dvh place-items-center p-4">
      <section hlmCard class="w-full max-w-sm">
        <div hlmCardHeader>
          <div class="bg-primary text-primary-foreground mb-2 grid size-10 place-items-center rounded-lg">
            <ng-icon name="lucideLock" class="text-lg" />
          </div>
          <h1 hlmCardTitle class="text-xl">Freelance Hub</h1>
          <p hlmCardDescription>Saisis ton code d'accès pour continuer.</p>
        </div>
        <form hlmCardContent class="grid gap-4" (ngSubmit)="submit()">
          <div class="grid gap-2">
            <label hlmLabel for="code">Code d'accès</label>
            <input
              hlmInput
              id="code"
              name="code"
              type="password"
              autocomplete="current-password"
              autofocus
              required
              [(ngModel)]="code"
              [disabled]="loading()"
            />
          </div>
          @if (error()) {
            <p class="text-destructive text-sm" role="alert">{{ error() }}</p>
          }
          <button hlmBtn type="submit" class="w-full" [disabled]="loading() || !code">
            @if (loading()) {
              <ng-icon name="lucideLoader2" class="animate-spin" />
            }
            Se connecter
          </button>
        </form>
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected code = '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  async submit() {
    if (!this.code) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.code);
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(errorMessage(err));
      this.code = '';
    } finally {
      this.loading.set(false);
    }
  }
}
