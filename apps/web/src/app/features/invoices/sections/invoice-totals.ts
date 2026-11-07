import {Component, inject} from '@angular/core';
import {MoneyPipe} from '../../../shared/pipes/money.pipe';
import {InvoiceEditor} from '../invoice-editor';

@Component({
    selector: 'app-invoice-totals',
    imports: [MoneyPipe],
    template: `
        @let t = editor.totals();
        @let currency = editor.form.currency;
        <dl class="grid min-w-52 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
            <dt class="text-muted-foreground">Total HT</dt>
            <dd class="text-right">{{ t.ht | money: currency }}</dd>
            <dt class="text-muted-foreground">TVA</dt>
            <dd class="text-right">{{ t.vat | money: currency }}</dd>
            <dt class="font-semibold">Total TTC</dt>
            <dd class="text-right font-semibold">{{ t.ttc | money: currency }}</dd>
        </dl>
    `,
})
export class InvoiceTotals {
    protected readonly editor = inject(InvoiceEditor);
}
