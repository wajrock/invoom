import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideArrowLeft,
    lucideKeyRound,
    lucideLoader2,
    lucideMail,
    lucideMailCheck,
    lucideScanFace,
} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {errorMessage} from '../core/api';
import {Auth, guessDeviceName, webauthnError, type EmailLink} from '../core/auth';
import {RecoveryCodes} from '../shared/recovery-codes';

/**
 * - signin : connexion par passkey
 * - signup : création de compte (e-mail → lien)
 * - lost : appareil perdu (code de récupération ou lien par e-mail)
 * - sent : e-mail envoyé
 * - link : lien reçu par e-mail → création de la passkey
 * - codes : codes de récupération à conserver
 */
type Mode = 'signin' | 'signup' | 'lost' | 'sent' | 'link' | 'codes';

@Component({
    selector: 'app-login',
    imports: [FormsModule, NgIcon, RecoveryCodes, HlmButtonImports, HlmCardImports, HlmInputImports, HlmLabelImports],
    providers: [
        provideIcons({lucideScanFace, lucideKeyRound, lucideLoader2, lucideArrowLeft, lucideMail, lucideMailCheck}),
    ],
    template: `
        <div class="bg-muted/40 grid min-h-dvh place-items-center p-4">
            <section hlmCard class="w-full max-w-sm">
                <div hlmCardHeader>
                    <div class="bg-primary text-primary-foreground mb-2 grid size-10 place-items-center rounded-lg">
                        <ng-icon [name]="icon()" class="text-lg" />
                    </div>
                    <h1 hlmCardTitle class="text-xl">{{ title() }}</h1>
                    <p hlmCardDescription>{{ subtitle() }}</p>
                </div>

                <div hlmCardContent class="grid gap-4">
                    @switch (mode()) {
                        @case ('signin') {
                            <button hlmBtn class="h-11 w-full text-[15px]" [disabled]="loading()" (click)="signin()">
                                @if (loading()) {
                                    <ng-icon name="lucideLoader2" class="animate-spin" />
                                } @else {
                                    <ng-icon name="lucideScanFace" />
                                }
                                Se connecter avec une passkey
                            </button>
                            @if (error()) {
                                <p class="text-destructive text-sm" role="alert">{{ error() }}</p>
                            }
                            <div class="grid gap-1 text-center text-sm">
                                <button hlmBtn variant="link" class="h-auto p-0" (click)="switchTo('signup')">
                                    Créer un compte
                                </button>
                                <button
                                    hlmBtn
                                    variant="link"
                                    class="text-muted-foreground h-auto p-0"
                                    (click)="switchTo('lost')"
                                >
                                    Appareil perdu ou nouvel appareil ?
                                </button>
                            </div>
                        }

                        @case ('signup') {
                            <form class="grid gap-4" (ngSubmit)="sendSignup()">
                                <div class="grid gap-2">
                                    <label hlmLabel for="email">Adresse e-mail</label>
                                    <input
                                        hlmInput
                                        id="email"
                                        name="email"
                                        type="email"
                                        autocomplete="email"
                                        required
                                        [(ngModel)]="email"
                                        [disabled]="loading()"
                                    />
                                </div>
                                @if (error()) {
                                    <p class="text-destructive text-sm" role="alert">{{ error() }}</p>
                                }
                                <button hlmBtn type="submit" class="w-full" [disabled]="loading() || !email.trim()">
                                    @if (loading()) {
                                        <ng-icon name="lucideLoader2" class="animate-spin" />
                                    }
                                    Recevoir le lien d'inscription
                                </button>
                                <p class="text-muted-foreground text-xs">
                                    Pas de mot de passe : tu te connecteras avec Face ID, Touch ID ou le verrouillage de
                                    ton appareil.
                                </p>
                            </form>
                            <button
                                hlmBtn
                                variant="ghost"
                                size="sm"
                                class="justify-self-start"
                                (click)="switchTo('signin')"
                            >
                                <ng-icon name="lucideArrowLeft" /> J'ai déjà un compte
                            </button>
                        }

                        @case ('lost') {
                            <form class="grid gap-3" (ngSubmit)="useCode()">
                                <label hlmLabel for="code">Avec un code de récupération</label>
                                <input
                                    hlmInput
                                    id="code"
                                    name="code"
                                    autocomplete="one-time-code"
                                    autocapitalize="characters"
                                    spellcheck="false"
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    class="font-mono uppercase"
                                    [(ngModel)]="code"
                                    [disabled]="loading()"
                                />
                                <button
                                    hlmBtn
                                    type="submit"
                                    variant="outline"
                                    class="w-full"
                                    [disabled]="loading() || !code.trim()"
                                >
                                    Se connecter avec ce code
                                </button>
                            </form>
                            <div class="text-muted-foreground flex items-center gap-3 text-xs">
                                <span class="bg-border h-px flex-1"></span>ou<span class="bg-border h-px flex-1"></span>
                            </div>
                            <form class="grid gap-3" (ngSubmit)="sendRecover()">
                                <label hlmLabel for="lost-email">Par e-mail</label>
                                <input
                                    hlmInput
                                    id="lost-email"
                                    name="email"
                                    type="email"
                                    autocomplete="email"
                                    [(ngModel)]="email"
                                    [disabled]="loading()"
                                />
                                <button
                                    hlmBtn
                                    type="submit"
                                    variant="outline"
                                    class="w-full"
                                    [disabled]="loading() || !email.trim()"
                                >
                                    <ng-icon name="lucideMail" /> Recevoir un lien d'accès
                                </button>
                            </form>
                            @if (error()) {
                                <p class="text-destructive text-sm" role="alert">{{ error() }}</p>
                            }
                            <button
                                hlmBtn
                                variant="ghost"
                                size="sm"
                                class="justify-self-start"
                                (click)="switchTo('signin')"
                            >
                                <ng-icon name="lucideArrowLeft" /> Retour
                            </button>
                        }

                        @case ('sent') {
                            <p class="text-sm">
                                Si l'adresse <b>{{ email.trim() }}</b> est valide, un lien vient d'y être envoyé. Il est
                                valable 30 minutes : ouvre-le sur l'appareil avec lequel tu veux te connecter.
                            </p>
                            <p class="text-muted-foreground text-xs">
                                Rien reçu ? Vérifie les indésirables, puis réessaie dans quelques minutes.
                            </p>
                            <button
                                hlmBtn
                                variant="ghost"
                                size="sm"
                                class="justify-self-start"
                                (click)="switchTo('signin')"
                            >
                                <ng-icon name="lucideArrowLeft" /> Retour à la connexion
                            </button>
                        }

                        @case ('link') {
                            @if (link(); as l) {
                                <form class="grid gap-4" (ngSubmit)="createPasskey()">
                                    <p class="bg-muted rounded-lg px-3 py-2 text-sm">{{ l.email }}</p>
                                    <div class="grid gap-2">
                                        <label hlmLabel for="device">Nom de cet appareil</label>
                                        <input
                                            hlmInput
                                            id="device"
                                            name="device"
                                            required
                                            maxlength="60"
                                            [(ngModel)]="deviceName"
                                            [disabled]="loading()"
                                        />
                                    </div>
                                    @if (error()) {
                                        <p class="text-destructive text-sm" role="alert">{{ error() }}</p>
                                    }
                                    <button
                                        hlmBtn
                                        type="submit"
                                        class="h-11 w-full text-[15px]"
                                        [disabled]="loading() || !deviceName.trim()"
                                    >
                                        @if (loading()) {
                                            <ng-icon name="lucideLoader2" class="animate-spin" />
                                        } @else {
                                            <ng-icon name="lucideScanFace" />
                                        }
                                        Créer la passkey
                                    </button>
                                </form>
                            } @else if (error()) {
                                <p class="text-destructive text-sm" role="alert">{{ error() }}</p>
                                <button hlmBtn variant="outline" (click)="switchTo('lost')">
                                    Demander un nouveau lien
                                </button>
                            } @else {
                                <p class="text-muted-foreground flex items-center gap-2 text-sm">
                                    <ng-icon name="lucideLoader2" class="animate-spin" /> Vérification du lien…
                                </p>
                            }
                        }

                        @case ('codes') {
                            <app-recovery-codes [codes]="codes()" (done)="enter()" />
                        }
                    }
                </div>
            </section>
        </div>
    `,
})
export class LoginPage {
    protected readonly auth = inject(Auth);
    private readonly router = inject(Router);
    private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

