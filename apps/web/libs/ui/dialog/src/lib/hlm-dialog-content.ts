import type {BooleanInput} from '@angular/cdk/coercion';
import type {ComponentType} from '@angular/cdk/portal';
import {NgComponentOutlet} from '@angular/common';
import {booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideX} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButton} from '@spartan-ng/helm/button';

import {classes} from '@spartan-ng/helm/utils';
import {HlmDialogClose} from './hlm-dialog-close';

type HlmDialogContentContext = {
    $component?: ComponentType<unknown>;
    $dynamicComponentClass?: string;
    $showCloseButton?: boolean;
    $closeLabel?: string;
};

@Component({
    selector: 'hlm-dialog-content',
    exportAs: 'hlmDialogContent',
    imports: [NgComponentOutlet, HlmButton, HlmDialogClose, NgIcon],
    providers: [provideIcons({lucideX})],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        'data-slot': 'dialog-content',
        '[attr.data-state]': 'state()',
    },
    template: `
        @if (component) {
            <ng-container [ngComponentOutlet]="component" />
        } @else {
            <ng-content />
        }

        @if (showCloseButton()) {
            <button
                hlmBtn
                variant="ghost"
                size="icon-sm"
                class="absolute end-4 top-4 max-sm:end-2 max-sm:top-3"
                hlmDialogClose
            >
                <span class="sr-only">{{ closeLabel() }}</span>
                <ng-icon name="lucideX" />
            </button>
        }
    `,
})
export class HlmDialogContent {
    private readonly _dialogRef = inject(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<HlmDialogContentContext | null>({
        optional: true,
    });

    public readonly showCloseButton = input<boolean, BooleanInput>(this._dialogContext?.$showCloseButton ?? true, {
        transform: booleanAttribute,
    });
    public readonly closeLabel = input<string>(this._dialogContext?.$closeLabel ?? 'Close');

    public readonly state = computed(() => this._dialogRef?.state() ?? 'closed');

    public readonly component = this._dialogContext?.$component;
    private readonly _dynamicComponentClass = this._dialogContext?.$dynamicComponentClass;

    constructor() {
        classes(() => [
            'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-6 rounded-xl p-6 text-sm ring-1 duration-100 sm:max-w-md relative mx-auto w-[calc(100vw-2rem)] outline-none sm:mx-0',
            // Mobile : panneau qui monte du bas (bottom sheet), pleine largeur, poignée et zone sûre
            'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:max-h-[92dvh] max-sm:grid-rows-[auto_minmax(0,1fr)_auto] max-sm:gap-5 max-sm:rounded-none max-sm:rounded-t-2xl max-sm:px-4 max-sm:pt-7 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:data-open:zoom-in-100 max-sm:data-closed:zoom-out-100 max-sm:data-open:slide-in-from-bottom max-sm:data-closed:slide-out-to-bottom max-sm:duration-300 max-sm:ease-out',
            "max-sm:before:bg-muted-foreground/30 max-sm:before:absolute max-sm:before:top-2.5 max-sm:before:left-1/2 max-sm:before:h-1 max-sm:before:w-10 max-sm:before:-translate-x-1/2 max-sm:before:rounded-full max-sm:before:content-['']",
            this._dynamicComponentClass,
        ]);
    }
}
