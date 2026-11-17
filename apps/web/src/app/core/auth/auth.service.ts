import {inject, Injectable, signal} from '@angular/core';
import {ApiClient} from '../http/api-client';

export interface Me {
    authenticated: boolean;
    email: string | null;
    /** The workspace went through the first-run setup; absent when signed out */
    onboarded?: boolean;
}

/** Signed-in account as the menu shows it; `name` is the business name, empty until filled in */
export interface Account {
    email: string;
    name: string;
}

/** Current session state. */
@Injectable({providedIn: 'root'})
export class Auth {
    private readonly api = inject(ApiClient);
    /** null = not checked yet */
    readonly authenticated = signal<boolean | null>(null);
    readonly email = signal<string | null>(null);
    readonly account = signal<Account | null>(null);
    /** false until the first-run setup is done: the app sends the user there */
    readonly onboarded = signal(false);

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
        this.onboarded.set(res.onboarded ?? false);
        return res;
    }

    /** Loaded once for the account menu; `refresh` after the business name changed */
    async loadAccount(refresh = false): Promise<void> {
        if (this.account() && !refresh) return;
        try {
            this.account.set(await this.api.get<Account>('/api/auth/account'));
        } catch {
            // Not essential: the menu shows a generic label instead
        }
    }

    async logout(): Promise<void> {
        try {
            await this.api.post('/api/auth/logout', {});
        } finally {
            this.forget();
        }
    }

    /** Signed out on the server already (logout, deleted account): only the local state is reset */
    forget() {
        this.authenticated.set(false);
        this.email.set(null);
        this.account.set(null);
        this.onboarded.set(false);
    }
}
