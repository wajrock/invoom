import {Component, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucidePencil} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {Avatar} from '../../../shared/ui/avatar/avatar';
import {DetailFooter} from '../../../shared/ui/detail-footer/detail-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import type {Service} from '../service.models';

export interface ServiceDetailContext {
    service: Service;
    /** Name of the client the service is reserved for, null when shared */
    clientName: string | null;
}

export type ServiceDetailAction = 'edit' | 'delete';

/** Opens the service card; emits the action picked, or undefined when closed. */
export function openServiceDetail(dialog: HlmDialogService, context: ServiceDetailContext) {
    return dialog.open<ServiceDetailAction | undefined, ServiceDetailContext>(ServiceDetail, drawerOptions(context))
        .closed$;
}

/** Read-only service card: price, client, French and English texts. */
@Component({
    selector: 'app-service-detail',
    imports: [NgIcon, EurPipe, HlmButtonImports, HlmDialogImports, Avatar, DetailFooter],
    providers: [provideIcons({lucidePencil})],
    host: {class: 'contents'},
    templateUrl: './service-detail.html',
})
export class ServiceDetail {
    protected readonly ref = inject<BrnDialogRef<ServiceDetailAction | undefined>>(BrnDialogRef);
    private readonly ctx = injectBrnDialogContext<ServiceDetailContext>();

    protected readonly s = this.ctx.service;
    protected readonly clientName = this.ctx.clientName;

    protected readonly rows = [
        {label: 'Client', value: this.clientName ?? 'Tous les clients'},
        {label: 'Unité', value: this.s.unit},
        {label: 'Détail', value: this.s.detail},
    ].filter((row) => row.value);

    protected readonly englishRows = [
        {label: 'Description', value: this.s.labelEn},
        {label: 'Unit', value: this.s.unitEn},
        {label: 'Details', value: this.s.detailEn},
    ].filter((row) => row.value);

    protected close(action?: ServiceDetailAction) {
        this.ref.close(action);
    }
}
