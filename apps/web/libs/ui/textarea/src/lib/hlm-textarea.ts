import {Directive} from '@angular/core';
import {BrnFieldControlDescribedBy} from '@spartan-ng/brain/field';
import {BrnTextarea} from '@spartan-ng/brain/textarea';
import {classes} from '@spartan-ng/helm/utils';

@Directive({
    selector: '[hlmTextarea]',
    exportAs: 'hlmTextarea',
    hostDirectives: [{directive: BrnTextarea, inputs: ['id', 'forceInvalid']}, BrnFieldControlDescribedBy],
    host: {'data-slot': 'textarea'},
})
export class HlmTextarea {
    constructor() {
        classes(
            () =>
                'border-input focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 data-[matches-spartan-invalid=true]:border-destructive rounded-md border bg-field px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50',
        );
    }
}
