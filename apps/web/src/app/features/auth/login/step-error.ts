import {Component, inject} from '@angular/core';
import {LoginFlow} from './login-flow';

@Component({
    selector: 'app-step-error',
    template: `
        @if (flow.error()) {
            <p class="text-destructive text-sm" role="alert">{{ flow.error() }}</p>
        }
    `,
    host: {class: 'contents'},
})
export class StepError {
    protected readonly flow = inject(LoginFlow);
}
