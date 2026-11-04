import { Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar } from '@ng-icons/lucide';
import { HlmInputImports } from '@spartan-ng/helm/input';

/** "2026-10-01" → "01/10/2026" */
function isoToFr(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "01/10/2026" → "2026-10-01" (null si la date n'existe pas) */
function frToIso(fr: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const valid =
    date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d);
  return valid && Number(y) >= 1900 ? `${y}-${mo}-${d}` : null;
}

/** Garde les chiffres et insère les « / » : "0110202" → "01/10/202" */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
}

/**
 * Champ date toujours affiché en jj/mm/aaaa, quelle que soit la langue du navigateur
 * (les <input type="date"> natifs suivent la langue du système).
 * La valeur échangée avec ngModel reste au format ISO (YYYY-MM-DD), ou '' si vide.
 */
@Component({
  selector: 'app-date-input',
  imports: [NgIcon, HlmInputImports],
  providers: [
    provideIcons({ lucideCalendar }),
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true },
  ],
  host: { class: 'relative block' },
  template: `
    <input
      #textInput
      hlmInput
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="jj/mm/aaaa"
      maxlength="10"
      class="pr-9"
      [id]="inputId() ?? undefined"
      [attr.aria-label]="ariaLabel()"
      [forceInvalid]="invalid()"
      [disabled]="disabled()"
      [value]="text()"
      (input)="onInput($event)"
      (blur)="onBlur()"
    />
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md"
      aria-label="Ouvrir le calendrier"
      tabindex="-1"
      [disabled]="disabled()"
      (click)="openPicker()"
    >
      <ng-icon name="lucideCalendar" />
    </button>
    <!-- Sélecteur natif invisible, utilisé uniquement pour le calendrier -->
    <input
      #picker
      type="date"
      tabindex="-1"
      aria-hidden="true"
      class="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
      [value]="value()"
      (change)="onPick($event)"
    />
  `,
})
export class DateInput implements ControlValueAccessor {
  readonly inputId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });

  protected readonly text = signal('');
  protected readonly value = signal('');
  protected readonly invalid = signal(false);
  protected readonly disabled = signal(false);

  private readonly textEl = viewChild.required<ElementRef<HTMLInputElement>>('textInput');
  private readonly pickerEl = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  onInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const masked = mask(el.value);
    el.value = masked;
    this.text.set(masked);
    if (masked === '') {
      this.invalid.set(false);
      this.commit('');
      return;
    }
    const iso = frToIso(masked);
    // Le modèle n'est mis à jour qu'avec une date complète et valide
    this.invalid.set(masked.length === 10 && !iso);
    if (iso) this.commit(iso);
  }

  onBlur() {
    this.onTouched();
    // Saisie incomplète ou invalide : on revient à la dernière date valide
    if (this.text() && !frToIso(this.text())) {
      this.text.set(isoToFr(this.value()));
      this.textEl().nativeElement.value = this.text();
      this.invalid.set(false);
    }
  }

  openPicker() {
    const el = this.pickerEl().nativeElement;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  onPick(ev: Event) {
    const iso = (ev.target as HTMLInputElement).value;
    this.text.set(isoToFr(iso));
    this.invalid.set(false);
    this.commit(iso);
    this.onTouched();
  }

  private commit(iso: string) {
    this.value.set(iso);
    this.onChange(iso);
  }

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
    this.text.set(isoToFr(v));
    this.invalid.set(false);
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }
}
