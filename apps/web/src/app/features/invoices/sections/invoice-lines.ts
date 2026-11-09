import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideBookmark,
    lucideBookmarkPlus,
    lucideChevronDown,
    lucideHistory,
    lucidePlus,
    lucideTrash2,
} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {formatMoney, parseEuros} from '../../../shared/utils/money';
import {openServiceDialog} from '../../services/service-dialog/service-dialog';
import type {ServiceInput} from '../../services/service.models';
import {InvoiceEditor} from '../invoice-editor';
import {lineTotal, type LineForm} from '../invoice-form';

/** Invoice lines, catalog picker and totals (in this view so they refresh as lines are typed). */
@Component({
    selector: 'app-invoice-lines',
    imports: [FormsModule, NgIcon, HlmButtonImports, HlmDropdownMenuImports, HlmInputImports, HlmLabelImports],
    providers: [
        provideIcons({lucideBookmark, lucideBookmarkPlus, lucideChevronDown, lucideHistory, lucidePlus, lucideTrash2}),
    ],
    host: {class: 'grid gap-3 border-t pt-5'},
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

    /** Creates a catalog service (reserved to the invoice client) and adds it as a line. */
    protected createService() {
        const initial: ServiceInput = {
            label: '',
            labelEn: '',
            detail: '',
            detailEn: '',
            unit: '',
            unitEn: '',
            unitPrice: 0,
            clientId: this.form.clientId || null,
        };
        openServiceDialog(this.dialog, {initial, clients: this.editor.clients()}).subscribe((saved) => {
            if (!saved) return;
            this.editor.addService(saved);
            this.editor.addServiceLine(saved.id);
        });
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
