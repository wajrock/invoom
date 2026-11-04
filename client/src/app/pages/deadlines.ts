import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarPlus,
  lucideCircle,
  lucideCircleCheck,
  lucideLoader2,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideTrash2,
} from '@ng-icons/lucide';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports, HlmDialogService } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { Api, errorMessage } from '../core/api';
import { DateInput } from '../shared/date-input';
import { centsToInput, daysUntil, EurPipe, FrDatePipe, parseEuros, relativeDays, todayIso } from '../core/format';
import { type Deadline, type DeadlineInput, type DeadlineKind, KIND_LABELS } from '../core/models';

// ---------------------------------------------------------------------------
// Dialogue de création / modification d'une échéance personnalisée
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-deadline-dialog',
  imports: [FormsModule, NgIcon, DateInput, HlmButtonImports, HlmDialogImports, HlmInputImports, HlmLabelImports, HlmTextareaImports],
  providers: [provideIcons({ lucideLoader2 })],
  host: { class: 'contents' },
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle>{{ existing ? 'Modifier l’échéance' : 'Nouvelle échéance' }}</h3>
      <p hlmDialogDescription>Rappel personnalisé (les échéances URSSAF, CFE et impôt sont générées automatiquement).</p>
    </hlm-dialog-header>
    <form id="deadline-form" class="grid gap-4" (ngSubmit)="save()">
      <div class="grid gap-2">
        <label hlmLabel for="d-title">Intitulé</label>
        <input hlmInput id="d-title" name="title" required [(ngModel)]="form.title" />
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="grid gap-2">
          <label hlmLabel for="d-due">Date</label>
          <app-date-input inputId="d-due" name="dueOn" required [(ngModel)]="form.dueOn" />
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="d-kind">Type</label>
          <select class="select-native" id="d-kind" name="kind" [(ngModel)]="form.kind">
            @for (k of kinds; track k.value) {
              <option [value]="k.value">{{ k.label }}</option>
            }
          </select>
        </div>
        <div class="grid gap-2">
          <label hlmLabel for="d-amount">Montant (€)</label>
          <input hlmInput id="d-amount" name="amount" inputmode="decimal" placeholder="optionnel" [(ngModel)]="form.amount" />
        </div>
      </div>
      <div class="grid gap-2">
        <label hlmLabel for="d-note">Note</label>
        <textarea hlmTextarea id="d-note" name="note" rows="3" [(ngModel)]="form.note"></textarea>
      </div>
    </form>
    <hlm-dialog-footer>
      <button hlmBtn variant="outline" type="button" (click)="ref.close(false)">Annuler</button>
      <button hlmBtn type="submit" form="deadline-form" [disabled]="saving()">
        @if (saving()) {
          <ng-icon name="lucideLoader2" class="animate-spin" />
        }
        Enregistrer
      </button>
    </hlm-dialog-footer>
  `,
})
export class DeadlineDialog {
  private readonly api = inject(Api);
  protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
  protected readonly existing = injectBrnDialogContext<{ deadline?: Deadline }>().deadline;
  protected readonly kinds = (Object.keys(KIND_LABELS) as DeadlineKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));
  protected readonly saving = signal(false);
  protected readonly form = {
    title: this.existing?.title ?? '',
    dueOn: this.existing?.dueOn ?? todayIso(),
    kind: this.existing?.kind ?? ('autre' as DeadlineKind),
    amount: centsToInput(this.existing?.amount),
    note: this.existing?.note ?? '',
  };

  async save() {
    if (!this.form.title.trim()) return void toast.error('L’intitulé est requis');
    const amount = parseEuros(this.form.amount);
    if (this.form.amount.trim() && amount === null) return void toast.error('Montant invalide');
    const body: DeadlineInput = { ...this.form, title: this.form.title.trim(), amount };
    this.saving.set(true);
    try {
      if (this.existing) await this.api.updateDeadline(this.existing.id, body);
      else await this.api.createDeadline(body);
      toast.success(this.existing ? 'Échéance mise à jour' : 'Échéance ajoutée');
      this.ref.close(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'upcoming' | 'past';
type StatusFilter = 'all' | 'done' | 'todo';

interface Group {
  key: string;
  label: string;
  items: Deadline[];
}

/** Date ISO dans n mois (même jour) */
function inMonths(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function groupByMonth(list: Deadline[]): Group[] {
  const map = new Map<string, Deadline[]>();
  for (const d of list) {
    const key = d.dueOn.slice(0, 7);
    map.set(key, [...(map.get(key) ?? []), d]);
  }
  return [...map.entries()].map(([key, items]) => {
    const [y, m] = key.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return { key, label, items };
  });
}

@Component({
  selector: 'app-deadlines',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    NgIcon,
    EurPipe,
    FrDatePipe,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmSkeletonImports,
  ],
  providers: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideCircle, lucideCircleCheck, lucideSearch, lucideCalendarPlus })],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Échéances</h1>
        <p class="text-muted-foreground text-sm">Déclarations et paiements URSSAF, CFE, impôt et rappels personnels</p>
      </div>
      <button hlmBtn (click)="open()"><ng-icon name="lucidePlus" /> Ajouter</button>
    </div>

    <!-- Onglets -->
    <div role="tablist" class="bg-muted text-muted-foreground mb-4 inline-flex h-9 items-center rounded-lg p-[3px]">
      @for (t of tabs; track t.value) {
        <button
          role="tab"
          type="button"
          class="inline-flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
          [class]="tab() === t.value ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'"
          [attr.aria-selected]="tab() === t.value"
          (click)="tab.set(t.value)"
        >
          {{ t.label }}
          @if (t.value === 'upcoming' && upcomingCount() > 0) {
            <span class="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums">{{ upcomingCount() }}</span>
          }
        </button>
      }
    </div>

    @if (deadlines(); as all) {
      @if (tab() === 'upcoming') {
        <!-- À venir -->
        @if (overdue().length) {
          <section class="mb-6">
            <h2 class="text-destructive mb-2 text-xs font-medium tracking-wide uppercase">En retard</h2>
            <ul class="border-destructive/40 divide-y rounded-xl border">
              @for (d of overdue(); track d.id) {
                <ng-container *ngTemplateOutlet="row; context: { $implicit: d }" />
              }
            </ul>
          </section>
        }
        <div class="grid gap-6">
          @for (g of upcomingGroups(); track g.key) {
            <section>
              <h2 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{{ g.label }}</h2>
              <ul class="divide-y rounded-xl border">
                @for (d of g.items; track d.id) {
                  <ng-container *ngTemplateOutlet="row; context: { $implicit: d }" />
                }
              </ul>
            </section>
          } @empty {
            @if (!overdue().length) {
              <section hlmCard class="items-center py-12 text-center">
                <p class="text-muted-foreground text-sm">Rien à faire d’ici le {{ horizon() | frDate }} 🎉</p>
              </section>
            }
          }
        </div>
        <div class="mt-6 flex items-center justify-center gap-3">
          <span class="text-muted-foreground text-xs">Jusqu’au {{ horizon() | frDate }}</span>
          <button hlmBtn variant="outline" size="sm" (click)="extend()" [disabled]="loading()">
            <ng-icon name="lucideCalendarPlus" /> Voir plus loin
          </button>
        </div>
      } @else {
        <!-- Passées -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <div class="relative min-w-48 flex-1">
            <ng-icon name="lucideSearch" class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
            <input hlmInput class="pl-8" placeholder="Rechercher…" aria-label="Rechercher" [ngModel]="query()" (ngModelChange)="query.set($event)" />
          </div>
          <select class="select-native w-auto!" aria-label="Année" [ngModel]="year()" (ngModelChange)="year.set($event)">
            <option value="all">Toutes les années</option>
            @for (y of pastYears(); track y) {
              <option [value]="y">{{ y }}</option>
            }
          </select>
          <select class="select-native w-auto!" aria-label="Type" [ngModel]="kind()" (ngModelChange)="kind.set($event)">
            <option value="all">Tous les types</option>
            @for (k of kinds; track k.value) {
              <option [value]="k.value">{{ k.label }}</option>
            }
          </select>
          <select class="select-native w-auto!" aria-label="Statut" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="all">Tous les statuts</option>
            <option value="done">Réglées</option>
            <option value="todo">Non réglées</option>
          </select>
        </div>
        <p class="text-muted-foreground mb-3 text-xs">
          {{ pastFiltered().length }} échéance{{ pastFiltered().length > 1 ? 's' : '' }} · {{ pastTotal() | eur }}
        </p>
        <div class="grid gap-6">
          @for (g of pastGroups(); track g.key) {
            <section>
              <h2 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{{ g.label }}</h2>
              <ul class="divide-y rounded-xl border">
                @for (d of g.items; track d.id) {
                  <ng-container *ngTemplateOutlet="row; context: { $implicit: d }" />
                }
              </ul>
            </section>
          } @empty {
            <section hlmCard class="items-center py-12 text-center">
              <p class="text-muted-foreground text-sm">Aucune échéance dans l’historique{{ hasFilters() ? ' pour ces filtres' : '' }}.</p>
            </section>
          }
        </div>
      }
    } @else if (error()) {
      <p class="text-destructive text-sm">{{ error() }}</p>
    } @else {
      <hlm-skeleton class="block h-64 rounded-xl" />
    }

    <!-- Ligne d'échéance -->
    <ng-template #row let-d>
      <li class="flex items-start gap-3 p-3" [class.opacity-60]="d.done">
        <button
          hlmBtn
          variant="ghost"
          size="icon-sm"
          class="mt-0.5 shrink-0"
          (click)="toggle(d)"
          [attr.aria-label]="d.done ? 'Marquer comme non réglée' : 'Marquer comme réglée'"
          [title]="d.done ? 'Marquer comme non réglée' : 'Marquer comme réglée'"
        >
          <ng-icon [name]="d.done ? 'lucideCircleCheck' : 'lucideCircle'" [class.text-emerald-600]="d.done" class="text-lg" />
        </button>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium" [class.line-through]="d.done">{{ d.title }}</p>
            <span hlmBadge variant="outline">{{ kindLabel(d.kind) }}</span>
            @if (!d.done && late(d)) {
              <span hlmBadge variant="destructive">En retard</span>
            }
          </div>
          <p class="text-muted-foreground mt-0.5 text-sm">
            {{ d.dueOn | frDate }}
            @if (!d.done) {
              · {{ rel(d.dueOn) }}
            } @else if (d.doneAt) {
              · réglée le {{ d.doneAt | frDate: 'short' }}
            }
          </p>
          @if (d.note) {
            <p class="text-muted-foreground mt-1 text-xs whitespace-pre-line">{{ d.note }}</p>
          }
        </div>
        <span class="shrink-0 pt-1 text-sm font-medium tabular-nums">{{ d.amount | eur }}</span>
        @if (!d.auto) {
          <div class="flex shrink-0">
            <button hlmBtn variant="ghost" size="icon-sm" (click)="open(d)" aria-label="Modifier"><ng-icon name="lucidePencil" /></button>
            <button hlmBtn variant="ghost" size="icon-sm" (click)="remove(d)" aria-label="Supprimer"><ng-icon name="lucideTrash2" /></button>
          </div>
        }
      </li>
    </ng-template>
  `,
})
export class DeadlinesPage {
  private readonly api = inject(Api);
  private readonly dialog = inject(HlmDialogService);

