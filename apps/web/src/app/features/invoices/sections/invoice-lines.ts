import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideBookmarkPlus, lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {formatMoney, parseEuros} from '../../../shared/utils/money';
import {openServiceDialog} from '../../services/service-dialog/service-dialog';
import type {ServiceInput} from '../../services/service.models';
import {InvoiceEditor} from '../invoice-editor';
import {lineTotal, type LineForm} from '../invoice-form';
import {InvoiceTotals} from './invoice-totals';

/** Invoice lines, catalog picker and totals. */
@Component({
    selector: 'app-invoice-lines',
    imports: [FormsModule, NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports, InvoiceTotals],
    providers: [provideIcons({lucideBookmarkPlus, lucidePlus, lucideTrash2})],
    host: {class: 'grid gap-3'},
    templateUrl: './invoice-lines.html',
})
export class InvoiceLines {
    protected readonly editor = inject(InvoiceEditor);
    private readonly dialog = inject(HlmDialogService);
    protected readonly form = this.editor.form;

    protected price(cents: number) {
        return formatMoney(cents, this.form.currency);
    }

    protected lineTotal(l: LineForm) {
        const total = lineTotal(l);
        return total === null ? '—' : this.price(total);
    }

    protected pickService(id: string, select: HTMLSelectElement) {
        select.value = '';
        this.editor.addServiceLine(id);
    }

    /** Saves a line to the catalog to reuse it on other invoices. */
    protected saveAsService(l: LineForm) {
        const initial: ServiceInput = {
            label: l.label.trim(),
            labelEn: l.labelEn.trim(),
            detail: l.detail.trim(),
            detailEn: l.detailEn.trim(),
            unit: l.unit.trim(),
            unitEn: l.unitEn.trim(),
            unitPrice: parseEuros(l.unitPrice) ?? 0,
            // Reserved to the invoice client by default
            clientId: this.form.clientId || null,
        };
        openServiceDialog(this.dialog, {initial, clients: this.editor.clients()}).subscribe((saved) => {
            if (saved) this.editor.addService(saved);
        });
    }
}
