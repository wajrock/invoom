import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideEye} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {errorMessage} from '../../../core/http/error-message';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {WarningBanner} from '../../../shared/ui/warning-banner/warning-banner';
import {VAT_REGIME_LABELS} from '../../clients/countries';
import {InvoiceEditor, type InvoiceDialogContext} from '../invoice-editor';
import {buildRequest} from '../invoice-form';
import type {GenerateInvoice} from '../invoice.models';
import {InvoicesApi} from '../invoices.api';
import {InvoiceHeader} from '../sections/invoice-header';
import {InvoiceLines} from '../sections/invoice-lines';
import {InvoiceTerms} from '../sections/invoice-terms';

/** Opens the invoice generator in a wide right drawer; emits true when an invoice was generated. */
export function openInvoiceDialog(dialog: HlmDialogService, context: InvoiceDialogContext) {
    return dialog.open<boolean, InvoiceDialogContext>(InvoiceDialog, drawerOptions(context, 'wide')).closed$;
}

@Component({
    selector: 'app-invoice-dialog',
    imports: [
        FormsModule,
        NgIcon,
        HlmButtonImports,
        HlmDialogImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSkeletonImports,
        DialogFooter,
        InvoiceHeader,
        InvoiceLines,
        InvoiceTerms,
        WarningBanner,
    ],
    providers: [InvoiceEditor, provideIcons({lucideEye})],
    host: {class: 'contents'},
    templateUrl: './invoice-dialog.html',
})
export class InvoiceDialog {
    private readonly api = inject(InvoicesApi);
    protected readonly editor = inject(InvoiceEditor);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    private readonly ctx = injectBrnDialogContext<InvoiceDialogContext>();

    protected readonly form = this.editor.form;
    protected readonly stored = this.ctx.payment?.invoice ?? null;
    protected readonly busy = signal(false);
    protected readonly regimeLabels = VAT_REGIME_LABELS;

    constructor() {
        this.editor.init(this.ctx).catch((err: unknown) => {
            toast.error(errorMessage(err));
            this.ref.close(false);
        });
    }

    /** Shows the first validation error, if any */
    private request(): GenerateInvoice | null {
        const res = buildRequest(this.form, this.editor.lines(), this.ctx.payment?.id ?? null);
        if (typeof res === 'string') {
            toast.error(res);
            return null;
        }
        return res;
    }

    async preview(lang: 'fr' | 'en') {
        const body = this.request();
        if (!body) return;
        // Open the tab synchronously: after the network call it would be blocked as a pop-up
        const win = window.open('', '_blank');
        this.busy.set(true);
        try {
            const blob = await this.api.preview(body, lang);
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url;
            else window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            win?.close();
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }

    async save() {
        const body = this.request();
        if (!body) return;
        if (this.stored && !confirm('Les PDF de cette facture seront remplacés par la nouvelle version. Continuer ?'))
            return;

        const {invoice} = body;
        this.busy.set(true);
        try {
            await this.api.generate(body);
            if (this.editor.saveDefaults()) {
                await this.api.saveSettings(this.editor.defaultsToSave());
            }
            toast.success(
                `Facture ${invoice.number} ${this.stored ? 'régénérée' : 'générée'}${invoice.english ? ' (FR + EN)' : ''}`,
            );
            this.ref.close(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }
}
