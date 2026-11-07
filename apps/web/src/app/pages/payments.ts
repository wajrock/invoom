import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideClock,
  lucideEllipsis,
  lucideFilePlus,
  lucideFileText,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Api, errorMessage } from '../core/api';
import { EurPipe, formatMoney, FrDatePipe, todayIso } from '../core/format';
import { LANG_LABELS, type Client, type FileLang, type Payment } from '../core/models';
import { InvoiceDialog, type InvoiceDialogContext } from './invoice-dialog';
import { PaymentDialog, type PaymentDialogContext } from './payment-dialog';

type StatusFilter = 'all' | 'paid' | 'pending';

@Component({
  selector: 'app-payments',
  imports: [
    FormsModule,
    NgIcon,
    EurPipe,
    FrDatePipe,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDropdownMenuImports,
    HlmInputImports,
    HlmSkeletonImports,
    HlmTableImports,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideSearch,
      lucidePencil,
      lucideTrash2,
      lucideFileText,
      lucideFilePlus,
      lucideEllipsis,
      lucideCircleCheck,
      lucideClock,
    }),
  ],
  template: `
    <div class="page-head">
      <div>
        <h1>Paiements</h1>
        <p class="text-muted-foreground text-sm">Factures émises et encaissements</p>
      </div>
      <div class="flex gap-2">
        <button hlmBtn variant="outline" class="max-md:size-9 max-md:p-0" title="Paiement sans facture générée ici : facture externe, acompte, historique…" aria-label="Encaissement manuel" (click)="open()">
          <ng-icon name="lucidePlus" /><span class="max-md:sr-only">Encaissement manuel</span>
        </button>
        <button hlmBtn class="fab" aria-label="Nouvelle facture" (click)="openInvoice()"><ng-icon name="lucideFilePlus" /><span class="fab-label">Nouvelle facture</span></button>
      </div>
    </div>

    <!-- Filtres -->
    <div class="mb-4 flex flex-wrap items-center gap-2 max-sm:[&>select]:flex-1">
      <div class="relative min-w-48 flex-1 max-sm:basis-full">
        <ng-icon name="lucideSearch" class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
        <input hlmInput class="pl-8" placeholder="Rechercher un client, un objet, un n°…" aria-label="Rechercher" [ngModel]="query()" (ngModelChange)="query.set($event)" />
      </div>
      <select class="select-native w-auto!" aria-label="Année" [ngModel]="year()" (ngModelChange)="year.set($event)">
        <option value="all">Toutes les années</option>
        @for (y of years(); track y) {
          <option [value]="'' + y">{{ y }}</option>
        }
      </select>
      <select class="select-native w-auto!" aria-label="Statut" [ngModel]="status()" (ngModelChange)="status.set($event)">
        <option value="all">Tous</option>
        <option value="paid">Encaissés</option>
        <option value="pending">En attente</option>
      </select>
    </div>

    @if (payments(); as list) {
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div class="bg-card rounded-xl border p-3 sm:p-4">
          <p class="text-muted-foreground text-xs">Encaissé</p>
          <p class="text-lg font-semibold tabular-nums">{{ totals().paid | eur }}</p>
        </div>
        <div class="bg-card rounded-xl border p-3 sm:p-4">
          <p class="text-muted-foreground text-xs">En attente</p>
          <p class="text-lg font-semibold tabular-nums">{{ totals().pending | eur }}</p>
        </div>
        <div class="hidden rounded-xl border p-4 sm:block">
          <p class="text-muted-foreground text-xs">Factures</p>
          <p class="text-lg font-semibold tabular-nums">{{ filtered().length }}</p>
        </div>
      </div>

      @if (list.length === 0) {
        <section hlmCard class="items-center py-12 text-center">
          <p class="text-muted-foreground text-sm">Aucun paiement enregistré.</p>
          <div class="flex flex-wrap justify-center gap-2">
            <button hlmBtn (click)="openInvoice()"><ng-icon name="lucideFilePlus" /> Créer une facture</button>
            <button hlmBtn variant="outline" title="Paiement sans facture générée ici : facture externe, acompte, historique…" (click)="open()"><ng-icon name="lucidePlus" /> Encaissement manuel</button>
          </div>
        </section>
      } @else if (filtered().length === 0) {
        <p class="text-muted-foreground py-10 text-center text-sm">Aucun résultat pour ces filtres.</p>
      } @else {
        <!-- Mobile : liste groupée par mois, actions dans une feuille -->
        <div class="grid gap-5 sm:hidden">
          @for (g of groups(); track g.key) {
            <section>
              <h2 class="text-muted-foreground mb-1.5 px-1 text-xs font-medium tracking-wide uppercase">{{ g.label }}</h2>
              <ul class="bg-card divide-y overflow-hidden rounded-xl border">
                @for (p of g.items; track p.id) {
                  <li>
                    <button type="button" class="tap-row flex w-full items-center gap-3 px-3.5 py-3 text-left" (click)="sheet.set(p)">
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-full"
                        [class]="p.paidOn ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'"
                      >
                        <ng-icon [name]="p.paidOn ? 'lucideCircleCheck' : 'lucideClock'" class="text-base" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[15px] font-medium">{{ p.client }}</span>
                        <span class="text-muted-foreground block truncate text-xs">
                          {{ p.invoiceNumber ? 'N° ' + p.invoiceNumber : p.label || 'Sans facture' }} · {{ p.issuedOn | frDate: 'short' }}
                        </span>
                      </span>
                      <span class="shrink-0 text-right">
                        <span class="block text-[15px] font-semibold tabular-nums">{{ p.amount | eur }}</span>
                        <span class="block text-xs" [class]="p.paidOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">
                          {{ p.paidOn ? 'Payée le ' + (p.paidOn | frDate: 'short') : 'En attente' }}
                        </span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        </div>

        <!-- Feuille d'actions (mobile) -->
        @if (sheet(); as p) {
          <div class="animate-in fade-in-0 fixed inset-0 z-50 bg-black/40 duration-200 sm:hidden" (click)="sheet.set(null)"></div>
          <div
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="'Paiement ' + p.client"
            class="bg-background animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] duration-300 ease-out sm:hidden"
          >
            <div class="bg-muted-foreground/30 mx-auto mb-4 h-1 w-10 rounded-full"></div>
            <div class="mb-4 flex items-start justify-between gap-3 px-1">
              <div class="min-w-0">
                <p class="truncate text-lg font-semibold">{{ p.client }}</p>
                <p class="text-muted-foreground truncate text-sm">
                  {{ p.invoiceNumber ? 'Facture ' + p.invoiceNumber : 'Sans facture' }} · {{ p.issuedOn | frDate: 'short' }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-lg font-semibold tabular-nums">{{ p.amount | eur }}</p>
                @if (p.originalAmount !== null && p.originalCurrency !== 'EUR') {
                  <p class="text-muted-foreground text-xs tabular-nums">{{ money(p.originalAmount, p.originalCurrency) }}</p>
                }
              </div>
            </div>

            @if (p.files.length) {
              <div class="mb-3 grid gap-2" [class.grid-cols-2]="p.files.length > 1">
                @for (f of p.files; track f.id) {
                  <a hlmBtn variant="outline" class="h-11" [href]="api.fileUrl(f.id)" target="_blank" rel="noopener">
                    <ng-icon name="lucideFileText" /> PDF {{ lang(f.lang) }}
                  </a>
                }
              </div>
            }

            <ul class="bg-card divide-y overflow-hidden rounded-xl border">
              @if (!p.paidOn) {
                <li>
                  <button type="button" class="tap-row flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium" (click)="sheetAction(p, 'paid')">
                    <ng-icon name="lucideCircleCheck" class="text-emerald-600 dark:text-emerald-400" /> Encaissé aujourd'hui
                  </button>
                </li>
              }
              <li>
                <button type="button" class="tap-row flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium" (click)="sheetAction(p, 'invoice')">
                  <ng-icon name="lucideFilePlus" /> {{ p.invoice ? 'Modifier la facture' : 'Générer la facture' }}
                </button>
              </li>
              <li>
                <button type="button" class="tap-row flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium" (click)="sheetAction(p, 'edit')">
                  <ng-icon name="lucidePencil" /> Modifier le paiement
                </button>
              </li>
              <li>
                <button type="button" class="tap-row text-destructive flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium" (click)="sheetAction(p, 'delete')">
                  <ng-icon name="lucideTrash2" /> Supprimer
                </button>
              </li>
            </ul>
            <button hlmBtn variant="secondary" class="mt-3 h-11 w-full text-[15px]" (click)="sheet.set(null)">Fermer</button>
          </div>
        }

        <div hlmTableContainer class="hidden overflow-hidden rounded-xl border sm:block">
          <table
            hlmTable
            class="[&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_tr>*:first-child]:pl-5 [&_tr>*:last-child]:pr-4"
          >
            <thead hlmTHead class="bg-muted/40">
              <tr hlmTr>
                <th hlmTh>Date</th>
                <th hlmTh>Client</th>
                <th hlmTh class="hidden md:table-cell">N°</th>
                <th hlmTh class="text-right">Montant</th>
                <th hlmTh>Statut</th>
                <th hlmTh class="hidden lg:table-cell">Encaissement</th>
                <th hlmTh>Factures</th>
                <th hlmTh class="w-10"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (p of filtered(); track p.id) {
                <tr hlmTr class="cursor-pointer" (click)="open(p)">
                  <td hlmTd class="whitespace-nowrap">{{ p.issuedOn | frDate: 'short' }}</td>
                  <td hlmTd class="max-w-64">
                    <p class="truncate font-medium">{{ p.client }}</p>
                    @if (p.label) {
                      <p class="text-muted-foreground truncate text-xs">{{ p.label }}</p>
                    }
                  </td>
                  <td hlmTd class="text-muted-foreground hidden md:table-cell">{{ p.invoiceNumber || '—' }}</td>
                  <td hlmTd class="text-right whitespace-nowrap tabular-nums">
                    <span class="font-medium">{{ p.amount | eur }}</span>
                    @if (p.originalAmount !== null && p.originalCurrency !== 'EUR') {
                      <p class="text-muted-foreground text-xs">{{ money(p.originalAmount, p.originalCurrency) }}</p>
                    }
                  </td>
                  <td hlmTd>
                    @if (p.paidOn) {
                      <span hlmBadge class="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><ng-icon name="lucideCircleCheck" /> Payée</span>
                    } @else {
                      <span hlmBadge class="bg-amber-500/15 text-amber-700 dark:text-amber-400"><ng-icon name="lucideClock" /> En attente</span>
                    }
                  </td>
                  <td hlmTd class="text-muted-foreground hidden whitespace-nowrap lg:table-cell">
                    {{ p.paidOn ? (p.paidOn | frDate: 'short') : '—' }}
                  </td>
                  <td hlmTd>
                    <div class="flex gap-1">
                      @for (f of p.files; track f.id) {
                        <a
                          hlmBadge
                          variant="outline"
                          [href]="api.fileUrl(f.id)"
                          target="_blank"
                          rel="noopener"
                          [title]="f.name"
                          (click)="$event.stopPropagation()"
                        >
                          <ng-icon name="lucideFileText" /> {{ lang(f.lang) }}
                        </a>
                      } @empty {
                        <span class="text-muted-foreground text-xs">—</span>
                      }
                    </div>
                  </td>
                  <td hlmTd (click)="$event.stopPropagation()">
                    <button hlmBtn variant="ghost" size="icon-sm" [hlmDropdownMenuTrigger]="menu" [hlmDropdownMenuTriggerData]="{ $implicit: p }" aria-label="Actions">
                      <ng-icon name="lucideEllipsis" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else if (error()) {
      <p class="text-destructive text-sm">{{ error() }}</p>
    } @else {
      <hlm-skeleton class="block h-64 rounded-xl" />
    }

    <ng-template #menu let-p>
      <hlm-dropdown-menu class="w-48">
        @if (!p.paidOn) {
          <button hlmDropdownMenuItem (click)="markPaid(p)"><ng-icon name="lucideCircleCheck" /> Encaissé aujourd'hui</button>
        }
        <button hlmDropdownMenuItem (click)="openInvoice(p)">
          <ng-icon name="lucideFilePlus" /> {{ p.invoice ? 'Modifier la facture' : 'Générer la facture' }}
        </button>
        <button hlmDropdownMenuItem (click)="open(p)"><ng-icon name="lucidePencil" /> Modifier le paiement</button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem variant="destructive" (click)="remove(p)"><ng-icon name="lucideTrash2" /> Supprimer</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class PaymentsPage {
  protected readonly api = inject(Api);
  private readonly dialog = inject(HlmDialogService);

  protected readonly payments = signal<Payment[] | null>(null);
  protected readonly clientList = signal<Client[]>([]);
  protected readonly error = signal('');
  protected readonly query = signal('');
  protected readonly year = signal<string>(String(new Date().getFullYear()));
  protected readonly status = signal<StatusFilter>('all');

  protected readonly years = computed(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    for (const p of this.payments() ?? []) ys.add(Number((p.paidOn ?? p.issuedOn).slice(0, 4)));
    return [...ys].sort((a, b) => b - a);
  });

  protected readonly clients = computed(() =>
    [...new Set((this.payments() ?? []).map((p) => p.client))].sort((a, b) => a.localeCompare(b, 'fr')),
  );

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const y = this.year();
    const st = this.status();
    return (this.payments() ?? []).filter((p) => {
      // Une facture compte dans l'année de son encaissement (ou d'émission si en attente)
      if (y !== 'all' && !(p.paidOn ?? p.issuedOn).startsWith(`${y}-`)) return false;
      if (st === 'paid' && !p.paidOn) return false;
      if (st === 'pending' && p.paidOn) return false;
      if (q && ![p.client, p.label, p.invoiceNumber, p.notes].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  });

  protected readonly totals = computed(() => {
    let paid = 0;
    let pending = 0;
    for (const p of this.filtered()) {
      if (p.paidOn) paid += p.amount;
      else pending += p.amount;
    }
    return { paid, pending };
  });

  /** Paiement dont la feuille d'actions mobile est ouverte */
  protected readonly sheet = signal<Payment | null>(null);

  /** Liste mobile groupée par mois d'émission */
  protected readonly groups = computed(() => {
    const map = new Map<string, Payment[]>();
    for (const p of this.filtered()) {
      const key = p.issuedOn.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].map(([key, items]) => {
      const [y, m] = key.split('-').map(Number);
      return { key, items, label: new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
    });
  });

  constructor() {
    void this.load();
  }

  protected sheetAction(p: Payment, action: 'paid' | 'invoice' | 'edit' | 'delete') {
    this.sheet.set(null);
    if (action === 'paid') void this.markPaid(p);
    else if (action === 'invoice') this.openInvoice(p);
    else if (action === 'edit') this.open(p);
    else void this.remove(p);
  }

  async load() {
    try {
      const [payments, clients] = await Promise.all([this.api.payments(), this.api.clients()]);
      this.clientList.set(clients);
      this.payments.set(payments);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  open(payment?: Payment) {
    const ref = this.dialog.open<boolean, PaymentDialogContext>(PaymentDialog, {
      context: { payment, clients: this.clientList(), names: this.clients() },
      contentClass: 'sm:max-w-2xl',
      closeLabel: 'Fermer',
    });
    ref.closed$.subscribe((changed) => {
      if (changed) void this.load();
    });
  }

  openInvoice(payment?: Payment) {
    const ref = this.dialog.open<boolean, InvoiceDialogContext>(InvoiceDialog, {
      context: { payment, clients: this.clientList(), payments: this.payments() ?? [] },
      contentClass: 'sm:max-w-3xl',
      closeLabel: 'Fermer',
    });
    ref.closed$.subscribe((changed) => {
      if (changed) void this.load();
    });
  }

  async markPaid(p: Payment) {
    try {
      const { id, files, invoice, ...body } = p;
      void files;
      void invoice;
      await this.api.updatePayment(id, { ...body, paidOn: todayIso() });
      toast.success('Paiement marqué comme encaissé');
      await this.load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async remove(p: Payment) {
    const files = p.files.length ? ` et ses ${p.files.length} fichier(s)` : '';
    if (!confirm(`Supprimer le paiement de ${p.client}${files} ? Cette action est définitive.`)) return;
    try {
      await this.api.deletePayment(p.id);
      toast.success('Paiement supprimé');
      await this.load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  lang(l: FileLang) {
    return LANG_LABELS[l];
  }
  money(cents: number, currency: string) {
    return formatMoney(cents, currency);
  }
}
