import {Component, input} from '@angular/core';

/**
 * Message under a form field, shown only when there is one. Give the field `aria-describedby` set to the same id,
 * so screen readers read the message with it.
 */
@Component({
    selector: 'app-field-error',
    host: {class: 'contents'},
    template: `
        @if (message()) {
            <p [id]="messageId()" class="text-destructive text-xs leading-snug">{{ message() }}</p>
        }
    `,
})
export class FieldError {
    readonly messageId = input.required<string>();
    readonly message = input<string | undefined>('');
}
