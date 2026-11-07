import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideLoader2} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {Api, errorMessage} from '../core/api';
import {centsToInput, parseEuros} from '../core/format';
import type {Client, Service, ServiceInput} from '../core/models';

export interface ServiceDialogContext {
    /** Prestation à modifier */
    service?: Service;
    /** Pré-remplissage (ligne de facture enregistrée comme prestation) */
    initial?: ServiceInput;
    /** Carnet de clients, pour réserver la prestation à l'un d'eux */
    clients: Client[];
}

/** Fiche prestation ; se ferme avec la prestation enregistrée (ou undefined si annulé). */
@Component({
    selector: 'app-service-dialog',
    imports: [FormsModule, NgIcon, HlmButtonImports, HlmDialogImports, HlmInputImports, HlmLabelImports],
    providers: [provideIcons({lucideLoader2})],
    host: {class: 'contents'},
    template: `
        <hlm-dialog-header>
            <h3 hlmDialogTitle>{{ existing ? 'Modifier la prestation' : 'Nouvelle prestation' }}</h3>
            <p hlmDialogDescription>Ajoutée en un clic dans tes factures ; seule la quantité reste à saisir.</p>
        </hlm-dialog-header>

        <form
            id="service-form"
            class="-mx-1 grid content-start gap-4 overflow-y-auto overscroll-contain sm:max-h-[65vh] px-1 py-1"
            (ngSubmit)="save()"
        >
            <div class="grid gap-4 sm:grid-cols-6">
                <div class="grid gap-2 sm:col-span-6">
                    <label hlmLabel for="s-client">Client</label>
                    <select class="select-native" id="s-client" name="clientId" [(ngModel)]="form.clientId">
                        <option [ngValue]="null">Tous les clients</option>
                        @for (c of ctx.clients; track c.id) {
                            <option [ngValue]="c.id">{{ c.name }}</option>
                        }
                    </select>
                    <p class="text-muted-foreground text-xs">
                        Une prestation réservée n'est proposée que sur les factures de ce client.
                    </p>
                </div>
                <div class="grid gap-2 sm:col-span-6">
                    <label hlmLabel for="s-label">Désignation</label>
                    <input
                        hlmInput
                        id="s-label"
                        name="label"
                        required
                        placeholder="Développement logiciel"
                        [(ngModel)]="form.label"
                    />
                </div>
                <div class="grid gap-2 sm:col-span-3">
                    <label hlmLabel for="s-price">Prix unitaire HT</label>
                    <input
                        hlmInput
                        id="s-price"
                        name="unitPrice"
                        inputmode="decimal"
                        required
                        placeholder="0,00"
                        [(ngModel)]="form.unitPrice"
                    />
                </div>
                <div class="grid gap-2 sm:col-span-3">
                    <label hlmLabel for="s-unit"
                        >Unité <span class="text-muted-foreground font-normal">(optionnelle)</span></label
                    >
                    <input
                        hlmInput
                        id="s-unit"
                        name="unit"
                        placeholder="jour, semaine, forfait…"
                        [(ngModel)]="form.unit"
                    />
                </div>
                <div class="grid gap-2 sm:col-span-6">
                    <label hlmLabel for="s-detail"
                        >Détail <span class="text-muted-foreground font-normal">(optionnel)</span></label
                    >
                    <input
                        hlmInput
                        id="s-detail"
                        name="detail"
                        placeholder="Livrables, conditions…"
                        [(ngModel)]="form.detail"
                    />
                </div>
            </div>

            <div class="bg-muted/40 grid gap-3 rounded-lg border p-3">
                <span class="text-muted-foreground text-xs font-medium"
                    >Version anglaise (vide = identique au français)</span
                >
                <div class="grid gap-2 sm:grid-cols-6">
                    <input
                        hlmInput
                        class="sm:col-span-4"
                        name="labelEn"
                        aria-label="Désignation (EN)"
                        [placeholder]="form.label || 'Description'"
                        [(ngModel)]="form.labelEn"
                    />
                    <input
                        hlmInput
                        class="sm:col-span-2"
                        name="unitEn"
                        aria-label="Unité (EN)"
                        [placeholder]="form.unit || 'Unit'"
                        [(ngModel)]="form.unitEn"
                    />
                </div>
                <input
                    hlmInput
                    name="detailEn"
                    aria-label="Détail (EN)"
                    [placeholder]="form.detail || 'Details'"
                    [(ngModel)]="form.detailEn"
                />
            </div>
        </form>

        <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="ref.close(undefined)">Annuler</button>
            <button hlmBtn type="submit" form="service-form" [disabled]="saving()">
                @if (saving()) {
                    <ng-icon name="lucideLoader2" class="animate-spin" />
                }
                Enregistrer
            </button>
        </hlm-dialog-footer>
    `,
})
export class ServiceDialog {
    private readonly api = inject(Api);
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
            const saved = this.existing
                ? await this.api.updateService(this.existing.id, body)
                : await this.api.createService(body);
            toast.success(this.existing ? 'Prestation mise à jour' : 'Prestation enregistrée');
            this.ref.close(saved);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
