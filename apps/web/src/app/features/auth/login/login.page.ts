import {Logo} from '../../../shared/ui/logo/logo';
import {Component, computed, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideKeyRound, lucideMail, lucideMailCheck, lucideScanFace} from '@ng-icons/lucide';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {RecoveryCodes} from '../recovery-codes/recovery-codes';
import {LoginFlow, type LoginStep} from './login-flow';
import {EmailLinkStep} from './steps/email-link-step';
import {EmailSentStep} from './steps/email-sent-step';
import {LostAccessStep} from './steps/lost-access-step';
import {SignInStep} from './steps/sign-in-step';
import {SignUpStep} from './steps/sign-up-step';

const ICONS: Record<LoginStep, string> = {
    signin: 'lucideScanFace',
    signup: 'lucideMail',
    lost: 'lucideKeyRound',
    sent: 'lucideMailCheck',
    link: 'lucideScanFace',
    codes: 'lucideKeyRound',
};

const SUBTITLES: Record<LoginStep, string> = {
    signin: 'Connecte-toi avec Face ID, Touch ID ou le verrouillage de ton appareil.',
    signup: 'Indique ton adresse : tu recevras un lien pour créer ton compte.',
    lost: 'Utilise un code de récupération, ou reçois un lien par e-mail.',
    sent: 'Le lien te permettra de créer ta passkey.',
    link: 'Crée la passkey de cet appareil : elle remplace tout mot de passe.',
    codes: 'À garder précieusement, ils ne seront plus affichés.',
};

@Component({
    selector: 'app-login',
    imports: [
        NgIcon,
        Logo,
        HlmCardImports,
        RecoveryCodes,
        SignInStep,
        SignUpStep,
        LostAccessStep,
        EmailSentStep,
        EmailLinkStep,
    ],
    providers: [LoginFlow, provideIcons({lucideScanFace, lucideKeyRound, lucideMail, lucideMailCheck})],
    templateUrl: './login.page.html',
})
export class LoginPage {
    protected readonly flow = inject(LoginFlow);

    protected readonly icon = computed(() => ICONS[this.flow.step()]);
    protected readonly subtitle = computed(() => SUBTITLES[this.flow.step()]);
    protected readonly title = computed(() => {
        const titles: Record<LoginStep, string> = {
            signin: 'Connexion',
            signup: 'Créer un compte',
            lost: 'Retrouver l’accès',
            sent: 'Vérifie tes e-mails',
            link: this.flow.link()?.purpose === 'signup' ? 'Bienvenue !' : 'Nouvel appareil',
            codes: 'Codes de récupération',
        };
        return titles[this.flow.step()];
    });
}
