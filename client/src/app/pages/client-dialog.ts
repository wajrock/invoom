import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { Api, errorMessage } from '../core/api';
import {
  COUNTRIES,
  countryProfile,
  fieldError,
  normalizeField,
  SIREN_FIELD,
  type CountryCode,
  type CountryField,
} from '../core/countries';
import type { Client, ClientExtra, ClientInput } from '../core/models';

export interface ClientDialogContext {
  client?: Client;
  /** Pré-remplissage du nom (import depuis un paiement) */
  name?: string;
}

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'];

export function emptyClient(countryCode: CountryCode = 'FR'): ClientInput {
  const p = countryProfile(countryCode);
  return {
    name: '',
    countryCode,
    address: '',
    country: p.nameFr,
    countryEn: p.nameEn,
    registration: '',
    vatNumber: '',
    email: '',
    extra: [],
    english: p.english,
    currency: 'EUR',
    notes: '',
  };
}

/** Champ propre au pays : n° de TVA, SIREN, ou mention dédiée (Code SdI, PEC…) */
interface FieldSlot {
  key: string;
  def: CountryField;
}

/** Fiche client ; se ferme avec le client enregistré (ou undefined si annulé). */
@Component({
  selector: 'app-client-dialog',
  imports: [FormsModule, NgIcon, HlmButtonImports, HlmDialogImports, HlmInputImports, HlmLabelImports, HlmSwitchImports, HlmTextareaImports],
  providers: [provideIcons({ lucidePlus, lucideTrash2, lucideLoader2 })],
  host: { class: 'contents' },
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle>{{ existing ? 'Modifier le client' : 'Nouveau client' }}</h3>
      <p hlmDialogDescription>Ces coordonnées sont reprises sur chaque facture émise pour ce client.</p>
    </hlm-dialog-header>

    <form id="client-form" class="-mx-1 grid content-start gap-4 overflow-y-auto overscroll-contain sm:max-h-[65vh] px-1 py-1" (ngSubmit)="save()">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2">
          <label hlmLabel for="c-country-code">Pays</label>
          <select class="select-native" id="c-country-code" name="countryCode" [ngModel]="code()" (ngModelChange)="setCountry($event)">
            @for (c of countries; track c.code) {
              <option [value]="c.code">{{ c.label }}</option>
            }
          </select>
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="c-currency">Devise par défaut</label>
          <select class="select-native" id="c-currency" name="currency" [(ngModel)]="form.currency">
            @for (c of currencies; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <label hlmLabel for="c-name">Raison sociale / nom</label>
          <input hlmInput id="c-name" name="name" required [(ngModel)]="form.name" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <label hlmLabel for="c-address">Adresse</label>
          <textarea hlmTextarea id="c-address" name="address" rows="3" placeholder="Rue&#10;Code postal Ville&#10;Pays (pour un client étranger)" [(ngModel)]="form.address"></textarea>
          <p class="text-muted-foreground text-xs">Imprimée telle quelle sur la facture : indique le pays pour un client étranger.</p>
        </div>
        @if (profile().code === 'OTHER') {
          <div class="grid gap-2 sm:col-span-2">
            <label hlmLabel for="c-country">Pays <span class="text-muted-foreground font-normal">(pour ta liste de clients)</span></label>
            <input hlmInput id="c-country" name="country" placeholder="Espagne" [(ngModel)]="form.country" />
          </div>
        }

        <!-- Champs propres au pays -->
        @for (s of slots(); track s.key) {
          <div class="grid content-start gap-2">
            <label hlmLabel [for]="'c-f-' + s.key">
              {{ s.def.label }}
              @if (s.def.expected && !values[s.key]?.trim()) {
                <span class="text-xs font-normal text-amber-600">recommandé</span>
              }
            </label>
            <input
              hlmInput
              [id]="'c-f-' + s.key"
              [name]="'f-' + s.key"
              [placeholder]="s.def.placeholder"
              [forceInvalid]="!!error(s)"
              [(ngModel)]="values[s.key]"
            />
            @if (error(s); as err) {
              <p class="text-destructive text-xs">{{ err }}</p>
            } @else if (s.def.hint) {
              <p class="text-muted-foreground text-xs">{{ s.def.hint }}</p>
            }
          </div>
        }

        <div class="grid content-start gap-2">
          <label hlmLabel for="c-email">E-mail de facturation</label>
          <input hlmInput id="c-email" name="email" type="email" [(ngModel)]="form.email" />
        </div>
      </div>

      <div class="grid gap-2">
        <span hlmLabel>Autres mentions sur la facture</span>
        <p class="text-muted-foreground -mt-1 text-xs">Demandées par le client (n° de commande, référence interne…), imprimées dans le bloc client.</p>
        @for (e of extras; track $index) {
          <div class="flex gap-2">
            <input hlmInput class="w-40" [name]="'extra-label-' + $index" placeholder="Libellé" aria-label="Libellé" [(ngModel)]="e.label" />
            <input hlmInput class="flex-1" [name]="'extra-value-' + $index" aria-label="Valeur" [(ngModel)]="e.value" />
            <button hlmBtn type="button" variant="ghost" size="icon" (click)="removeExtra(e)" aria-label="Supprimer la mention">
              <ng-icon name="lucideTrash2" />
            </button>
          </div>
        }
        <div class="flex flex-wrap gap-2">
          <button hlmBtn type="button" variant="outline" size="sm" (click)="addExtra()"><ng-icon name="lucidePlus" /> Ajouter une mention</button>
          @if (!hasExtra('N° de commande')) {
            <button hlmBtn type="button" variant="ghost" size="sm" (click)="addExtra('N° de commande')">+ N° de commande</button>
          }
        </div>
      </div>

      <div class="flex items-center gap-3">
        <hlm-switch inputId="c-english" [checked]="form.english" (checkedChange)="form.english = $event" />
        <label hlmLabel for="c-english">Générer aussi la facture en anglais par défaut</label>
      </div>

      <div class="grid gap-2">
        <label hlmLabel for="c-notes">Notes internes</label>
        <textarea hlmTextarea id="c-notes" name="notes" rows="2" [(ngModel)]="form.notes"></textarea>
      </div>
    </form>

    <hlm-dialog-footer>
      <button hlmBtn variant="outline" type="button" (click)="ref.close(undefined)">Annuler</button>
      <button hlmBtn type="submit" form="client-form" [disabled]="saving()">
        @if (saving()) {
          <ng-icon name="lucideLoader2" class="animate-spin" />
        }
        Enregistrer
      </button>
    </hlm-dialog-footer>
  `,
})
export class ClientDialog {
  private readonly api = inject(Api);
  protected readonly ref = inject<BrnDialogRef<Client | undefined>>(BrnDialogRef);
  protected readonly ctx = injectBrnDialogContext<ClientDialogContext>();

  protected readonly existing = this.ctx.client;
  protected readonly countries = COUNTRIES;
  protected readonly currencies = CURRENCIES;
  protected readonly saving = signal(false);

  protected readonly form: ClientInput = this.existing
    ? { ...emptyClient(), ...structuredClone(this.existing) }
    : { ...emptyClient(), name: this.ctx.name ?? '' };
  protected readonly code = signal<CountryCode>(this.form.countryCode);
  protected readonly profile = computed(() => countryProfile(this.code()));

  /** Valeurs des champs propres au pays, par clé ('vat', 'siren' ou libellé de mention) */
  protected readonly values: Record<string, string> = {
    vat: this.form.vatNumber,
    siren: this.form.registration,
  };
  /** Mentions libres (hors champs dédiés au pays) */
  protected extras: ClientExtra[] = [];

  protected readonly slots = computed<FieldSlot[]>(() => {
    const p = this.profile();
    return [
      { key: 'vat', def: p.vat },
      ...(p.siren ? [{ key: 'siren', def: SIREN_FIELD }] : []),
      ...p.fields.map((def) => ({ key: def.label, def })),
    ];
  });

  constructor() {
    // Les mentions déjà saisies qui correspondent à un champ du pays (ex. « Code SdI ») y sont rangées
    for (const e of this.form.extra) {
      const field = this.profile().fields.find((f) => f.label.toLowerCase() === e.label.toLowerCase());
      if (field) this.values[field.label] = e.value;
      else this.extras.push({ ...e });
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
    // La préférence de langue suit le pays tant que la fiche est nouvelle
    if (!this.existing) this.form.english = p.english;
  }

  protected error(s: FieldSlot): string {
    return fieldError(s.def, this.values[s.key] ?? '');
  }

  addExtra(label = '') {
    this.extras.push({ label, value: '' });
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
      .map((s) => ({ label: s.def.label, value: val(s) }))
      .filter((e) => e.value);
    const taken = new Set(countryFields.map((e) => e.label.toLowerCase()));

    const body: ClientInput = {
      ...this.form,
      name,
      countryCode: p.code,
      country: p.nameFr || this.form.country.trim(),
      countryEn: p.nameEn || this.form.country.trim(),
      vatNumber: val(slots[0]),
      // Le SIREN ne concerne que les clients français
      registration: p.siren ? val(slots[1]) : '',
      extra: [
        ...countryFields,
        ...this.extras
          .map((e) => ({ label: e.label.trim(), value: e.value.trim() }))
          .filter((e) => e.label && e.value && !taken.has(e.label.toLowerCase())),
      ],
    };
    delete (body as Partial<Client>).id;

    this.saving.set(true);
    try {
      const saved = this.existing ? await this.api.updateClient(this.existing.id, body) : await this.api.createClient(body);
      toast.success(this.existing ? 'Client mis à jour' : 'Client ajouté');
      this.ref.close(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
