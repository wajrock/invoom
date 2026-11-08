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
        <div class="grid gap-3">
            <button hlmBtn class="h-11 w-full text-[15px]" [disabled]="flow.loading()" (click)="flow.signin()">
                @if (flow.loading()) {
                    <app-spinner />
                } @else {
                    <ng-icon name="lucideScanFace" />
                }
                Se connecter avec une passkey
            </button>
            <button hlmBtn variant="outline" class="h-11 w-full" (click)="flow.goTo('signup')">Créer un compte</button>
        </div>
        <app-step-error />
        <button
            hlmBtn
            variant="link"
            class="text-muted-foreground h-auto justify-self-center p-0 text-xs"
            (click)="flow.goTo('lost')"
        >
            Appareil perdu ou nouvel appareil ?
        </button>
    `,
})
export class SignInStep {
    protected readonly flow = inject(LoginFlow);
}
