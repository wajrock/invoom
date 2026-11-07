import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideMail} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {BackButton} from '../back-button';
import {LoginFlow} from '../login-flow';
import {StepError} from '../step-error';

/** Lost device: sign in with a recovery code, or ask for an access link by e-mail. */
@Component({
    selector: 'app-lost-access-step',
    imports: [FormsModule, NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports, BackButton, StepError],
    providers: [provideIcons({lucideMail})],
    host: {class: 'contents'},
    templateUrl: './lost-access-step.html',
})
export class LostAccessStep {
    protected readonly flow = inject(LoginFlow);
    protected readonly code = signal('');

    protected async useCode() {
        if (await this.flow.useCode(this.code())) this.code.set('');
    }
}
