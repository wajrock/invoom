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
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Paiements</h1>
        <p class="text-muted-foreground text-sm">Factures émises et encaissements</p>
      </div>
      <div class="flex gap-2">
        <button hlmBtn variant="outline" title="Paiement sans facture générée ici : facture externe, acompte, historique…" (click)="open()"><ng-icon name="lucidePlus" /> Encaissement manuel</button>
        <button hlmBtn (click)="openInvoice()"><ng-icon name="lucideFilePlus" /> Nouvelle facture</button>
      </div>
    </div>

    <!-- Filtres -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1">
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
      <div class="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border p-4">
          <p class="text-muted-foreground text-xs">Encaissé</p>
          <p class="text-lg font-semibold tabular-nums">{{ totals().paid | eur }}</p>
        </div>
        <div class="rounded-xl border p-4">
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
        <!-- Mobile : cartes -->
        <ul class="divide-y rounded-xl border sm:hidden">
          @for (p of filtered(); track p.id) {
            <li class="flex items-start gap-3 p-3" (click)="open(p)">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ p.client }}</p>
                <p class="text-muted-foreground truncate text-xs">
                  {{ p.issuedOn | frDate: 'short' }}{{ p.invoiceNumber ? ' · ' + p.invoiceNumber : '' }}{{ p.label ? ' · ' + p.label : '' }}
                </p>
                <div class="mt-1.5 flex flex-wrap items-center gap-1">
                  @if (p.paidOn) {
                    <span hlmBadge class="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><ng-icon name="lucideCircleCheck" /> Payée</span>
                    <span class="text-muted-foreground text-xs">le {{ p.paidOn | frDate: 'short' }}</span>
                  } @else {
                    <span hlmBadge class="bg-amber-500/15 text-amber-700 dark:text-amber-400"><ng-icon name="lucideClock" /> En attente</span>
                  }
                  @for (f of p.files; track f.id) {
                    <a hlmBadge variant="outline" [href]="api.fileUrl(f.id)" target="_blank" rel="noopener" (click)="$event.stopPropagation()">
                      <ng-icon name="lucideFileText" /> {{ lang(f.lang) }}
                    </a>
                  }
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="font-medium tabular-nums">{{ p.amount | eur }}</p>
                @if (p.originalAmount !== null && p.originalCurrency !== 'EUR') {
                  <p class="text-muted-foreground text-xs tabular-nums">{{ money(p.originalAmount, p.originalCurrency) }}</p>
                }
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon-sm"
                  class="mt-1 -mr-1"
                  [hlmDropdownMenuTrigger]="menu"
                  [hlmDropdownMenuTriggerData]="{ $implicit: p }"
                  align="end"
                  aria-label="Actions"
                  (click)="$event.stopPropagation()"
                >
                  <ng-icon name="lucideEllipsis" />
                </button>
              </div>
            </li>
          }
        </ul>

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

  constructor() {
    void this.load();
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
