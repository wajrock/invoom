import {inject, Injectable, signal} from '@angular/core';
import {ApiClient} from '../http/api-client';

export interface Me {
    authenticated: boolean;
    email: string | null;
}

/** Current session state. */
@Injectable({providedIn: 'root'})
export class Auth {
    private readonly api = inject(ApiClient);
    /** null = not checked yet */
    readonly authenticated = signal<boolean | null>(null);
    readonly email = signal<string | null>(null);

    async check(): Promise<boolean> {
        if (this.authenticated() !== null) return this.authenticated()!;
        try {
            await this.refresh();
        } catch {
            this.authenticated.set(false);
        }
        return this.authenticated()!;
    }

    async refresh(): Promise<Me> {
        const res = await this.api.get<Me>('/api/auth/me');
        this.authenticated.set(res.authenticated);
        this.email.set(res.email);
        return res;
    }

    async logout(): Promise<void> {
        try {
            await this.api.post('/api/auth/logout', {});
        } finally {
            this.authenticated.set(false);
            this.email.set(null);
        }
    }
}
