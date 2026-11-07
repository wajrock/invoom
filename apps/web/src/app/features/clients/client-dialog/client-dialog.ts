import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {errorMessage} from '../../../core/http/error-message';
import {CURRENCIES} from '../../../shared/utils/money';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {emptyClient, type Client, type ClientExtra, type ClientInput} from '../client.models';
import {ClientsApi} from '../clients.api';
import {
    COUNTRIES,
    countryProfile,
    fieldError,
    normalizeField,
    SIREN_FIELD,
    type CountryCode,
    type CountryField,
} from '../countries';

export interface ClientDialogContext {
    client?: Client;
}

/** Country-specific field: VAT number, SIREN, or a dedicated mention (Code SdI, PEC…) */
interface FieldSlot {
    key: string;
    def: CountryField;
}

const ORDER_NUMBER = 'N° de commande';

/** Opens the client form; emits the saved client, or undefined when cancelled. */
export function openClientDialog(dialog: HlmDialogService, context: ClientDialogContext) {
    return dialog.open<Client | undefined, ClientDialogContext>(ClientDialog, {
        context,
        contentClass: 'sm:max-w-2xl',
        closeLabel: 'Fermer',
    }).closed$;
}

@Component({
    selector: 'app-client-dialog',
    imports: [
        FormsModule,
        NgIcon,
        HlmButtonImports,
        HlmDialogImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSwitchImports,
        HlmTextareaImports,
        DialogFooter,
    ],
    providers: [provideIcons({lucidePlus, lucideTrash2})],
    host: {class: 'contents'},
    templateUrl: './client-dialog.html',
})
export class ClientDialog {
    private readonly api = inject(ClientsApi);
    protected readonly ref = inject<BrnDialogRef<Client | undefined>>(BrnDialogRef);
    private readonly ctx = injectBrnDialogContext<ClientDialogContext>();

    protected readonly existing = this.ctx.client;
    protected readonly countries = COUNTRIES;
    protected readonly currencies = CURRENCIES;
    protected readonly orderNumber = ORDER_NUMBER;
    protected readonly saving = signal(false);

    protected readonly form: ClientInput = {...emptyClient(), ...structuredClone(this.existing)};
    protected readonly code = signal<CountryCode>(this.form.countryCode);
    protected readonly profile = computed(() => countryProfile(this.code()));

    /** Values of the country-specific fields, keyed by 'vat', 'siren' or the mention label */
    protected readonly values: Record<string, string> = {
        vat: this.form.vatNumber,
        siren: this.form.registration,
    };
    /** Free mentions (not tied to a country field) */
    protected extras: ClientExtra[] = [];

    protected readonly slots = computed<FieldSlot[]>(() => {
        const p = this.profile();
        return [
            {key: 'vat', def: p.vat},
            ...(p.siren ? [{key: 'siren', def: SIREN_FIELD}] : []),
            ...p.fields.map((def) => ({key: def.label, def})),
        ];
    });

    constructor() {
        // Stored mentions matching a country field (e.g. "Code SdI") are shown in that field
        for (const e of this.form.extra) {
            const field = this.profile().fields.find((f) => f.label.toLowerCase() === e.label.toLowerCase());
            if (field) this.values[field.label] = e.value;
            else this.extras.push({...e});
        }
    }

    setCountry(code: CountryCode) {
        const p = countryProfile(code);
        this.code.set(code);
        this.form.countryCode = code;
        if (p.code !== 'OTHER') {
            this.form.country = p.nameFr;
            this.form.countryEn = p.nameEn;
        } else if (COUNTRIES.some((c) => c.nameFr === this.form.country)) {
            this.form.country = '';
            this.form.countryEn = '';
        }
        // The language preference follows the country only for a new client
        if (!this.existing) this.form.english = p.english;
    }

    protected error(s: FieldSlot): string {
        return fieldError(s.def, this.values[s.key] ?? '');
    }

    addExtra(label = '') {
        this.extras.push({label, value: ''});
    }
    hasExtra(label: string) {
        return this.extras.some((e) => e.label.trim().toLowerCase() === label.toLowerCase());
    }
    removeExtra(e: ClientExtra) {
        this.extras = this.extras.filter((x) => x !== e);
    }

    async save() {
        const p = this.profile();
        const name = this.form.name.trim();
        if (!name) return void toast.error('Le nom du client est requis');
        const invalid = this.slots().find((s) => this.error(s));
        if (invalid) return void toast.error(`${invalid.def.label} : ${this.error(invalid)}`);

        const val = (s: FieldSlot) => normalizeField(s.def, this.values[s.key] ?? '');
        const slots = this.slots();
        const countryFields = slots
            .filter((s) => s.key !== 'vat' && s.key !== 'siren')
            .map((s) => ({label: s.def.label, value: val(s)}))
            .filter((e) => e.value);
        const taken = new Set(countryFields.map((e) => e.label.toLowerCase()));

        const body: ClientInput = {
            ...this.form,
            name,
            countryCode: p.code,
            country: p.nameFr || this.form.country.trim(),
            countryEn: p.nameEn || this.form.country.trim(),
            vatNumber: val(slots[0]),
            registration: p.siren ? val(slots[1]) : '',
            extra: [
                ...countryFields,
                ...this.extras
                    .map((e) => ({label: e.label.trim(), value: e.value.trim()}))
                    .filter((e) => e.label && e.value && !taken.has(e.label.toLowerCase())),
            ],
        };
        delete (body as Partial<Client>).id;

        this.saving.set(true);
        try {
            const saved = this.existing ? await this.api.update(this.existing.id, body) : await this.api.create(body);
            toast.success(this.existing ? 'Client mis à jour' : 'Client ajouté');
            this.ref.close(saved);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
