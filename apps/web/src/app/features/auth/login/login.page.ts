import {Component, computed, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCodeXml, lucideLock, lucideScanFace} from '@ng-icons/lucide';
import {BrandPattern} from '../../../shared/ui/brand-pattern/brand-pattern';
import {Logo} from '../../../shared/ui/logo/logo';
import {RecoveryCodes} from '../recovery-codes/recovery-codes';
import {LoginFlow, type LoginStep} from './login-flow';
import {EmailLinkStep} from './steps/email-link-step';
import {EmailSentStep} from './steps/email-sent-step';
import {LostAccessStep} from './steps/lost-access-step';
import {SignInStep} from './steps/sign-in-step';
import {SignUpStep} from './steps/sign-up-step';

const CAPABILITIES = [
    {icon: 'lucideScanFace', label: 'Sans mot de passe', detail: 'Face ID, Touch ID ou le code de ton appareil.'},
    {
        icon: 'lucideLock',
        label: 'Données chiffrées',
        detail: 'Chaque espace a sa propre clé, isolé des autres comptes.',
    },
    {icon: 'lucideCodeXml', label: 'Open source', detail: 'Code public, que tu peux aussi héberger toi-même.'},
];

const SUBTITLES: Record<LoginStep, string> = {
    signin: 'Avec Face ID, Touch ID ou le code de ton appareil.',
    signup: 'Commence avec ton adresse e\u2011mail, sans mot de passe.',
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
        BrandPattern,
        RecoveryCodes,
        SignInStep,
        SignUpStep,
        LostAccessStep,
        EmailSentStep,
        EmailLinkStep,
    ],
    providers: [LoginFlow, provideIcons({lucideScanFace, lucideLock, lucideCodeXml})],
    templateUrl: './login.page.html',
})
export class LoginPage {
    protected readonly flow = inject(LoginFlow);
    protected readonly capabilities = CAPABILITIES;

    protected readonly subtitle = computed(() => SUBTITLES[this.flow.step()]);
    protected readonly title = computed(() => {
        const titles: Record<LoginStep, string> = {
            signin: 'Bon retour',
            signup: 'Créer un compte',
            lost: 'Retrouver l’accès',
            sent: 'Vérifie tes e-mails',
            link: this.flow.link()?.purpose === 'signup' ? 'Bienvenue !' : 'Nouvel appareil',
            codes: 'Codes de récupération',
        };
        return titles[this.flow.step()];
    });
}
