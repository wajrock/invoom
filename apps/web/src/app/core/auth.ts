import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { catchError, firstValueFrom, throwError } from 'rxjs';

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Me {
  authenticated: boolean;
  email: string | null;
}

export interface EmailLink {
  purpose: 'signup' | 'recover';
  email: string;
}

/** Message lisible pour les erreurs WebAuthn du navigateur (annulation, appareil incompatible…). */
export function webauthnError(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  // SimpleWebAuthn enveloppe l'erreur du navigateur : on lit aussi la cause
  const name = (err.cause instanceof Error ? err.cause.name : '') || err.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Opération annulée ou expirée.';
  if (name === 'InvalidStateError') return 'Cet appareil a déjà une passkey enregistrée.';
  if (name === 'NotSupportedError' || name === 'SecurityError') return 'Les passkeys ne sont pas disponibles dans ce navigateur.';
  return null;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  /** null = pas encore vérifié */
  readonly authenticated = signal<boolean | null>(null);
  /** Adresse du compte connecté */
  readonly email = signal<string | null>(null);

  async check(): Promise<boolean> {
    if (this.authenticated() !== null) return this.authenticated()!;
    try {
      const res = await firstValueFrom(this.http.get<Me>('/api/auth/me'));
      this.authenticated.set(res.authenticated);
      this.email.set(res.email);
    } catch {
      this.authenticated.set(false);
    }
    return this.authenticated()!;
  }

  async refresh(): Promise<Me> {
    const res = await firstValueFrom(this.http.get<Me>('/api/auth/me'));
    this.authenticated.set(res.authenticated);
    this.email.set(res.email);
    return res;
  }

  /** Envoie le lien d'inscription (ou d'accès si le compte existe déjà) à cette adresse. */
  async signup(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/signup', { email }));
  }

  /** Envoie un lien d'accès (nouvelle passkey) si un compte existe pour cette adresse. */
  async recover(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/recover', { email }));
  }

  /** Vérifie un lien reçu par e-mail. */
  checkLink(token: string): Promise<EmailLink> {
    return firstValueFrom(this.http.post<EmailLink>('/api/auth/token', { token }));
  }

  /** Connexion par passkey (Face ID, Touch ID, Windows Hello, clé de sécurité…). */
  async loginWithPasskey(): Promise<void> {
    const { challengeId, options } = await firstValueFrom(
      this.http.post<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/api/auth/passkey/login/options', {}),
    );
    const response = await startAuthentication({ optionsJSON: options });
    await firstValueFrom(this.http.post('/api/auth/passkey/login/verify', { challengeId, response }));
    await this.refresh();
  }

  /** Connexion avec un code de récupération ; renvoie le nombre de codes restants. */
  async loginWithRecoveryCode(code: string): Promise<number> {
    const res = await firstValueFrom(this.http.post<{ remaining: number }>('/api/auth/recovery', { code }));
    await this.refresh();
    return res.remaining;
  }

  /**
   * Enregistre une passkey sur cet appareil (session ouverte, ou lien reçu par e-mail `token`).
   * Renvoie les nouveaux codes de récupération s'il en a été émis (première passkey).
   */
  async registerPasskey(name: string, token?: string): Promise<string[] | null> {
    const { challengeId, options } = await firstValueFrom(
      this.http.post<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/api/auth/passkey/register/options', { token }),
    );
    const response = await startRegistration({ optionsJSON: options });
    const res = await firstValueFrom(
      this.http.post<{ recoveryCodes: string[] | null }>('/api/auth/passkey/register/verify', { challengeId, name, response }),
    );
    await this.refresh();
    return res.recoveryCodes;
  }

  passkeys(): Promise<{ passkeys: PasskeyInfo[]; recoveryCodesRemaining: number }> {
    return firstValueFrom(this.http.get<{ passkeys: PasskeyInfo[]; recoveryCodesRemaining: number }>('/api/auth/passkeys'));
  }

  async deletePasskey(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/auth/passkeys/${encodeURIComponent(id)}`));
  }

  async regenerateRecoveryCodes(): Promise<string[]> {
    const res = await firstValueFrom(this.http.post<{ recoveryCodes: string[] }>('/api/auth/recovery-codes', {}));
    return res.recoveryCodes;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.authenticated.set(false);
      this.email.set(null);
    }
  }
}

/** Nom proposé par défaut pour la passkey de cet appareil. */
export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'PC Windows';
  return 'Cet appareil';
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
