import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  /** null = pas encore vérifié */
  readonly authenticated = signal<boolean | null>(null);

  async check(): Promise<boolean> {
    if (this.authenticated() !== null) return this.authenticated()!;
    try {
      const res = await firstValueFrom(this.http.get<{ authenticated: boolean }>('/api/auth/me'));
      this.authenticated.set(res.authenticated);
    } catch {
      this.authenticated.set(false);
    }
    return this.authenticated()!;
  }

  async login(code: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/login', { code }));
    this.authenticated.set(true);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.authenticated.set(false);
    }
  }
}

// inject() doit être appelé avant tout await (contexte d'injection synchrone)
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return (await auth.check()) || router.parseUrl('/login');
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return !(await auth.check()) || router.parseUrl('/');
};

/** Session expirée : retour à l'écran de connexion. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/api/auth/')) {
        auth.authenticated.set(false);
        void router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
