import {Component, inject, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideArrowLeft} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {LoginFlow, type LoginStep} from './login-flow';

@Component({
    selector: 'app-back-button',
    imports: [NgIcon, HlmButtonImports],
    providers: [provideIcons({lucideArrowLeft})],
    host: {class: 'contents'},
    template: `
        <button hlmBtn variant="ghost" size="sm" class="justify-self-start" (click)="flow.goTo(to())">
            <ng-icon name="lucideArrowLeft" /> {{ label() }}
        </button>
    `,
})
export class BackButton {
    protected readonly flow = inject(LoginFlow);
    readonly label = input.required<string>();
    readonly to = input<LoginStep>('signin');
}
