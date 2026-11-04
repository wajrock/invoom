import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEllipsis, lucidePencil, lucidePlus, lucideSearch, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Api, errorMessage } from '../core/api';
import { EurPipe } from '../core/format';
import type { Client, Service } from '../core/models';
import { ServiceDialog, type ServiceDialogContext } from './service-dialog';

@Component({
  selector: 'app-services',
  imports: [FormsModule, NgIcon, EurPipe, HlmButtonImports, HlmCardImports, HlmDropdownMenuImports, HlmInputImports, HlmSkeletonImports, HlmTableImports],
  providers: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideEllipsis, lucideSearch })],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Prestations</h1>
        <p class="text-muted-foreground text-sm">Lignes de facture réutilisables, avec leur prix et leur traduction</p>
      </div>
      <button hlmBtn (click)="edit()"><ng-icon name="lucidePlus" /> Nouvelle prestation</button>
    </div>

    @if (services(); as list) {
      @if (list.length === 0) {
        <section hlmCard class="items-center py-12 text-center">
          <p class="text-muted-foreground text-sm">Aucune prestation enregistrée.</p>
          <button hlmBtn variant="outline" (click)="edit()"><ng-icon name="lucidePlus" /> Ajouter la première</button>
        </section>
      } @else {
        <div class="relative mb-4 max-w-sm">
          <ng-icon name="lucideSearch" class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
          <input hlmInput class="pl-8" placeholder="Rechercher une prestation" aria-label="Rechercher" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        </div>
        <div hlmTableContainer class="overflow-hidden rounded-xl border">
          <table hlmTable class="[&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_tr>*:first-child]:pl-5 [&_tr>*:last-child]:pr-4">
            <thead hlmTHead class="bg-muted/40">
              <tr hlmTr>
                <th hlmTh>Désignation</th>
                <th hlmTh class="hidden sm:table-cell">Client</th>
                <th hlmTh class="hidden lg:table-cell">Version anglaise</th>
                <th hlmTh class="hidden sm:table-cell">Unité</th>
                <th hlmTh class="text-right">Prix u. HT</th>
                <th hlmTh class="w-10"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (s of filtered(); track s.id) {
                <tr hlmTr class="cursor-pointer" (click)="edit(s)">
                  <td hlmTd class="max-w-72">
                    <p class="truncate font-medium">{{ s.label }}</p>
                    @if (s.detail) {
                      <p class="text-muted-foreground truncate text-xs">{{ s.detail }}</p>
                    }
                  </td>
                  <td hlmTd class="hidden whitespace-nowrap sm:table-cell" [class.text-muted-foreground]="!s.clientId">{{ clientName(s.clientId) }}</td>
                  <td hlmTd class="text-muted-foreground hidden max-w-60 truncate lg:table-cell">{{ s.labelEn || '—' }}</td>
                  <td hlmTd class="text-muted-foreground hidden sm:table-cell">{{ s.unit || '—' }}</td>
                  <td hlmTd class="text-right font-medium whitespace-nowrap tabular-nums">{{ s.unitPrice | eur }}</td>
                  <td hlmTd (click)="$event.stopPropagation()">
                    <button hlmBtn variant="ghost" size="icon-sm" [hlmDropdownMenuTrigger]="menu" [hlmDropdownMenuTriggerData]="{ $implicit: s }" align="end" aria-label="Actions">
                      <ng-icon name="lucideEllipsis" />
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr hlmTr>
                  <td hlmTd colspan="6" class="text-muted-foreground py-8 text-center">Aucune prestation ne correspond à la recherche.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else if (error()) {
      <p class="text-destructive text-sm">{{ error() }}</p>
    } @else {
      <hlm-skeleton class="block h-48 rounded-xl" />
    }

    <ng-template #menu let-s>
      <hlm-dropdown-menu class="w-44">
        <button hlmDropdownMenuItem (click)="edit(s)"><ng-icon name="lucidePencil" /> Modifier</button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem variant="destructive" (click)="remove(s)"><ng-icon name="lucideTrash2" /> Supprimer</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class ServicesPage {
  private readonly api = inject(Api);
  private readonly dialog = inject(HlmDialogService);

  protected readonly services = signal<Service[] | null>(null);
  protected readonly clients = signal<Client[]>([]);
  protected readonly error = signal('');
  protected readonly query = signal('');

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.services() ?? []).filter(
      (s) => !q || [s.label, s.labelEn, s.detail, s.unit].some((v) => v.toLowerCase().includes(q)),
    );
  });

  constructor() {
    void this.load();
  }

  async load() {
    try {
      const [services, clients] = await Promise.all([this.api.services(), this.api.clients()]);
      this.clients.set(clients);
      this.services.set(services);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  edit(service?: Service) {
    const ref = this.dialog.open<Service | undefined, ServiceDialogContext>(ServiceDialog, {
      context: { service, clients: this.clients() },
      contentClass: 'sm:max-w-xl',
      closeLabel: 'Fermer',
    });
    ref.closed$.subscribe((saved) => {
      if (saved) void this.load();
    });
  }

  protected clientName(id: string | null) {
    if (!id) return 'Tous';
    return this.clients().find((c) => c.id === id)?.name ?? 'Client supprimé';
  }

  async remove(s: Service) {
    if (!confirm(`Supprimer la prestation « ${s.label} » ? Les factures déjà émises ne sont pas modifiées.`)) return;
    try {
      await this.api.deleteService(s.id);
      toast.success('Prestation supprimée');
      await this.load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
}