  protected readonly tabs: { value: Tab; label: string }[] = [
    { value: 'upcoming', label: 'À venir' },
    { value: 'past', label: 'Historique' },
  ];
  protected readonly kinds = (Object.keys(KIND_LABELS) as DeadlineKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly deadlines = signal<Deadline[] | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  /** Nombre de mois affichés dans « À venir » */
  private readonly months = signal(12);
  protected readonly horizon = computed(() => inMonths(this.months()));

  // Filtres de l'onglet « Passées »
  protected readonly query = signal('');
  protected readonly year = signal('all');
  protected readonly kind = signal<'all' | DeadlineKind>('all');
  protected readonly status = signal<StatusFilter>('all');

  private readonly today = todayIso();

  /** Non réglées dont la date est dépassée */
  protected readonly overdue = computed(() => (this.deadlines() ?? []).filter((d) => !d.done && d.dueOn < this.today));

  protected readonly upcomingGroups = computed(() =>
    groupByMonth((this.deadlines() ?? []).filter((d) => !d.done && d.dueOn >= this.today && d.dueOn <= this.horizon())),
  );

  /** Pastille : en retard + à régler dans les 30 jours */
  protected readonly upcomingCount = computed(
    () => this.overdue().length + (this.deadlines() ?? []).filter((d) => !d.done && d.dueOn >= this.today && daysUntil(d.dueOn) <= 30).length,
  );

  /** Historique : échéances passées, et échéances futures déjà réglées */
  private readonly past = computed(() => (this.deadlines() ?? []).filter((d) => d.done || d.dueOn < this.today).reverse());

  protected readonly pastYears = computed(() => [...new Set(this.past().map((d) => d.dueOn.slice(0, 4)))]);

  protected readonly hasFilters = computed(
    () => !!this.query().trim() || this.year() !== 'all' || this.kind() !== 'all' || this.status() !== 'all',
  );

  protected readonly pastFiltered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.past().filter((d) => {
      if (this.year() !== 'all' && !d.dueOn.startsWith(`${this.year()}-`)) return false;
      if (this.kind() !== 'all' && d.kind !== this.kind()) return false;
      if (this.status() === 'done' && !d.done) return false;
      if (this.status() === 'todo' && d.done) return false;
      if (q && !`${d.title} ${d.note}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected readonly pastGroups = computed(() => groupByMonth(this.pastFiltered()));
  protected readonly pastTotal = computed(() => this.pastFiltered().reduce((s, d) => s + (d.amount ?? 0), 0));

  constructor() {
    void this.load();
  }

  async load() {
    this.error.set('');
    this.loading.set(true);
    try {
      // Depuis l'année de création (valeur par défaut côté serveur) jusqu'à l'horizon choisi
      this.deadlines.set(await this.api.deadlines({ to: this.horizon() }));
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  extend() {
    this.months.update((m) => m + 12);
    void this.load();
  }

  async toggle(d: Deadline) {
    // Mise à jour optimiste
    this.deadlines.update(
      (list) => list?.map((x) => (x.id === d.id ? { ...x, done: !d.done, doneAt: d.done ? null : new Date().toISOString() } : x)) ?? null,
    );
    try {
      await this.api.setDeadlineDone(d.id, !d.done);
    } catch (err) {
      toast.error(errorMessage(err));
      await this.load();
    }
  }

  open(deadline?: Deadline) {
    const ref = this.dialog.open<boolean>(DeadlineDialog, { context: { deadline }, contentClass: 'sm:max-w-lg', closeLabel: 'Fermer' });
    ref.closed$.subscribe((changed) => {
      if (changed) void this.load();
    });
  }

  async remove(d: Deadline) {
    if (!confirm(`Supprimer « ${d.title} » ?`)) return;
    try {
      await this.api.deleteDeadline(d.id);
      toast.success('Échéance supprimée');
      await this.load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  late(d: Deadline) {
    return daysUntil(d.dueOn) < 0;
  }
  rel(iso: string) {
    return relativeDays(iso);
  }
  kindLabel(k: DeadlineKind) {
    return KIND_LABELS[k];
  }
}
