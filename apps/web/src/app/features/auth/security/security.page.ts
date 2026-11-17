import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucidePlus, lucideRotateCcw, lucideScanFace, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {Auth} from '../../../core/auth/auth.service';
import {errorMessage} from '../../../core/http/error-message';
import {NavigationService} from '../../../core/navigation/navigation.service';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {SettingsSection} from '../../../shared/ui/settings-section/settings-section';
import {Spinner} from '../../../shared/ui/spinner/spinner';
import {WarningBanner} from '../../../shared/ui/warning-banner/warning-banner';
import {AgentConnections} from '../../agents/agent-connections';
import {AuthApi} from '../auth.api';
import type {PasskeyInfo, PasskeyState} from '../auth.models';
import {RecoveryCodes} from '../recovery-codes/recovery-codes';
import {forgetPasskeys, guessDeviceName, webauthnError} from '../webauthn';
import {Confirm} from '../../../shared/ui/confirm/confirm';

@Component({
    selector: 'app-security',
    imports: [
        AgentConnections,
        FormsModule,
        NgIcon,
        FrDatePipe,
        HlmButtonImports,
        HlmBadgeImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSkeletonImports,
        SettingsSection,
        RecoveryCodes,
        Spinner,
        WarningBanner,
    ],
    providers: [provideIcons({lucideScanFace, lucidePlus, lucideTrash2, lucideRotateCcw})],
    templateUrl: './security.page.html',
})
export class SecurityPage {
    private readonly api = inject(AuthApi);
    private readonly confirm = inject(Confirm);
    private readonly nav = inject(NavigationService);
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

    async remove(p: PasskeyInfo) {
        if (
            !(await this.confirm.ask({
                title: `Supprimer « ${p.name} » ?`,
                description: 'Cet appareil ne pourra plus se connecter à ton compte.',
                confirmLabel: 'Supprimer',
                destructive: true,
            }))
        )
            return;
        return this.run(async () => {
            await this.api.deletePasskey(p.id);
            forgetPasskeys([p.id]);
            toast.success('Passkey supprimée');
        });
    }

    async deleteAccount() {
        const email = this.email();
        if (!email) return;
        if (
            !(await this.confirm.ask({
                title: 'Supprimer ton compte ?',
                description:
                    'Toutes tes données sont effacées définitivement : factures et fichiers, paiements, clients, prestations, échéances, infos d’entreprise et paramètres, ainsi que tes passkeys, codes de récupération et agents connectés. Rien ne pourra être récupéré.',
                confirmLabel: 'Supprimer définitivement',
                destructive: true,
                confirmText: email,
                confirmTextLabel: 'Pour confirmer, saisis ton adresse e-mail',
            }))
        )
            return;
        const passkeyIds = this.state()?.passkeys.map((p) => p.id) ?? [];
        this.busy.set(true);
        try {
            await this.api.deleteAccount(email);
            forgetPasskeys(passkeyIds);
            toast.success('Ton compte a été supprimé');
            await this.nav.navigateByUrl('/login');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }

    async regenerate() {
        if (
            !(await this.confirm.ask({
                title: 'Générer de nouveaux codes ?',
                description: 'Les codes actuels ne fonctionneront plus : garde bien les nouveaux.',
                confirmLabel: 'Générer',
            }))
        )
            return;
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
