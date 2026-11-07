import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {Spinner} from '../../../../shared/ui/spinner/spinner';
import {BackButton} from '../back-button';
import {LoginFlow} from '../login-flow';
import {StepError} from '../step-error';

@Component({
    selector: 'app-sign-up-step',
    imports: [FormsModule, HlmButtonImports, HlmInputImports, HlmLabelImports, Spinner, BackButton, StepError],
    host: {class: 'contents'},
    template: `
        <form class="grid gap-4" (ngSubmit)="flow.sendSignup()">
            <div class="grid gap-2">
                <label hlmLabel for="email">Adresse e-mail</label>
                <input
                    hlmInput
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    required
                    [ngModel]="flow.email()"
                    (ngModelChange)="flow.email.set($event)"
                    [disabled]="flow.loading()"
                />
            </div>
            <app-step-error />
            <button hlmBtn type="submit" class="w-full" [disabled]="flow.loading() || !flow.email().trim()">
                @if (flow.loading()) {
                    <app-spinner />
                }
                Recevoir le lien d'inscription
            </button>
            <p class="text-muted-foreground text-xs">
                Pas de mot de passe : tu te connecteras avec Face ID, Touch ID ou le verrouillage de ton appareil.
            </p>
        </form>
        <app-back-button label="J'ai déjà un compte" />
    `,
})
export class SignUpStep {
    protected readonly flow = inject(LoginFlow);
}
