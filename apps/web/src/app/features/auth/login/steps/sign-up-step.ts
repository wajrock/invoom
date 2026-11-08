import {afterNextRender, Component, type ElementRef, inject, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {Spinner} from '../../../../shared/ui/spinner/spinner';
import {LoginFlow} from '../login-flow';
import {StepError} from '../step-error';

@Component({
    selector: 'app-sign-up-step',
    imports: [FormsModule, HlmButtonImports, HlmInputImports, HlmLabelImports, Spinner, StepError],
    host: {class: 'contents'},
    template: `
        <form class="grid gap-4" (ngSubmit)="flow.sendSignup()">
            <div class="grid gap-2">
                <label hlmLabel for="email">Adresse e-mail</label>
                <input
                    #email
                    hlmInput
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    placeholder="toi@exemple.fr"
                    class="h-11"
                    required
                    [ngModel]="flow.email()"
                    (ngModelChange)="flow.email.set($event)"
                    [disabled]="flow.loading()"
                />
            </div>
            <app-step-error />
            <button hlmBtn type="submit" class="h-11 w-full" [disabled]="flow.loading() || !flow.email().trim()">
                @if (flow.loading()) {
                    <app-spinner />
                }
                Recevoir le lien d'inscription
            </button>
            <p class="text-muted-foreground text-center text-xs">
                Tu recevras un lien valable 30 minutes pour confirmer ton adresse.
            </p>
        </form>
        <p class="text-muted-foreground text-center text-sm">
            Déjà un compte ?
            <button hlmBtn variant="link" class="text-foreground h-auto p-0" (click)="flow.goTo('signin')">
                Se connecter
            </button>
        </p>
    `,
})
export class SignUpStep {
    protected readonly flow = inject(LoginFlow);
    private readonly email = viewChild.required<ElementRef<HTMLInputElement>>('email');

    constructor() {
        // The user just chose to sign up: put the cursor where they need to type
        afterNextRender(() => this.email().nativeElement.focus());
    }
}
