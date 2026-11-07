import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideBookmarkPlus,
    lucideEye,
    lucideLoader2,
    lucidePlus,
    lucideTrash2,
    lucideTriangleAlert,
    lucideUserPlus,
} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {Api, errorMessage} from '../core/api';
import {VAT_MENTIONS, vatRegime, withVatMention, type VatRegime} from '../core/countries';
import {centsToInput, formatMoney, parseEuros, todayIso} from '../core/format';
import type {
    Client,
    GenerateInvoice,
    InvoiceLine,
    InvoiceSettings,
    Payment,
    Service,
    ServiceInput,
} from '../core/models';
import {DateInput} from '../shared/date-input';
import {ClientDialog, CURRENCIES, type ClientDialogContext} from './client-dialog';
import {ServiceDialog, type ServiceDialogContext} from './service-dialog';

export interface InvoiceDialogContext {
    /** Paiement auquel rattacher la facture (sinon un nouveau paiement est créé) */
    payment?: Payment;
    /** Client présélectionné pour une nouvelle facture */
    clientId?: string;
    clients: Client[];
    /** Tous les paiements : sert à reprendre les lignes de la dernière facture du client */
    payments: Payment[];
}

interface LineForm {
    key: number;
    label: string;
    labelEn: string;
    detail: string;
    detailEn: string;
    unit: string;
    unitEn: string;
    quantity: string;
    unitPrice: string;
}

/** Champs de la fiche Entreprise indispensables sur une facture */
const REQUIRED_COMPANY = [
    ['name', 'nom'],
    ['address', 'adresse'],
    ['siret', 'SIRET'],
    ['iban', 'IBAN'],
] as const;

let nextKey = 1;

