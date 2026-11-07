import {Component} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideLoader2} from '@ng-icons/lucide';

/** Loading indicator for buttons and inline messages. */
@Component({
    selector: 'app-spinner',
    imports: [NgIcon],
    providers: [provideIcons({lucideLoader2})],
    host: {class: 'contents'},
    template: `<ng-icon name="lucideLoader2" class="animate-spin" />`,
})
export class Spinner {}
