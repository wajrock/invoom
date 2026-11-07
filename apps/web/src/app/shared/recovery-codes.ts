import { Component, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideDownload } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/** Affiche une seule fois les codes de récupération, avec copie et téléchargement. */
@Component({
  selector: 'app-recovery-codes',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideCopy, lucideDownload, lucideCheck })],
  template: `
    <div class="grid gap-4">
      <div class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        Garde ces codes en lieu sûr (gestionnaire de mots de passe, papier). Chacun permet <b>une</b> connexion si tu perds tes
        appareils. Ils ne seront plus affichés.
      </div>
      <ol class="bg-muted/50 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-x-4 gap-y-2 rounded-lg border p-4 font-mono text-[13px] whitespace-nowrap tabular-nums select-all">
        @for (c of codes(); track c) {
          <li>{{ c }}</li>
        }
      </ol>
      <div class="flex flex-wrap gap-2 max-sm:*:flex-1">
        <button hlmBtn variant="outline" type="button" (click)="copy()"><ng-icon name="lucideCopy" /> Copier</button>
        <button hlmBtn variant="outline" type="button" (click)="download()"><ng-icon name="lucideDownload" /> Télécharger</button>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" class="size-4 accent-current" [checked]="saved()" (change)="saved.set(!saved())" />
        J'ai mis ces codes en lieu sûr
      </label>
      <button hlmBtn type="button" [disabled]="!saved()" (click)="done.emit()"><ng-icon name="lucideCheck" /> Continuer</button>
    </div>
  `,
})
export class RecoveryCodes {
  readonly codes = input.required<string[]>();
  readonly done = output<void>();
  protected readonly saved = signal(false);

  private text() {
    return `Codes de récupération Freelance Hub — ${new Date().toLocaleDateString('fr-FR')}\nChaque code ne fonctionne qu'une fois.\n\n${this.codes().join('\n')}\n`;
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.text());
      toast.success('Codes copiés');
    } catch {
      toast.error('Copie impossible, sélectionne les codes à la main');
    }
  }

  download() {
    const url = URL.createObjectURL(new Blob([this.text()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codes-de-recuperation.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}
