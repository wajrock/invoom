import {Component, computed, inject, Injectable, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {firstValueFrom} from 'rxjs';

export interface ConfirmOptions {
    title: string;
    description?: string;
    /** Main button; "Confirmer" by default */
    confirmLabel?: string;
    cancelLabel?: string;
    /** Red main button, for what cannot be undone */
    destructive?: boolean;
    /** Text to type again before confirming (case and spaces ignored), for the most serious actions */
    confirmText?: string;
    confirmTextLabel?: string;
}

/**
 * A centred card on larger screens and a sheet at the bottom on phones, within thumb reach, rather than the
 * full-screen page other dialogs use there.
 */
const CONFIRM_CLASS = [
    'sm:max-w-sm gap-0 p-0 overflow-hidden',
    'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:grid-rows-none max-sm:gap-0 max-sm:p-0',
    'max-sm:rounded-t-2xl max-sm:bg-popover max-sm:ring-1 max-sm:shadow-2xl',
].join(' ');

@Component({
    selector: 'app-confirm-dialog',
    imports: [FormsModule, HlmButtonImports, HlmDialogImports, HlmInputImports, HlmLabelImports],
    host: {class: 'contents'},
    template: `
        <div class="px-5 py-3.5" [class.border-b]="ctx.description">
            <h2 hlmDialogTitle class="text-base leading-6 font-semibold text-pretty">{{ ctx.title }}</h2>
        </div>
        @if (ctx.description) {
            <p hlmDialogDescription class="px-5 py-4 text-sm text-pretty whitespace-pre-line">{{ ctx.description }}</p>
        }
        @if (ctx.confirmText) {
            <div class="grid gap-2 px-5 pb-4">
                <label hlmLabel for="confirm-text">{{
                    ctx.confirmTextLabel ?? 'Saisis « ' + ctx.confirmText + ' »'
                }}</label>
                <input
                    hlmInput
                    id="confirm-text"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    [placeholder]="ctx.confirmText"
                    [ngModel]="typed()"
                    (ngModelChange)="typed.set($event)"
                />
            </div>
        }
        <!-- Cancel comes first so it gets the focus: Enter never confirms by accident -->
        <div
            class="flex justify-end gap-2 border-t px-5 py-3 max-sm:flex-col-reverse max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
            <button hlmBtn variant="outline" size="sm" type="button" (click)="ref.close(false)">
                {{ ctx.cancelLabel ?? 'Annuler' }}
            </button>
            <button
                hlmBtn
                size="sm"
                type="button"
                [variant]="ctx.destructive ? 'destructive' : 'default'"
                [disabled]="!matches()"
                (click)="ref.close(true)"
            >
                {{ ctx.confirmLabel ?? 'Confirmer' }}
            </button>
        </div>
    `,
})
export class ConfirmDialog {
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<ConfirmOptions>();
    protected readonly typed = signal('');
    private readonly normalize = (s: string) => s.trim().toLowerCase();
    protected readonly matches = computed(
        () => !this.ctx.confirmText || this.normalize(this.typed()) === this.normalize(this.ctx.confirmText),
    );
}

/** The app's confirmation dialog, in place of the browser's confirm() */
@Injectable({providedIn: 'root'})
export class Confirm {
    private readonly dialog = inject(HlmDialogService);

    /** true once confirmed; false when cancelled or dismissed (Escape, click outside) */
    async ask(options: ConfirmOptions): Promise<boolean> {
        const ref = this.dialog.open<boolean, ConfirmOptions>(ConfirmDialog, {
            context: options,
            contentClass: CONFIRM_CLASS,
            showCloseButton: false,
            role: 'alertdialog',
        });
        return (await firstValueFrom(ref.closed$)) === true;
    }

    /** Leaving a form whose changes were not saved */
    discardChanges(): Promise<boolean> {
        return this.ask({
            title: 'Abandonner les modifications ?',
            description: 'Ce que tu as saisi ne sera pas enregistré.',
            confirmLabel: 'Abandonner',
            cancelLabel: 'Continuer la saisie',
            destructive: true,
        });
    }
}
