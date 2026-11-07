import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucidePlus, lucideRotateCcw, lucideScanFace, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {Auth} from '../../../core/auth/auth.service';
import {errorMessage} from '../../../core/http/error-message';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {PageHeader} from '../../../shared/ui/page-header/page-header';
import {Spinner} from '../../../shared/ui/spinner/spinner';
import {WarningBanner} from '../../../shared/ui/warning-banner/warning-banner';
import {AuthApi} from '../auth.api';
import type {PasskeyInfo, PasskeyState} from '../auth.models';
import {RecoveryCodes} from '../recovery-codes/recovery-codes';
import {guessDeviceName, webauthnError} from '../webauthn';

@Component({
    selector: 'app-security',
    imports: [
        FormsModule,
        NgIcon,
        FrDatePipe,
        HlmButtonImports,
        HlmCardImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSkeletonImports,
        PageHeader,
        RecoveryCodes,
        Spinner,
        WarningBanner,
    ],
    providers: [provideIcons({lucideScanFace, lucidePlus, lucideTrash2, lucideRotateCcw})],
    templateUrl: './security.page.html',
})
export class SecurityPage {
    private readonly api = inject(AuthApi);
    protected readonly email = inject(Auth).email;
    private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

    protected readonly state = signal<PasskeyState | null>(null);
    protected readonly error = signal('');
    protected readonly busy = signal(false);
    protected readonly codes = signal<string[] | null>(null);
    /** Codes left after a recovery-code sign-in (from the login redirect) */
    protected readonly recovered = signal<number | null>(
        this.params.has('recovered') ? Number(this.params.get('recovered')) : null,
    );
    protected deviceName = guessDeviceName();

    constructor() {
        void this.load();
    }

    async load() {
        try {
            this.state.set(await this.api.passkeys());
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    add() {
        return this.run(async () => {
            const codes = await this.api.registerPasskey(this.deviceName.trim());
            toast.success('Passkey enregistrée sur cet appareil');
            this.recovered.set(null);
            if (codes?.length) this.codes.set(codes);
        });
    }

    remove(p: PasskeyInfo) {
        if (!confirm(`Supprimer la passkey « ${p.name} » ? Cet appareil ne pourra plus se connecter.`)) return;
        return this.run(async () => {
            await this.api.deletePasskey(p.id);
            toast.success('Passkey supprimée');
        });
    }

    regenerate() {
        if (!confirm('Générer de nouveaux codes ? Les anciens ne fonctionneront plus.')) return;
        return this.run(async () => {
            this.codes.set(await this.api.regenerateRecoveryCodes());
        });
    }

    private async run(action: () => Promise<void>) {
        this.busy.set(true);
        try {
            await action();
            await this.load();
        } catch (err) {
            toast.error(webauthnError(err) ?? errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }
}
