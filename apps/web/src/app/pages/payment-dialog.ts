import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideLoader2, lucidePaperclip, lucideTrash2, lucideUpload } from '@ng-icons/lucide';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { Api, errorMessage } from '../core/api';
import { DateInput } from '../shared/date-input';
import { centsToInput, formatSize, parseEuros, todayIso } from '../core/format';
import { type Client, type FileLang, type InvoiceFile, LANG_LABELS, type Payment, type PaymentInput } from '../core/models';

export interface PaymentDialogContext {
  payment?: Payment;
  /** Carnet de clients */
  clients: Client[];
  /** Noms déjà utilisés dans les paiements (suggestions) */
  names: string[];
}

interface PendingFile {
  file: File;
  lang: FileLang;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'];

@Component({
  selector: 'app-payment-dialog',
  imports: [
    FormsModule,
    NgIcon,
    DateInput,
    HlmButtonImports,
    HlmDialogImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSwitchImports,
    HlmTextareaImports,
  ],
  providers: [provideIcons({ lucideUpload, lucideTrash2, lucideFileText, lucideLoader2, lucidePaperclip })],
  host: { class: 'contents' },
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle>{{ existing ? 'Modifier le paiement' : 'Encaissement manuel' }}</h3>
      <p hlmDialogDescription>
        @if (!existing) {
          Pour un paiement sans facture générée ici (facture externe, acompte, historique…).
        }
        Le montant encaissé en euros est celui qui compte pour le CA.
      </p>
    </hlm-dialog-header>
    @if (invoice) {
      <p class="bg-muted/50 rounded-lg px-3 py-2 text-xs">
        Facture {{ invoice.number }} générée par l'application : client, numéro et date se modifient via « Modifier la facture ».
      </p>
    }

    <form id="payment-form" class="-mx-1 grid content-start gap-4 overflow-y-auto overscroll-contain sm:max-h-[65vh] px-1 py-1" (ngSubmit)="save()">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2 sm:col-span-2">
          <label hlmLabel for="p-client">Client</label>
          <input hlmInput id="p-client" name="client" required list="p-clients" [disabled]="!!invoice" [(ngModel)]="form.client" />
          <datalist id="p-clients">
            @for (c of suggestions; track c) {
              <option [value]="c"></option>
            }
          </datalist>
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <label hlmLabel for="p-label">Objet</label>
          <input hlmInput id="p-label" name="label" placeholder="Développement, mission de mars…" [(ngModel)]="form.label" />
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="p-number">N° de facture</label>
          <input hlmInput id="p-number" name="invoiceNumber" [disabled]="!!invoice" [(ngModel)]="form.invoiceNumber" />
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="p-issued">Date de facture</label>
          <app-date-input inputId="p-issued" name="issuedOn" required [disabled]="!!invoice" [(ngModel)]="form.issuedOn" />
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="p-amount">Montant encaissé (€)</label>
          <input hlmInput id="p-amount" name="amount" inputmode="decimal" required placeholder="0,00" [(ngModel)]="form.amount" />
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="p-orig">Montant facturé (devise)</label>
          <div class="flex gap-2">
            <input hlmInput id="p-orig" name="originalAmount" inputmode="decimal" placeholder="optionnel" [(ngModel)]="form.originalAmount" />
            <select class="select-native w-24!" name="originalCurrency" aria-label="Devise" [(ngModel)]="form.originalCurrency">
              @for (c of currencies; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>
        </div>
        <div class="flex items-center gap-3 sm:col-span-2">
          <hlm-switch inputId="p-paid" [checked]="paid()" (checkedChange)="togglePaid($event)" />
          <label hlmLabel for="p-paid">Encaissé</label>
          @if (paid()) {
            <app-date-input name="paidOn" class="ml-auto w-44" aria-label="Date d'encaissement" required [(ngModel)]="form.paidOn" />
          }
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <label hlmLabel for="p-notes">Notes</label>
          <textarea hlmTextarea id="p-notes" name="notes" rows="2" [(ngModel)]="form.notes"></textarea>
        </div>
      </div>

      <!-- Factures -->
      <div class="grid gap-2">
        <span hlmLabel>Factures (PDF ou image, 10 Mo max)</span>
        <div class="grid gap-2 sm:grid-cols-2">
          @for (lang of slotLangs; track lang) {
            <div
              class="hover:border-ring flex min-h-16 flex-col justify-center gap-1 rounded-lg border border-dashed p-3 text-sm transition-colors"
              [class.border-ring]="dragOver() === lang"
              (dragover)="$event.preventDefault(); dragOver.set(lang)"
              (dragleave)="dragOver.set(null)"
              (drop)="onDrop($event, lang)"
            >
              <span class="text-muted-foreground text-xs font-medium">Facture {{ langLabel(lang) }}</span>
              @for (f of filesFor(lang); track f.id) {
                <div class="flex items-center gap-2">
                  <ng-icon name="lucideFileText" class="text-muted-foreground shrink-0" />
                  <a class="min-w-0 flex-1 truncate hover:underline" [href]="api.fileUrl(f.id)" target="_blank" rel="noopener">{{ f.name }}</a>
                  <button hlmBtn type="button" variant="ghost" size="icon-xs" (click)="removeFile(f)" aria-label="Supprimer le fichier">
                    <ng-icon name="lucideTrash2" />
                  </button>
                </div>
              }
              @for (p of pendingFor(lang); track p.file) {
                <div class="flex items-center gap-2">
                  <ng-icon name="lucidePaperclip" class="text-muted-foreground shrink-0" />
                  <span class="min-w-0 flex-1 truncate">{{ p.file.name }}</span>
                  <span class="text-muted-foreground text-xs">{{ size(p.file.size) }}</span>
                  <button hlmBtn type="button" variant="ghost" size="icon-xs" (click)="unqueue(p)" aria-label="Retirer le fichier">
                    <ng-icon name="lucideTrash2" />
                  </button>
                </div>
              }
              <label class="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs">
                <ng-icon name="lucideUpload" />
                Ajouter ou glisser un fichier
                <input type="file" class="sr-only" [accept]="accept" (change)="onPick($event, lang)" />
              </label>
            </div>
          }
        </div>
      </div>
    </form>

    <hlm-dialog-footer>
      <button hlmBtn variant="outline" type="button" (click)="ref.close(changed)">Annuler</button>
      <button hlmBtn type="submit" form="payment-form" [disabled]="saving()">
        @if (saving()) {
          <ng-icon name="lucideLoader2" class="animate-spin" />
        }
        Enregistrer
      </button>
    </hlm-dialog-footer>
  `,
})
export class PaymentDialog {
  protected readonly api = inject(Api);
  protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
  protected readonly ctx = injectBrnDialogContext<PaymentDialogContext>();

  protected readonly existing = this.ctx.payment;
  protected readonly invoice = this.existing?.invoice ?? null;
  /** Clients du carnet d'abord, puis les anciens noms saisis à la main */
  protected readonly suggestions = [...new Set([...this.ctx.clients.map((c) => c.name), ...this.ctx.names])];
  protected readonly currencies = CURRENCIES;
  protected readonly accept = ACCEPT;
  protected readonly slotLangs: FileLang[] = ['fr', 'en'];

  protected readonly form = {
    client: this.existing?.client ?? '',
    label: this.existing?.label ?? '',
    invoiceNumber: this.existing?.invoiceNumber ?? '',
    issuedOn: this.existing?.issuedOn ?? todayIso(),
    paidOn: this.existing?.paidOn ?? todayIso(),
    amount: centsToInput(this.existing?.amount),
    originalAmount: centsToInput(this.existing?.originalAmount),
    originalCurrency: this.existing?.originalCurrency ?? 'EUR',
    notes: this.existing?.notes ?? '',
  };
  protected readonly paid = signal(this.existing ? this.existing.paidOn !== null : true);
  protected readonly files = signal<InvoiceFile[]>(this.existing?.files ?? []);
  protected readonly pending = signal<PendingFile[]>([]);
  protected readonly saving = signal(false);
  protected readonly dragOver = signal<FileLang | null>(null);
  /** Un fichier a été supprimé : la liste doit être rechargée même en cas d'annulation */
  protected changed = false;

  togglePaid(v: boolean) {
    this.paid.set(v);
    if (v && !this.form.paidOn) this.form.paidOn = todayIso();
  }

  langLabel(l: FileLang) {
    return LANG_LABELS[l];
  }
  size(n: number) {
    return formatSize(n);
  }
  filesFor(lang: FileLang) {
    // Les fichiers « autre » sont affichés avec la facture FR pour rester visibles
    return this.files().filter((f) => f.lang === lang || (lang === 'fr' && f.lang === 'other'));
  }
  pendingFor(lang: FileLang) {
    return this.pending().filter((p) => p.lang === lang);
  }

  onPick(ev: Event, lang: FileLang) {
    const input = ev.target as HTMLInputElement;
    if (input.files?.[0]) this.queue(input.files[0], lang);
    input.value = '';
  }

  onDrop(ev: DragEvent, lang: FileLang) {
    ev.preventDefault();
    this.dragOver.set(null);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.queue(file, lang);
  }

  private queue(file: File, lang: FileLang) {
    if (file.size > MAX_SIZE) {
      toast.error('Fichier trop volumineux (10 Mo max)');
      return;
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Formats acceptés : PDF, PNG, JPEG, WebP');
      return;
    }
    this.pending.update((list) => [...list, { file, lang }]);
  }

  unqueue(p: PendingFile) {
    this.pending.update((list) => list.filter((x) => x !== p));
  }

  async removeFile(f: InvoiceFile) {
    if (!confirm(`Supprimer « ${f.name} » ?`)) return;
    try {
      await this.api.deleteFile(f.id);
      this.files.update((list) => list.filter((x) => x.id !== f.id));
      this.changed = true;
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async save() {
    const amount = parseEuros(this.form.amount);
    if (!this.form.client.trim()) return void toast.error('Le client est requis');
    if (amount === null) return void toast.error('Montant encaissé invalide');
    const originalAmount = parseEuros(this.form.originalAmount);
    if (this.form.originalAmount.trim() && originalAmount === null) return void toast.error('Montant facturé invalide');

    const name = this.form.client.trim();
    // Rattachement au carnet : client de la facture, sinon correspondance par nom
    const match = this.ctx.clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const body: PaymentInput = {
      clientId: this.invoice ? this.invoice.clientId : (match?.id ?? null),
      client: name,
      label: this.form.label.trim(),
      invoiceNumber: this.form.invoiceNumber.trim(),
      issuedOn: this.form.issuedOn,
      paidOn: this.paid() ? this.form.paidOn : null,
      amount,
      originalAmount,
      originalCurrency: this.form.originalCurrency,
      notes: this.form.notes,
    };

    this.saving.set(true);
    try {
      const saved = this.existing
        ? await this.api.updatePayment(this.existing.id, body)
        : await this.api.createPayment(body);
      this.changed = true;

      const failures: string[] = [];
      for (const p of this.pending()) {
        try {
          await this.api.uploadFile(saved.id, p.file, p.lang);
        } catch (err) {
          failures.push(`${p.file.name} : ${errorMessage(err)}`);
        }
      }
      if (failures.length) toast.error(`Paiement enregistré, mais échec d'envoi : ${failures.join(' ; ')}`);
      else toast.success(this.existing ? 'Paiement mis à jour' : 'Paiement ajouté');
      this.ref.close(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
