import {Component, input, model} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideSearch} from '@ng-icons/lucide';
import {HlmInputImports} from '@spartan-ng/helm/input';

@Component({
    selector: 'app-search-input',
    imports: [NgIcon, HlmInputImports],
    providers: [provideIcons({lucideSearch})],
    host: {class: 'relative block'},
    template: `
        <ng-icon
            name="lucideSearch"
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <input
            hlmInput
            class="pl-8"
            aria-label="Rechercher"
            [placeholder]="placeholder()"
            [value]="value()"
            (input)="onInput($event)"
        />
    `,
})
export class SearchInput {
    readonly value = model('');
    readonly placeholder = input('');

    protected onInput(ev: Event) {
        this.value.set((ev.target as HTMLInputElement).value);
    }
}