    protected readonly mode = signal<Mode>(this.token ? 'link' : 'signin');
    protected readonly loading = signal(false);
    protected readonly error = signal('');
    protected readonly codes = signal<string[]>([]);
    protected readonly link = signal<EmailLink | null>(null);
    protected email = '';
    protected code = '';
    protected deviceName = guessDeviceName();

    constructor() {
        if (this.token) {
            this.auth.checkLink(this.token).then(
                (l) => this.link.set(l),
                (err) => this.error.set(errorMessage(err)),
            );
        }
    }

    protected icon() {
        return {
            signin: 'lucideScanFace',
            signup: 'lucideMail',
            lost: 'lucideKeyRound',
            sent: 'lucideMailCheck',
            link: 'lucideScanFace',
            codes: 'lucideKeyRound',
        }[this.mode()];
    }

    protected title() {
        const l = this.link();
        return {
            signin: 'Freelance Hub',
            signup: 'Créer un compte',
            lost: 'Retrouver l’accès',
            sent: 'Vérifie tes e-mails',
            link: l?.purpose === 'signup' ? 'Bienvenue !' : 'Nouvel appareil',
            codes: 'Codes de récupération',
        }[this.mode()];
    }

    protected subtitle() {
        return {
            signin: 'Connecte-toi avec Face ID, Touch ID ou le verrouillage de ton appareil.',
            signup: 'Indique ton adresse : tu recevras un lien pour créer ton compte.',
            lost: 'Utilise un code de récupération, ou reçois un lien par e-mail.',
            sent: 'Le lien te permettra de créer ta passkey.',
            link: 'Crée la passkey de cet appareil : elle remplace tout mot de passe.',
            codes: 'À garder précieusement, ils ne seront plus affichés.',
        }[this.mode()];
    }

