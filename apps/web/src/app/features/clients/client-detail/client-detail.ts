import {Component, computed, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideFilePlus, lucidePencil} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {Avatar} from '../../../shared/ui/avatar/avatar';
import {DetailFooter} from '../../../shared/ui/detail-footer/detail-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import type {Payment} from '../../payments/payment.models';
import type {Client} from '../client.models';
import {countryProfile, SIREN_FIELD} from '../countries';

export interface ClientDetailContext {
    client: Client;
    /** The client's payments, newest first */
    payments: Payment[];
}

export type ClientDetailAction = 'invoice' | 'edit' | 'delete';

const RECENT = 5;

/** Opens the client card; emits the action picked, or undefined when closed. */
export function openClientDetail(dialog: HlmDialogService, context: ClientDetailContext) {
    return dialog.open<ClientDetailAction | undefined, ClientDetailContext>(ClientDetail, drawerOptions(context))
        .closed$;
}

/** Read-only client card: totals, contact and invoicing details, latest payments. */
@Component({
    selector: 'app-client-detail',
    imports: [NgIcon, EurPipe, FrDatePipe, HlmButtonImports, HlmDialogImports, Avatar, DetailFooter],
    providers: [provideIcons({lucideFilePlus, lucidePencil})],
    host: {class: 'contents'},
    templateUrl: './client-detail.html',
})
export class ClientDetail {
    protected readonly ref = inject<BrnDialogRef<ClientDetailAction | undefined>>(BrnDialogRef);
    private readonly ctx = injectBrnDialogContext<ClientDetailContext>();

    protected readonly client = this.ctx.client;
    protected readonly payments = this.ctx.payments;
    protected readonly recent = this.payments.slice(0, RECENT);
    protected readonly total = this.payments.reduce((sum, p) => sum + p.amount, 0);
    protected readonly pending = this.payments.filter((p) => !p.paidOn).reduce((sum, p) => sum + p.amount, 0);

    /** Identifiers and mentions printed in the invoice's client block */
    protected readonly identifiers = computed(() => {
        const c = this.client;
        const profile = countryProfile(c.countryCode);
        return [
            {label: profile.vat.label, value: c.vatNumber},
            ...(profile.siren ? [{label: SIREN_FIELD.label, value: c.registration}] : []),
            ...c.extra,
        ].filter((row) => row.value.trim());
    });

    protected close(action?: ClientDetailAction) {
        this.ref.close(action);
    }
}
