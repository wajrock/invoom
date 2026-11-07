import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideLoader2, lucidePlus, lucideRotateCcw, lucideScanFace, lucideTrash2, lucideTriangleAlert } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { errorMessage } from '../core/api';
import { Auth, guessDeviceName, webauthnError, type PasskeyInfo } from '../core/auth';
import { FrDatePipe } from '../core/format';
import { RecoveryCodes } from '../shared/recovery-codes';

@Component({
  selector: 'app-security',
  imports: [FormsModule, NgIcon, FrDatePipe, RecoveryCodes, HlmButtonImports, HlmCardImports, HlmInputImports, HlmLabelImports, HlmSkeletonImports],
  providers: [provideIcons({ lucideScanFace, lucideKeyRound, lucidePlus, lucideTrash2, lucideRotateCcw, lucideLoader2, lucideTriangleAlert })],
  template: `
    <div class="page-head">
      <div>
        <h1>Sécurité</h1>
        <p class="text-muted-foreground text-sm">{{ email() ?? 'Connexion par passkey et codes de récupération' }}</p>
      </div>
    </div>

    @if (recovered() !== null) {
      <div class="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0 text-amber-600" />
        <div class="grid gap-1">
          <p class="font-medium">Connexion avec un code de récupération ({{ recovered() }} restant{{ recovered()! > 1 ? 's' : '' }}).</p>
          <p class="text-muted-foreground">Enregistre une passkey sur cet appareil pour te reconnecter normalement.</p>
        </div>
      </div>
    }

    @if (state(); as s) {
      <div class="grid gap-6">
        <!-- Passkeys -->
        <section hlmCard>
          <div hlmCardHeader>
            <h2 hlmCardTitle>Appareils</h2>
            <p hlmCardDescription>Chaque appareil enregistré peut se connecter avec Face ID, Touch ID ou son code de verrouillage.</p>
          </div>
          <div hlmCardContent class="grid gap-4">
            <ul class="divide-y rounded-lg border">
              @for (p of s.passkeys; track p.id) {
                <li class="flex items-center gap-3 py-3 pr-2 pl-4">
                  <ng-icon name="lucideScanFace" class="text-muted-foreground shrink-0 text-lg" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{{ p.name }}</p>
                    <p class="text-muted-foreground text-xs">
                      Ajoutée le {{ p.createdAt | frDate: 'short' }} ·
                      {{ p.lastUsedAt ? 'utilisée le ' + (p.lastUsedAt | frDate: 'short') : 'jamais utilisée' }}
                    </p>
                  </div>
                  <button
                    hlmBtn
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground shrink-0"
                    [disabled]="s.passkeys.length <= 1 || busy()"
                    [title]="s.passkeys.length <= 1 ? 'Ajoute un autre appareil avant de supprimer le dernier' : 'Supprimer'"
                    aria-label="Supprimer cette passkey"
                    (click)="remove(p)"
                  >
                    <ng-icon name="lucideTrash2" />
                  </button>
                </li>
              }
            </ul>
            <form class="flex flex-wrap items-end gap-2" (ngSubmit)="add()">
              <div class="grid min-w-48 flex-1 gap-2">
                <label hlmLabel for="device">Ajouter cet appareil</label>
                <input hlmInput id="device" name="device" maxlength="60" required [(ngModel)]="deviceName" />
              </div>
              <button hlmBtn type="submit" class="max-sm:w-full" [disabled]="busy() || !deviceName.trim()">
                @if (busy()) {
                  <ng-icon name="lucideLoader2" class="animate-spin" />
                } @else {
                  <ng-icon name="lucidePlus" />
                }
                Créer une passkey
              </button>
            </form>
            <p class="text-muted-foreground text-xs">
              Sur iPhone et Mac, les passkeys sont synchronisées par le trousseau iCloud : une seule suffit souvent pour tous tes
              appareils Apple.
            </p>
          </div>
        </section>

        <!-- Codes de récupération -->
        <section hlmCard>
          <div hlmCardHeader>
            <h2 hlmCardTitle>Codes de récupération</h2>
            <p hlmCardDescription>
              Pour te connecter si tu perds tous tes appareils. Chaque code ne sert qu'une fois.
            </p>
          </div>
          <div hlmCardContent class="grid gap-4">
            @if (codes(); as list) {
              <app-recovery-codes [codes]="list" (done)="codes.set(null)" />
            } @else {
              <p class="text-sm">
                <span class="font-medium" [class.text-destructive]="s.recoveryCodesRemaining <= 2">
                  {{ s.recoveryCodesRemaining }} code{{ s.recoveryCodesRemaining > 1 ? 's' : '' }} disponible{{ s.recoveryCodesRemaining > 1 ? 's' : '' }}
                </span>
                @if (s.recoveryCodesRemaining <= 2) {
                  <span class="text-muted-foreground"> — pense à en générer de nouveaux.</span>
                }
              </p>
              <button hlmBtn variant="outline" class="justify-self-start max-sm:w-full" [disabled]="busy()" (click)="regenerate()">
                <ng-icon name="lucideRotateCcw" /> Générer de nouveaux codes
              </button>
            }
          </div>
        </section>
      </div>
    } @else if (error()) {
      <p class="text-destructive text-sm">{{ error() }}</p>
    } @else {
      <hlm-skeleton class="block h-64 rounded-xl" />
    }
  `,
})
export class SecurityPage {
  private readonly auth = inject(Auth);
  protected readonly email = this.auth.email;
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly state = signal<{ passkeys: PasskeyInfo[]; recoveryCodesRemaining: number } | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly codes = signal<string[] | null>(null);
  protected readonly recovered = signal<number | null>(this.params.has('recovered') ? Number(this.params.get('recovered')) : null);
  protected deviceName = guessDeviceName();

  constructor() {
    void this.load();
  }

  async load() {
    try {
      this.state.set(await this.auth.passkeys());
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  private async run(action: () => Promise<void>) {
    this.busy.set(true);
    try {
      await action();
      await this.load();
    } catch (err) {
      toast.error(webauthnError(err) ?? errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  add() {
    return this.run(async () => {
      const codes = await this.auth.registerPasskey(this.deviceName.trim());
      toast.success('Passkey enregistrée sur cet appareil');
      this.recovered.set(null);
      if (codes?.length) this.codes.set(codes);
    });
  }

  remove(p: PasskeyInfo) {
    if (!confirm(`Supprimer la passkey « ${p.name} » ? Cet appareil ne pourra plus se connecter.`)) return;
    return this.run(async () => {
      await this.auth.deletePasskey(p.id);
      toast.success('Passkey supprimée');
    });
  }

  regenerate() {
    if (!confirm('Générer de nouveaux codes ? Les anciens ne fonctionneront plus.')) return;
    return this.run(async () => {
      this.codes.set(await this.auth.regenerateRecoveryCodes());
    });
  }
}
