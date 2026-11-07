import {Component, input, output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideRotateCcw, lucideTrash2} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {DateInput} from '../../../shared/ui/date-input/date-input';
import type {PeriodForm} from '../period-form';

/** Expanded form of a rate period; edits the given period in place. */
@Component({
    selector: 'app-rate-period-editor',
    imports: [FormsModule, NgIcon, DateInput, HlmButtonImports, HlmInputImports, HlmLabelImports, HlmSwitchImports],
    providers: [provideIcons({lucideRotateCcw, lucideTrash2})],
    host: {class: 'grid gap-4 border-t p-3'},
    templateUrl: './rate-period-editor.html',
})
export class RatePeriodEditor {
    readonly period = input.required<PeriodForm>();
    /** The oldest period starts with the activity: its start date is not editable */
    readonly oldest = input(false);
    readonly removable = input(false);
    readonly applyDefaults = output<void>();
    readonly remove = output<void>();
}
