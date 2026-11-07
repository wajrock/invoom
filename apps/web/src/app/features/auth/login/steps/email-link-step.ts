import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideScanFace} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {Spinner} from '../../../../shared/ui/spinner/spinner';
import {LoginFlow} from '../login-flow';
import {StepError} from '../step-error';

/** E-mailed link opened: create this device's passkey. */
@Component({
    selector: 'app-email-link-step',
    imports: [FormsModule, NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports, Spinner, StepError],
    providers: [provideIcons({lucideScanFace})],
    host: {class: 'contents'},
    templateUrl: './email-link-step.html',
})
export class EmailLinkStep {
    protected readonly flow = inject(LoginFlow);
}
