import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideEye} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {errorMessage} from '../../../core/http/error-message';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {openDocumentViewer} from '../../../shared/ui/document-viewer/document-viewer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {WarningBanner} from '../../../shared/ui/warning-banner/warning-banner';
import {vatRegimeLabel} from '../../clients/countries';
import {invoiceNumberLabel} from '../../payments/payment.models';
import {InvoiceEditor, type InvoiceDialogContext} from '../invoice-editor';
import {buildRequest} from '../invoice-form';
import type {GenerateInvoice} from '../invoice.models';
import {InvoicesApi} from '../invoices.api';
import {InvoiceHeader} from '../sections/invoice-header';
import {InvoiceLines} from '../sections/invoice-lines';
import {InvoiceTerms} from '../sections/invoice-terms';
import {Confirm} from '../../../shared/ui/confirm/confirm';
import {guardUnsavedChanges} from '../../../shared/ui/confirm/unsaved-changes';

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
    private readonly confirm = inject(Confirm);
    private readonly dialog = inject(HlmDialogService);
    protected readonly editor = inject(InvoiceEditor);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    private readonly ctx = injectBrnDialogContext<InvoiceDialogContext>();

    protected readonly form = this.editor.form;
    protected readonly stored = this.ctx.payment?.invoice ?? null;
    protected readonly busy = signal(false);
    protected readonly regimeLabel = vatRegimeLabel;
    private readonly guard = guardUnsavedChanges<boolean>(() => ({
        form: this.form,
        lines: this.editor.lines(),
        saveDefaults: this.editor.saveDefaults(),
        customTerms: this.editor.customTerms(),
    }));

    constructor() {
        this.editor
            .init(this.ctx)
            // Filled in once the clients and settings are loaded: changes count from there
            .then(() => this.guard.markPristine())
            .catch((err: unknown) => {
                toast.error(errorMessage(err));
                this.guard.closeSaved(false);
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
        this.busy.set(true);
        try {
            const blob = await this.api.preview(body, lang);
            const number = invoiceNumberLabel(body.invoice.number);
            openDocumentViewer(this.dialog, {
                title: `${lang === 'en' ? 'Invoice' : 'Facture'} ${number}`,
                source: {blob},
                fileName: `${lang === 'en' ? 'Invoice' : 'Facture'}-${body.invoice.number.replace(/^#/, '')}.pdf`,
            });
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }

    async save() {
        const body = this.request();
        if (!body) return;
        if (
            this.stored &&
            !(await this.confirm.ask({
                title: 'Remplacer la facture ?',
                description: 'Les PDF de cette facture seront remplacés par la nouvelle version.',
                confirmLabel: 'Remplacer',
            }))
        )
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
            this.guard.closeSaved(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }
}
