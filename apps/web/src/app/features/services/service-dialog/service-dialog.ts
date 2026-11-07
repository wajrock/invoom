import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {errorMessage} from '../../../core/http/error-message';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {centsToInput, parseEuros} from '../../../shared/utils/money';
import type {Client} from '../../clients/client.models';
import type {Service, ServiceInput} from '../service.models';
import {ServicesApi} from '../services.api';

export interface ServiceDialogContext {
    service?: Service;
    /** Prefill (an invoice line saved as a service) */
    initial?: ServiceInput;
    /** Address book, to reserve the service for one client */
    clients: Client[];
}

/** Opens the service form; emits the saved service, or undefined when cancelled. */
export function openServiceDialog(dialog: HlmDialogService, context: ServiceDialogContext) {
    return dialog.open<Service | undefined, ServiceDialogContext>(ServiceDialog, {
        context,
        contentClass: 'sm:max-w-xl',
        closeLabel: 'Fermer',
    }).closed$;
}

@Component({
    selector: 'app-service-dialog',
    imports: [FormsModule, HlmDialogImports, HlmInputImports, HlmLabelImports, DialogFooter],
    host: {class: 'contents'},
    templateUrl: './service-dialog.html',
})
export class ServiceDialog {
    private readonly api = inject(ServicesApi);
    protected readonly ref = inject<BrnDialogRef<Service | undefined>>(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<ServiceDialogContext>();

    protected readonly existing = this.ctx.service;
    protected readonly saving = signal(false);

    private readonly source = this.ctx.service ?? this.ctx.initial;
    protected readonly form = {
        clientId: this.source?.clientId ?? null,
        label: this.source?.label ?? '',
        labelEn: this.source?.labelEn ?? '',
        detail: this.source?.detail ?? '',
        detailEn: this.source?.detailEn ?? '',
        unit: this.source?.unit ?? '',
        unitEn: this.source?.unitEn ?? '',
        unitPrice: centsToInput(this.source?.unitPrice),
    };

    async save() {
        const label = this.form.label.trim();
        const unitPrice = parseEuros(this.form.unitPrice);
        if (!label) return void toast.error('La désignation est requise');
        if (unitPrice === null) return void toast.error('Prix unitaire invalide');

        const body: ServiceInput = {
            clientId: this.form.clientId,
            label,
            labelEn: this.form.labelEn.trim(),
            detail: this.form.detail.trim(),
            detailEn: this.form.detailEn.trim(),
            unit: this.form.unit.trim(),
            unitEn: this.form.unitEn.trim(),
            unitPrice,
        };
        this.saving.set(true);
        try {
            const saved = this.existing ? await this.api.update(this.existing.id, body) : await this.api.create(body);
            toast.success(this.existing ? 'Prestation mise à jour' : 'Prestation enregistrée');
            this.ref.close(saved);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
