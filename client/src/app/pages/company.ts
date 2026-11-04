import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy, lucideLoader2, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { Api, errorMessage } from '../core/api';
import { copyToClipboard } from '../core/format';
import type { CompanyField } from '../core/models';

const MULTILINE = new Set(['address']);

@Component({
  selector: 'app-company',
  imports: [FormsModule, NgIcon, HlmButtonImports, HlmCardImports, HlmInputImports, HlmLabelImports, HlmSkeletonImports, HlmTextareaImports],
  providers: [provideIcons({ lucideCopy, lucidePencil, lucidePlus, lucideTrash2, lucideLoader2 })],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Entreprise</h1>
        <p class="text-muted-foreground text-sm">Informations à portée de main pour tes factures et démarches</p>
      </div>
      @if (fields()) {
        <div class="flex gap-2">
          @if (editing()) {
            <button hlmBtn variant="outline" (click)="cancel()">Annuler</button>
            <button hlmBtn (click)="save()" [disabled]="saving()">
              @if (saving()) {
                <ng-icon name="lucideLoader2" class="animate-spin" />
              }
              Enregistrer
            </button>
          } @else {
            <button hlmBtn variant="outline" (click)="copyAll()"><ng-icon name="lucideCopy" /> Tout copier</button>
            <button hlmBtn (click)="edit()"><ng-icon name="lucidePencil" /> Modifier</button>
          }
        </div>
      }
    </div>

    @if (fields(); as list) {
      @if (editing()) {
        <div class="grid gap-6">
          @for (g of groups(); track g.name) {
            <section hlmCard>
              <div hlmCardHeader>
                <h2 hlmCardTitle>{{ g.name }}</h2>
              </div>
              <div hlmCardContent class="grid gap-4">
                @for (f of g.fields; track f.id) {
                  <div class="grid gap-2 sm:grid-cols-[14rem_1fr_auto] sm:items-start">
                    <input hlmInput [(ngModel)]="f.label" [attr.name]="'label-' + f.id" aria-label="Libellé" class="font-medium" />
                    @if (multiline(f)) {
                      <textarea hlmTextarea [(ngModel)]="f.value" [attr.name]="'value-' + f.id" rows="3" [attr.aria-label]="f.label"></textarea>
                    } @else {
                      <input hlmInput [(ngModel)]="f.value" [attr.name]="'value-' + f.id" [attr.aria-label]="f.label" />
                    }
                    <button hlmBtn variant="ghost" size="icon" (click)="removeField(f)" aria-label="Supprimer le champ">
                      <ng-icon name="lucideTrash2" />
                    </button>
                  </div>
                }
              </div>
            </section>
          }
          <section hlmCard>
            <div hlmCardHeader>
              <h2 hlmCardTitle>Ajouter un champ</h2>
            </div>
            <form hlmCardContent class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" (ngSubmit)="addField()">
              <div class="grid gap-2">
                <label hlmLabel for="nf-group">Groupe</label>
                <input hlmInput id="nf-group" name="group" list="nf-groups" [(ngModel)]="newField.group" />
                <datalist id="nf-groups">
                  @for (g of groups(); track g.name) {
                    <option [value]="g.name"></option>
                  }
                </datalist>
              </div>
              <div class="grid gap-2">
                <label hlmLabel for="nf-label">Libellé</label>
                <input hlmInput id="nf-label" name="label" [(ngModel)]="newField.label" placeholder="RCS, assurance RC Pro…" />
              </div>
              <button hlmBtn variant="outline" type="submit"><ng-icon name="lucidePlus" /> Ajouter</button>
            </form>
          </section>
        </div>
      } @else {
        <div class="grid gap-6 lg:grid-cols-2">
          @for (g of groups(); track g.name) {
            <section hlmCard>
              <div hlmCardHeader>
                <h2 hlmCardTitle>{{ g.name }}</h2>
              </div>
              <dl hlmCardContent class="grid gap-1">
                @for (f of g.fields; track f.id) {
                  <div class="group hover:bg-muted/60 -mx-2 flex items-start gap-3 rounded-md px-2 py-1.5">
                    <dt class="text-muted-foreground w-28 shrink-0 pt-0.5 text-sm sm:w-40">{{ f.label }}</dt>
                    <dd class="min-w-0 flex-1 text-sm break-words whitespace-pre-line" [class.text-muted-foreground]="!f.value">
                      {{ f.value || '—' }}
                    </dd>
                    @if (f.value) {
                      <button
                        hlmBtn
                        variant="ghost"
                        size="icon-xs"
                        class="pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                        (click)="copy(f)"
                        [attr.aria-label]="'Copier ' + f.label"
                      >
                        <ng-icon name="lucideCopy" />
                      </button>
                    }
                  </div>
                }
              </dl>
            </section>
          }
        </div>
      }
    } @else if (error()) {
      <p class="text-destructive text-sm">{{ error() }}</p>
    } @else {
      <div class="grid gap-6 lg:grid-cols-2">
        <hlm-skeleton class="h-64 rounded-xl" />
        <hlm-skeleton class="h-64 rounded-xl" />
      </div>
    }
  `,
})
export class CompanyPage {
  private readonly api = inject(Api);

  protected readonly fields = signal<CompanyField[] | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected newField = { group: '', label: '' };
  private snapshot: CompanyField[] = [];

  protected readonly groups = computed(() => {
    const map = new Map<string, CompanyField[]>();
    for (const f of this.fields() ?? []) map.set(f.group, [...(map.get(f.group) ?? []), f]);
    return [...map.entries()].map(([name, fields]) => ({ name, fields }));
  });

  constructor() {
    void this.load();
  }

  async load() {
    try {
      this.fields.set((await this.api.company()).fields);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  multiline(f: CompanyField) {
    return MULTILINE.has(f.id) || f.value.includes('\n');
  }

  copy(f: CompanyField) {
    void copyToClipboard(f.value, `${f.label} copié`);
  }

  copyAll() {
    const text = this.groups()
      .map((g) =>
        g.fields
          .filter((f) => f.value)
          .map((f) => `${f.label} : ${f.value}`)
          .join('\n'),
      )
      .filter(Boolean)
      .join('\n\n');
    void copyToClipboard(text, 'Informations copiées');
  }

  edit() {
    this.snapshot = structuredClone(this.fields() ?? []);
    // Copie de travail : les champs sont modifiés en place via ngModel
    this.fields.set(structuredClone(this.snapshot));
    this.editing.set(true);
  }

  cancel() {
    this.fields.set(this.snapshot);
    this.editing.set(false);
  }

  addField() {
    const label = this.newField.label.trim();
    if (!label) return void toast.error('Libellé requis');
    const group = this.newField.group.trim() || 'Général';
    const id = `${label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now().toString(36)}`;
    this.fields.update((list) => [...(list ?? []), { id, group, label, value: '' }]);
    this.newField = { group, label: '' };
  }

  removeField(f: CompanyField) {
    this.fields.update((list) => (list ?? []).filter((x) => x !== f));
  }

  async save() {
    const fields = (this.fields() ?? []).map((f) => ({ ...f, label: f.label.trim() || 'Sans titre' }));
    this.saving.set(true);
    try {
      const res = await this.api.saveCompany({ fields });
      this.fields.set(res.fields);
      this.editing.set(false);
      toast.success('Informations enregistrées');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
