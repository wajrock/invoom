import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {InvoiceEditor} from '../invoice-editor';

/** Payment terms and legal mentions (FR, and EN when enabled). */
@Component({
    selector: 'app-invoice-terms',
    imports: [FormsModule, HlmLabelImports, HlmSwitchImports, HlmTextareaImports],
    host: {class: 'contents'},
    templateUrl: './invoice-terms.html',
})
export class InvoiceTerms {
    protected readonly editor = inject(InvoiceEditor);
    protected readonly form = this.editor.form;
}
