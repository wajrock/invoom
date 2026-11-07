import {Component} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideTriangleAlert} from '@ng-icons/lucide';

@Component({
    selector: 'app-warning-banner',
    imports: [NgIcon],
    providers: [provideIcons({lucideTriangleAlert})],
    host: {class: 'flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm'},
    template: `
        <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0 text-amber-600" />
        <div class="min-w-0 flex-1"><ng-content /></div>
    `,
})
export class WarningBanner {}
