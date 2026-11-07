import {Component, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideScanFace} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {Spinner} from '../../../../shared/ui/spinner/spinner';
import {LoginFlow} from '../login-flow';
import {StepError} from '../step-error';

@Component({
    selector: 'app-sign-in-step',
    imports: [NgIcon, HlmButtonImports, Spinner, StepError],
    providers: [provideIcons({lucideScanFace})],
    host: {class: 'contents'},
    template: `
        <button hlmBtn class="h-11 w-full text-[15px]" [disabled]="flow.loading()" (click)="flow.signin()">
            @if (flow.loading()) {
                <app-spinner />
            } @else {
                <ng-icon name="lucideScanFace" />
            }
            Se connecter avec une passkey
        </button>
        <app-step-error />
        <div class="grid gap-1 text-center text-sm">
            <button hlmBtn variant="link" class="h-auto p-0" (click)="flow.goTo('signup')">Créer un compte</button>
            <button hlmBtn variant="link" class="text-muted-foreground h-auto p-0" (click)="flow.goTo('lost')">
                Appareil perdu ou nouvel appareil ?
            </button>
        </div>
    `,
})
export class SignInStep {
    protected readonly flow = inject(LoginFlow);
}
