import {Component, computed, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {KIND_ICONS, KIND_STYLES, type DeadlineKind} from '../deadline.models';

/** Round tinted icon standing for a deadline kind (URSSAF, CFE, tax, reminder), like the client avatar. */
@Component({
    selector: 'app-kind-icon',
    imports: [NgIcon],
    providers: [provideIcons(KIND_ICONS)],
    host: {'[class]': 'classes()', 'aria-hidden': 'true'},
    template: `<ng-icon [name]="style().icon" />`,
})
export class KindIcon {
    readonly kind = input.required<DeadlineKind>();
    readonly size = input<'sm' | 'md'>('md');
    protected readonly style = computed(() => KIND_STYLES[this.kind()]);
    protected readonly classes = computed(() =>
        [
            'inline-grid shrink-0 place-items-center rounded-full',
            this.size() === 'md' ? 'size-10 text-base' : 'size-8 text-sm',
            this.style().tint,
        ].join(' '),
    );
}