function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
}
function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
}
/** "2,5" → 2.5 (null si invalide) */
function parseQty(v: string): number | null {
    const s = v.replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
const qtyToInput = (n: number) => String(n).replace('.', ',');

function lineToForm(l: InvoiceLine): LineForm {
    return {
        key: nextKey++,
        label: l.label,
        labelEn: l.labelEn,
        detail: l.detail,
        detailEn: l.detailEn,
        unit: l.unit,
        unitEn: l.unitEn,
        quantity: qtyToInput(l.quantity),
        unitPrice: centsToInput(l.unitPrice),
    };
}
const emptyLine = (): LineForm => ({
    key: nextKey++,
    label: '',
    labelEn: '',
    detail: '',
    detailEn: '',
    unit: '',
    unitEn: '',
    quantity: '1',
    unitPrice: '',
});

@Component({
    selector: 'app-invoice-dialog',
    imports: [
        FormsModule,
        NgIcon,
        DateInput,
        HlmButtonImports,
        HlmDialogImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSkeletonImports,
        HlmSwitchImports,
        HlmTextareaImports,
    ],
    providers: [
        provideIcons({
            lucidePlus,
            lucideTrash2,
            lucideEye,
            lucideLoader2,
            lucideUserPlus,
            lucideTriangleAlert,
            lucideBookmarkPlus,
        }),
    ],
    host: {class: 'contents'},
    template: `
        <hlm-dialog-header>
            <h3 hlmDialogTitle>{{ stored ? 'Modifier la facture' : 'Nouvelle facture' }}</h3>
            <p hlmDialogDescription>
                Une seule saisie : la facture française est toujours générée, l'anglaise en option. Les PDF sont
                rattachés au paiement.
            </p>
        </hlm-dialog-header>

        @if (ready()) {
            <form
                id="invoice-form"
                class="-mx-1 grid content-start gap-6 overflow-y-auto overscroll-contain sm:max-h-[68vh] px-1 py-1"
                (ngSubmit)="save()"
            >
                @if (vatMismatch(); as regime) {
                    <div
                        class="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                    >
                        <ng-icon name="lucideTriangleAlert" class="shrink-0 text-amber-600" />
                        <span class="flex-1"
                            >La mention TVA ne correspond pas à ce client : attendu « {{ regimeLabel(regime) }} ».</span
                        >
                        <button hlmBtn type="button" variant="outline" size="sm" (click)="fixVat()">Corriger</button>
                    </div>
                }
                @if (missingCompany().length) {
                    <p class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0 text-amber-600" />
                        <span
                            >Fiche Entreprise incomplète ({{ missingCompany().join(', ') }}) : ces informations
                            n'apparaîtront pas sur la facture.</span
                        >
                    </p>
                }

                <!-- Client -->
                <section class="grid gap-2">
                    <label hlmLabel for="i-client">Client</label>
                    <div class="flex gap-2">
                        <select
                            class="select-native flex-1"
                            id="i-client"
                            name="clientId"
                            required
                            [ngModel]="form.clientId"
                            (ngModelChange)="selectClient($event)"
                        >
                            <option value="" disabled>Choisir un client…</option>
                            @for (c of clients(); track c.id) {
                                <option [value]="c.id">{{ c.name }}</option>
                            }
                        </select>
                        <button hlmBtn type="button" variant="outline" (click)="newClient()">
                            <ng-icon name="lucideUserPlus" /> Nouveau
                        </button>
                    </div>
                    @if (clientMissing()) {
                        <p class="text-muted-foreground text-xs">
                            Ce client a été supprimé du carnet : les coordonnées figées lors de l'émission seront
                            réutilisées.
                        </p>
                    }
                </section>

                <!-- En-tête de facture -->
                <section class="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div class="col-span-2 grid gap-2 sm:col-span-1">
                        <label hlmLabel for="i-number">N° de facture</label>
                        <input
                            hlmInput
                            id="i-number"
                            name="number"
                            required
                            [(ngModel)]="form.number"
                            (ngModelChange)="numberTouched = true"
                        />
                    </div>
                    <div class="grid gap-2">
                        <label hlmLabel for="i-issued">Date d'émission</label>
                        <app-date-input
                            inputId="i-issued"
                            name="issuedOn"
                            required
                            [ngModel]="form.issuedOn"
                            (ngModelChange)="setIssuedOn($event)"
                        />
                    </div>
                    <div class="grid gap-2">
                        <label hlmLabel for="i-due">Échéance</label>
                        <app-date-input
                            inputId="i-due"
                            name="dueOn"
                            required
                            [(ngModel)]="form.dueOn"
                            (ngModelChange)="dueTouched = true"
                        />
                    </div>
                    <div class="grid gap-2">
                        <label hlmLabel for="i-from">Prestation du</label>
                        <app-date-input inputId="i-from" name="periodFrom" [(ngModel)]="form.periodFrom" />
                    </div>
                    <div class="grid gap-2">
                        <label hlmLabel for="i-to">au</label>
                        <app-date-input inputId="i-to" name="periodTo" [(ngModel)]="form.periodTo" />
                    </div>
                    <div class="col-span-2 grid grid-cols-2 gap-4 sm:col-span-1 sm:gap-2">
                        <div class="grid gap-2">
                            <label hlmLabel for="i-currency">Devise</label>
                            <select class="select-native" id="i-currency" name="currency" [(ngModel)]="form.currency">
                                @for (c of currencies; track c) {
                                    <option [value]="c">{{ c }}</option>
                                }
                            </select>
                        </div>
                        <div class="grid gap-2">
                            <label hlmLabel for="i-vat">TVA %</label>
                            <input hlmInput id="i-vat" name="vatRate" inputmode="decimal" [(ngModel)]="form.vatRate" />
                        </div>
                    </div>
                </section>

                <!-- Version anglaise -->
                <div class="flex items-center gap-3">
                    <hlm-switch inputId="i-english" [checked]="form.english" (checkedChange)="form.english = $event" />
                    <label hlmLabel for="i-english">Générer aussi la version anglaise</label>
                </div>

                <!-- Lignes -->
                <section class="grid gap-3">
                    <span hlmLabel>Prestations</span>
                    @for (l of lines(); track l.key; let i = $index) {
                        <div class="grid gap-2 rounded-lg border p-3">
                            <div class="grid grid-cols-6 gap-2 sm:grid-cols-12">
                                <input
                                    hlmInput
                                    class="col-span-6 sm:col-span-5"
                                    [name]="'label-' + l.key"
                                    placeholder="Désignation"
                                    aria-label="Désignation"
                                    required
                                    [(ngModel)]="l.label"
                                />
                                <input
                                    hlmInput
                                    class="col-span-2 sm:col-span-1"
                                    [name]="'qty-' + l.key"
                                    inputmode="decimal"
                                    placeholder="Qté"
                                    aria-label="Quantité"
                                    [(ngModel)]="l.quantity"
                                />
                                <input
                                    hlmInput
                                    class="col-span-2 sm:col-span-2"
                                    [name]="'unit-' + l.key"
                                    placeholder="Unité (option.)"
                                    title="Optionnel : jour, semaine, forfait…"
                                    aria-label="Unité (optionnelle)"
                                    [(ngModel)]="l.unit"
                                />
                                <input
                                    hlmInput
                                    class="col-span-2 sm:col-span-2"
                                    [name]="'price-' + l.key"
                                    inputmode="decimal"
                                    placeholder="Prix u. HT"
                                    aria-label="Prix unitaire HT"
                                    [(ngModel)]="l.unitPrice"
                                />
                                <div
                                    class="col-span-5 flex items-center justify-end text-sm font-medium tabular-nums sm:col-span-1"
                                >
                                    {{ lineTotal(l) }}
                                </div>
                                <button
                                    hlmBtn
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    class="col-span-1 justify-self-end"
                                    [disabled]="lines().length === 1"
                                    (click)="removeLine(l)"
                                    aria-label="Supprimer la ligne"
                                >
                                    <ng-icon name="lucideTrash2" />
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <input
                                    hlmInput
                                    class="flex-1"
                                    [name]="'detail-' + l.key"
                                    placeholder="Détail (optionnel) : période, livrables…"
                                    aria-label="Détail"
                                    [(ngModel)]="l.detail"
                                />
                                <button
                                    hlmBtn
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Enregistrer comme prestation réutilisable"
                                    aria-label="Enregistrer comme prestation"
                                    (click)="saveAsService(l)"
                                >
                                    <ng-icon name="lucideBookmarkPlus" />
                                </button>
                            </div>
                            @if (form.english) {
                                <div class="bg-muted/40 -mx-3 -mb-3 grid gap-2 rounded-b-lg border-t px-3 py-3">
                                    <span class="text-muted-foreground text-xs font-medium"
                                        >Version anglaise (vide = identique au français)</span
                                    >
                                    <div class="grid grid-cols-6 gap-2 sm:grid-cols-12">
                                        <input
                                            hlmInput
                                            class="col-span-4 sm:col-span-9"
                                            [name]="'labelEn-' + l.key"
                                            [placeholder]="l.label || 'Description'"
                                            aria-label="Désignation (EN)"
                                            [(ngModel)]="l.labelEn"
                                        />
                                        <input
                                            hlmInput
                                            class="col-span-2 sm:col-span-3"
                                            [name]="'unitEn-' + l.key"
                                            [placeholder]="l.unit || 'Unit (optional)'"
                                            aria-label="Unité EN (optionnelle)"
                                            [(ngModel)]="l.unitEn"
                                        />
                                    </div>
                                    <input
                                        hlmInput
                                        [name]="'detailEn-' + l.key"
                                        [placeholder]="l.detail || 'Details (optional)'"
                                        aria-label="Détail (EN)"
                                        [(ngModel)]="l.detailEn"
                                    />
                                </div>
                            }
                        </div>
                    }
                    <div class="flex flex-wrap items-start justify-between gap-4">
                        <div class="flex flex-wrap gap-2">
                            <button hlmBtn type="button" variant="outline" size="sm" (click)="addLine()">
                                <ng-icon name="lucidePlus" /> Ajouter une ligne
                            </button>
                            @if (servicesFor().length) {
                                <select
                                    class="select-native h-8! w-auto! text-sm"
                                    name="pick-service"
                                    aria-label="Ajouter une prestation enregistrée"
                                    [ngModel]="''"
                                    (ngModelChange)="addService($event, picker)"
                                    #picker
                                >
                                    <option value="" disabled>+ Prestation enregistrée…</option>
                                    @for (sv of servicesFor(); track sv.id) {
                                        <option [value]="sv.id">{{ sv.label }} — {{ price(sv.unitPrice) }}</option>
                                    }
                                </select>
                            }
                        </div>
                        <dl class="grid min-w-52 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
                            <dt class="text-muted-foreground">Total HT</dt>
                            <dd class="text-right">{{ totals().ht }}</dd>
                            <dt class="text-muted-foreground">TVA</dt>
                            <dd class="text-right">{{ totals().vat }}</dd>
                            <dt class="font-semibold">Total TTC</dt>
                            <dd class="text-right font-semibold">{{ totals().ttc }}</dd>
                        </dl>
                    </div>
                </section>

                @if (form.currency !== 'EUR') {
                    <div class="grid gap-2 sm:max-w-xs">
                        <label hlmLabel for="i-eur">Montant en euros (pour le CA)</label>
                        <input
                            hlmInput
                            id="i-eur"
                            name="eurAmount"
                            inputmode="decimal"
                            placeholder="0,00"
                            [(ngModel)]="form.eurAmount"
                        />
                        <p class="text-muted-foreground text-xs">
                            Estimation à corriger dans le paiement une fois l'encaissement reçu.
                        </p>
                    </div>
                }

                <!-- Mentions -->
                <details class="group rounded-lg border">
                    <summary class="cursor-pointer px-3 py-2 text-sm font-medium select-none">
                        Conditions et mentions légales
                    </summary>
                    <div class="grid gap-3 border-t p-3">
                        <div class="grid gap-2">
                            <label hlmLabel for="i-terms-fr">Facture française</label>
                            <textarea
                                hlmTextarea
                                id="i-terms-fr"
                                name="termsFr"
                                rows="5"
                                [(ngModel)]="form.termsFr"
                            ></textarea>
                        </div>
                        @if (form.english) {
                            <div class="grid gap-2">
                                <label hlmLabel for="i-terms-en">Facture anglaise</label>
                                <textarea
                                    hlmTextarea
                                    id="i-terms-en"
                                    name="termsEn"
                                    rows="5"
                                    [(ngModel)]="form.termsEn"
                                ></textarea>
                            </div>
                        }
                        <div class="flex items-center gap-3">
                            <hlm-switch
                                inputId="i-defaults"
                                [checked]="saveDefaults()"
                                (checkedChange)="saveDefaults.set($event)"
                            />
                            <label hlmLabel for="i-defaults"
                                >Utiliser ces mentions et ce délai de paiement par défaut</label
                            >
                        </div>
                    </div>
                </details>
            </form>
        } @else {
            <hlm-skeleton class="block h-96 rounded-lg" />
        }

        <hlm-dialog-footer class="flex-wrap">
            <div class="flex gap-2 max-sm:*:flex-1 sm:mr-auto">
                <button
                    hlmBtn
                    type="button"
                    variant="ghost"
                    size="sm"
                    [disabled]="!ready() || busy()"
                    (click)="preview('fr')"
                >
                    <ng-icon name="lucideEye" /> Aperçu FR
                </button>
                @if (form.english) {
                    <button
                        hlmBtn
                        type="button"
                        variant="ghost"
                        size="sm"
                        [disabled]="!ready() || busy()"
                        (click)="preview('en')"
                    >
                        <ng-icon name="lucideEye" /> Aperçu EN
                    </button>
                }
            </div>
            <button hlmBtn variant="outline" type="button" (click)="ref.close(false)">Annuler</button>
            <button hlmBtn type="submit" form="invoice-form" [disabled]="!ready() || busy()">
                @if (busy()) {
                    <ng-icon name="lucideLoader2" class="animate-spin" />
                }
                {{ stored ? 'Régénérer' : 'Générer la facture' }}
            </button>
        </hlm-dialog-footer>
    `,
})
export class InvoiceDialog {
    private readonly api = inject(Api);
    private readonly dialog = inject(HlmDialogService);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<InvoiceDialogContext>();

    protected readonly payment = this.ctx.payment;
    protected readonly stored = this.payment?.invoice ?? null;
    protected readonly currencies = CURRENCIES;

    protected readonly ready = signal(false);
    protected readonly busy = signal(false);
    protected readonly clients = signal<Client[]>(this.ctx.clients);
    /** Catalogue de prestations */
    protected readonly services = signal<Service[]>([]);
    protected readonly lines = signal<LineForm[]>([emptyLine()]);
    protected readonly missingCompany = signal<string[]>([]);
    protected readonly saveDefaults = signal(false);

    protected readonly form = {
        clientId: '',
        number: '',
        issuedOn: todayIso(),
        dueOn: todayIso(),
        periodFrom: '',
        periodTo: '',
        currency: 'EUR',
        vatRate: '0',
        english: false,
        termsFr: '',
        termsEn: '',
        eurAmount: '',
    };
    protected numberTouched = false;
    protected dueTouched = false;
    private settings: InvoiceSettings = {paymentDays: 7, termsFr: '', termsEn: ''};

    constructor() {
        void this.init();
    }

    private async init() {
        try {
            const [settings, company, services] = await Promise.all([
                this.api.invoiceSettings(),
                this.api.company(),
                this.api.services(),
            ]);
            this.services.set(services);
            this.settings = settings;
            this.missingCompany.set(
                REQUIRED_COMPANY.filter(([id]) => !company.fields.find((f) => f.id === id)?.value.trim()).map(
                    ([, label]) => label,
                ),
            );

            const s = this.stored;
            const p = this.payment;
            if (s) {
                // Facture déjà générée : on recharge exactement sa saisie
                Object.assign(this.form, {
                    clientId: s.clientId,
                    number: s.number,
                    issuedOn: s.issuedOn,
                    dueOn: s.dueOn,
                    periodFrom: s.periodFrom ?? '',
                    periodTo: s.periodTo ?? '',
                    currency: s.currency,
                    vatRate: String(Math.round(s.vatRate * 10000) / 100).replace('.', ','),
                    english: s.english,
                    termsFr: s.termsFr,
                    termsEn: s.termsEn,
                    eurAmount: s.currency !== 'EUR' ? centsToInput(p!.amount) : '',
                });
                this.lines.set(s.lines.map(lineToForm));
                this.numberTouched = this.dueTouched = true;
            } else {
                this.form.termsFr = settings.termsFr;
                this.form.termsEn = settings.termsEn;
                if (p) {
                    // Paiement saisi à la main : on part de ses informations
                    const client = this.clients().find(
                        (c) => c.id === p.clientId || c.name.toLowerCase() === p.client.toLowerCase(),
                    );
                    if (client) this.applyClient(client, false);
                    this.form.issuedOn = p.issuedOn;
                    this.form.currency = p.originalAmount !== null ? p.originalCurrency : 'EUR';
                    if (this.form.currency !== 'EUR') this.form.eurAmount = centsToInput(p.amount);
                    this.lines.set([
                        {
                            ...emptyLine(),
                            label: p.label || 'Prestation',
                            unitPrice: centsToInput(p.originalAmount ?? p.amount),
                        },
                    ]);
                    if (p.invoiceNumber) {
                        this.form.number = p.invoiceNumber;
                        this.numberTouched = true;
                    }
                } else if (this.ctx.clientId) {
                    const client = this.clients().find((c) => c.id === this.ctx.clientId);
                    if (client) this.applyClient(client, true);
                }
                this.form.dueOn = addDays(this.form.issuedOn, settings.paymentDays);
                if (!this.numberTouched) await this.suggestNumber();
            }
            this.ready.set(true);
        } catch (err) {
            toast.error(errorMessage(err));
            this.ref.close(false);
        }
    }

    /** Client de la facture : fiche du carnet, ou copie figée d'une facture déjà émise */
    private currentClient() {
        return this.clients().find((c) => c.id === this.form.clientId) ?? (this.stored?.client as Client | undefined);
    }

    /** Régime attendu si les mentions ne contiennent pas la bonne mention TVA, sinon null */
    protected vatMismatch(): VatRegime | null {
        const client = this.currentClient();
        if (!client) return null;
        const regime = vatRegime(client);
        const m = VAT_MENTIONS[regime];
        const ok = this.form.termsFr.includes(m.fr) && (!this.form.english || this.form.termsEn.includes(m.en));
        return ok ? null : regime;
    }

    protected regimeLabel(r: VatRegime) {
        return {franchise: 'franchise, art. 293 B', reverse: 'autoliquidation UE', outside: 'hors UE, art. 259-1'}[r];
    }

    fixVat() {
        const client = this.currentClient();
        if (!client) return;
        const m = VAT_MENTIONS[vatRegime(client)];
        this.form.termsFr = withVatMention(this.form.termsFr, m.fr);
        this.form.termsEn = withVatMention(this.form.termsEn, m.en);
    }

    protected clientMissing() {
        return !!this.form.clientId && !this.clients().some((c) => c.id === this.form.clientId);
    }

    private async suggestNumber() {
        const {number} = await this.api.nextInvoiceNumber(Number(this.form.issuedOn.slice(0, 4)));
        this.form.number = number;
    }

    /** Préférences du client + lignes de sa dernière facture (pour les missions récurrentes). */
    private applyClient(client: Client, copyLines: boolean) {
        this.form.clientId = client.id;
        this.form.english = client.english;
        this.form.currency = client.currency;
        // Mention TVA propre au client (franchise, autoliquidation UE ou hors UE)
        const m = VAT_MENTIONS[vatRegime(client)];
        this.form.termsFr = withVatMention(this.form.termsFr, m.fr);
        this.form.termsEn = withVatMention(this.form.termsEn, m.en);
        if (!copyLines) return;
        const last = this.ctx.payments
            .filter((p) => p.invoice?.clientId === client.id)
            .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0]?.invoice;
        if (last) {
            this.lines.set(last.lines.map(lineToForm));
            this.form.vatRate = String(Math.round(last.vatRate * 10000) / 100).replace('.', ',');
        }
    }

    selectClient(id: string) {
        const client = this.clients().find((c) => c.id === id);
        if (!client) return;
        // On ne remplace les lignes que si rien n'a encore été saisi
        const pristine = !this.stored && this.lines().every((l) => !l.label.trim() && !l.unitPrice.trim());
        this.applyClient(client, pristine);
    }

    newClient() {
        const ref = this.dialog.open<Client | undefined, ClientDialogContext>(ClientDialog, {
            context: {},
            contentClass: 'sm:max-w-2xl',
            closeLabel: 'Fermer',
        });
        ref.closed$.subscribe((client) => {
            if (!client) return;
            this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
            this.selectClient(client.id);
        });
    }

    async setIssuedOn(iso: string) {
        const yearChanged = iso.slice(0, 4) !== this.form.issuedOn.slice(0, 4);
        this.form.issuedOn = iso;
        if (!iso) return;
        if (!this.dueTouched) this.form.dueOn = addDays(iso, this.settings.paymentDays);
        if (yearChanged && !this.numberTouched && !this.stored) {
            try {
                await this.suggestNumber();
            } catch {
                /* le numéro reste modifiable à la main */
            }
        }
    }

    /** Prestations proposées : celles du client de la facture d'abord, puis les prestations communes */
    protected servicesFor(): Service[] {
        const id = this.form.clientId;
        const own = this.services().filter((s) => id && s.clientId === id);
        return [...own, ...this.services().filter((s) => !s.clientId)];
    }

    protected price(cents: number) {
        return formatMoney(cents, this.form.currency);
    }

    /** Ajoute une prestation du catalogue (remplace la ligne vide de départ s'il n'y a qu'elle). */
    addService(id: string, select: HTMLSelectElement) {
        select.value = '';
        const sv = this.services().find((x) => x.id === id);
        if (!sv) return;
        const line: LineForm = {...lineToForm({...sv, quantity: 1})};
        const pristine = (l: LineForm) => !l.label.trim() && !l.unitPrice.trim() && !l.detail.trim();
        this.lines.update((list) => (list.length === 1 && pristine(list[0]) ? [line] : [...list, line]));
    }

    /** Enregistre une ligne dans le catalogue pour la réutiliser sur d'autres factures. */
    saveAsService(l: LineForm) {
        const initial: ServiceInput = {
            label: l.label.trim(),
            labelEn: l.labelEn.trim(),
            detail: l.detail.trim(),
            detailEn: l.detailEn.trim(),
            unit: l.unit.trim(),
            unitEn: l.unitEn.trim(),
            unitPrice: parseEuros(l.unitPrice) ?? 0,
            // Réservée par défaut au client de la facture
            clientId: this.form.clientId || null,
        };
        const ref = this.dialog.open<Service | undefined, ServiceDialogContext>(ServiceDialog, {
            context: {initial, clients: this.clients()},
            contentClass: 'sm:max-w-xl',
            closeLabel: 'Fermer',
        });
        ref.closed$.subscribe((saved) => {
            if (saved)
                this.services.update((list) => [...list, saved].sort((a, b) => a.label.localeCompare(b.label, 'fr')));
        });
    }

    addLine() {
        this.lines.update((list) => [...list, emptyLine()]);
    }
    removeLine(l: LineForm) {
        this.lines.update((list) => list.filter((x) => x !== l));
    }

    private vatRate(): number | null {
        const s = this.form.vatRate.replace(/[\s%]/g, '').replace(',', '.');
        const n = s === '' ? 0 : Number(s);
        return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 10000 : null;
    }

    protected lineTotal(l: LineForm): string {
        const q = parseQty(l.quantity);
        const p = parseEuros(l.unitPrice);
        return q !== null && p !== null ? formatMoney(Math.round(q * p), this.form.currency) : '—';
    }

    protected totals() {
        let ht = 0;
        for (const l of this.lines()) {
            const q = parseQty(l.quantity);
            const p = parseEuros(l.unitPrice);
            if (q !== null && p !== null) ht += Math.round(q * p);
        }
        const vat = Math.round(ht * (this.vatRate() ?? 0));
        const fmt = (c: number) => formatMoney(c, this.form.currency);
        return {ht: fmt(ht), vat: fmt(vat), ttc: fmt(ht + vat)};
    }

    /** Construit la requête ; affiche l'erreur et renvoie null si la saisie est incomplète. */
    private body(): GenerateInvoice | null {
        const f = this.form;
        const fail = (msg: string) => (toast.error(msg), null);
        if (!f.clientId) return fail('Choisis un client');
        if (!f.number.trim()) return fail('Numéro de facture requis');
        if (!f.issuedOn || !f.dueOn) return fail('Dates de facture et d’échéance requises');
        if (f.dueOn < f.issuedOn) return fail('L’échéance précède la date de facture');
        if (f.periodFrom && f.periodTo && f.periodFrom > f.periodTo) return fail('Période de prestation invalide');
        const vatRate = this.vatRate();
        if (vatRate === null) return fail('Taux de TVA invalide');

        const lines: InvoiceLine[] = [];
        for (const [i, l] of this.lines().entries()) {
            const quantity = parseQty(l.quantity);
            const unitPrice = parseEuros(l.unitPrice);
            if (!l.label.trim()) return fail(`Ligne ${i + 1} : désignation requise`);
            if (quantity === null) return fail(`Ligne ${i + 1} : quantité invalide`);
            if (unitPrice === null) return fail(`Ligne ${i + 1} : prix invalide`);
            lines.push({
                label: l.label.trim(),
                labelEn: l.labelEn.trim(),
                detail: l.detail.trim(),
                detailEn: l.detailEn.trim(),
                unit: l.unit.trim(),
                unitEn: l.unitEn.trim(),
                quantity,
                unitPrice,
            });
        }

        let eurAmount: number | null = null;
        if (f.currency !== 'EUR') {
            eurAmount = parseEuros(f.eurAmount);
            if (eurAmount === null) return fail('Indique le montant en euros (utilisé pour le CA)');
        }

        return {
            paymentId: this.payment?.id ?? null,
            eurAmount,
            invoice: {
                clientId: f.clientId,
                number: f.number.trim(),
                issuedOn: f.issuedOn,
                dueOn: f.dueOn,
                periodFrom: f.periodFrom || null,
                periodTo: f.periodTo || null,
                currency: f.currency,
                vatRate,
                lines,
                english: f.english,
                termsFr: f.termsFr,
                termsEn: f.termsEn,
            },
        };
    }

    async preview(lang: 'fr' | 'en') {
        const body = this.body();
        if (!body) return;
        // Ouverture immédiate de l'onglet (sinon bloqué comme pop-up après l'appel réseau)
        const win = window.open('', '_blank');
        this.busy.set(true);
        try {
            const blob = await this.api.previewInvoice(body, lang);
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
        const body = this.body();
        if (!body) return;
        if (this.stored && !confirm('Les PDF de cette facture seront remplacés par la nouvelle version. Continuer ?'))
            return;

        this.busy.set(true);
        try {
            await this.api.generateInvoice(body);
            if (this.saveDefaults()) {
                await this.api.saveInvoiceSettings({
                    paymentDays: Math.max(0, Math.min(120, daysBetween(body.invoice.issuedOn, body.invoice.dueOn))),
                    termsFr: body.invoice.termsFr,
                    termsEn: body.invoice.termsEn,
                });
            }
            toast.success(
                `Facture ${body.invoice.number} ${this.stored ? 'régénérée' : 'générée'}${body.invoice.english ? ' (FR + EN)' : ''}`,
            );
            this.ref.close(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }
}