    protected switchTo(mode: Mode) {
        this.error.set('');
        this.mode.set(mode);
    }

    private async run(action: () => Promise<void>) {
        this.loading.set(true);
        this.error.set('');
        try {
            await action();
        } catch (err) {
            this.error.set(webauthnError(err) ?? errorMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    signin() {
        return this.run(async () => {
            await this.auth.loginWithPasskey();
            await this.enter();
        });
    }

    sendSignup() {
        return this.run(async () => {
            await this.auth.signup(this.email.trim());
            this.mode.set('sent');
        });
    }

    sendRecover() {
        return this.run(async () => {
            await this.auth.recover(this.email.trim());
            this.mode.set('sent');
        });
    }

    useCode() {
        return this.run(async () => {
            const remaining = await this.auth.loginWithRecoveryCode(this.code);
            this.code = '';
            // Connexion de secours : on invite à enregistrer une passkey sur cet appareil
            await this.router.navigate(['/securite'], {queryParams: {recovered: remaining}});
        });
    }

    createPasskey() {
        return this.run(async () => {
            const codes = await this.auth.registerPasskey(this.deviceName.trim(), this.token ?? undefined);
            if (codes?.length) {
                this.codes.set(codes);
                this.mode.set('codes');
            } else {
                await this.enter();
            }
        });
    }

    async enter() {
        await this.router.navigateByUrl('/');
    }
}
