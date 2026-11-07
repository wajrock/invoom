import {inject, Injectable, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {errorMessage} from '../../../core/http/error-message';
import {AuthApi} from '../auth.api';
import type {EmailLink} from '../auth.models';
import {guessDeviceName, webauthnError} from '../webauthn';

/**
 * - signin: passkey sign-in
 * - signup: account creation (e-mail → link)
 * - lost: lost device (recovery code or e-mailed link)
 * - sent: e-mail sent
 * - link: e-mailed link opened → passkey creation
 * - codes: recovery codes to keep
 */
export type LoginStep = 'signin' | 'signup' | 'lost' | 'sent' | 'link' | 'codes';

/** State shared by the login steps; provided by the login page. */
@Injectable()
export class LoginFlow {
    private readonly api = inject(AuthApi);
    private readonly router = inject(Router);
    private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

    readonly step = signal<LoginStep>(this.token ? 'link' : 'signin');
    readonly loading = signal(false);
    readonly error = signal('');
    readonly email = signal('');
    readonly link = signal<EmailLink | null>(null);
    readonly codes = signal<string[]>([]);
    readonly deviceName = signal(guessDeviceName());

    constructor() {
        if (this.token) {
            this.api.checkLink(this.token).then(
                (l) => this.link.set(l),
                (err) => this.error.set(errorMessage(err)),
            );
        }
    }

    goTo(step: LoginStep) {
        this.error.set('');
        this.step.set(step);
    }

    signin() {
        return this.run(async () => {
            await this.api.loginWithPasskey();
            await this.enter();
        });
    }

    sendSignup() {
        return this.run(async () => {
            await this.api.signup(this.email().trim());
            this.step.set('sent');
        });
    }

    sendRecover() {
        return this.run(async () => {
            await this.api.recover(this.email().trim());
            this.step.set('sent');
        });
    }

    /** Returns true when the code was accepted. */
    useCode(code: string) {
        return this.run(async () => {
            const remaining = await this.api.loginWithRecoveryCode(code);
            // Fallback sign-in: invite the user to register a passkey on this device
            await this.router.navigate(['/securite'], {queryParams: {recovered: remaining}});
        });
    }

    createPasskey() {
        return this.run(async () => {
            const codes = await this.api.registerPasskey(this.deviceName().trim(), this.token ?? undefined);
            if (codes?.length) {
                this.codes.set(codes);
                this.step.set('codes');
            } else {
                await this.enter();
            }
        });
    }

    async enter() {
        await this.router.navigateByUrl('/');
    }

    private async run(action: () => Promise<void>): Promise<boolean> {
        this.loading.set(true);
        this.error.set('');
        try {
            await action();
            return true;
        } catch (err) {
            this.error.set(webauthnError(err) ?? errorMessage(err));
            return false;
        } finally {
            this.loading.set(false);
        }
    }
}
