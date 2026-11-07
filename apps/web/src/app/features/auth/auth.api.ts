import {inject, Injectable} from '@angular/core';
import {
    startAuthentication,
    startRegistration,
    type PublicKeyCredentialCreationOptionsJSON,
    type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import {Auth} from '../../core/auth/auth.service';
import {ApiClient} from '../../core/http/api-client';
import type {EmailLink, PasskeyState} from './auth.models';

/** Account creation, passkeys and recovery codes. */
@Injectable({providedIn: 'root'})
export class AuthApi {
    private readonly api = inject(ApiClient);
    private readonly auth = inject(Auth);

    /** Sends a sign-up link (or an access link when the account already exists). */
    async signup(email: string): Promise<void> {
        await this.api.post('/api/auth/signup', {email});
    }

    /** Sends an access link (to add a passkey) if an account exists for this address. */
    async recover(email: string): Promise<void> {
        await this.api.post('/api/auth/recover', {email});
    }

    checkLink(token: string): Promise<EmailLink> {
        return this.api.post<EmailLink>('/api/auth/token', {token});
    }

    async loginWithPasskey(): Promise<void> {
        const {challengeId, options} = await this.api.post<{
            challengeId: string;
            options: PublicKeyCredentialRequestOptionsJSON;
        }>('/api/auth/passkey/login/options', {});
        const response = await startAuthentication({optionsJSON: options});
        await this.api.post('/api/auth/passkey/login/verify', {challengeId, response});
        await this.auth.refresh();
    }

    /** Returns the number of recovery codes left. */
    async loginWithRecoveryCode(code: string): Promise<number> {
        const res = await this.api.post<{remaining: number}>('/api/auth/recovery', {code});
        await this.auth.refresh();
        return res.remaining;
    }

    /**
     * Registers a passkey on this device, from an open session or an e-mailed link `token`.
     * Returns the new recovery codes when some were issued (first passkey).
     */
    async registerPasskey(name: string, token?: string): Promise<string[] | null> {
        const {challengeId, options} = await this.api.post<{
            challengeId: string;
            options: PublicKeyCredentialCreationOptionsJSON;
        }>('/api/auth/passkey/register/options', {token});
        const response = await startRegistration({optionsJSON: options});
        const res = await this.api.post<{recoveryCodes: string[] | null}>('/api/auth/passkey/register/verify', {
            challengeId,
            name,
            response,
        });
        await this.auth.refresh();
        return res.recoveryCodes;
    }

    passkeys(): Promise<PasskeyState> {
        return this.api.get<PasskeyState>('/api/auth/passkeys');
    }

    async deletePasskey(id: string): Promise<void> {
        await this.api.delete(`/api/auth/passkeys/${encodeURIComponent(id)}`);
    }

    async regenerateRecoveryCodes(): Promise<string[]> {
        const res = await this.api.post<{recoveryCodes: string[]}>('/api/auth/recovery-codes', {});
        return res.recoveryCodes;
    }
}
