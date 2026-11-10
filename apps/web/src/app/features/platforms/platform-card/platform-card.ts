import {Component, computed, input, output, signal, type TemplateRef} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCopy, lucideEllipsis, lucideExternalLink, lucideGlobe} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCard} from '@spartan-ng/helm/card';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {copyToClipboard} from '../../../shared/utils/clipboard';
import {faviconOf, hostOf, type Platform} from '../platform.models';

/**
 * Link card to a platform, with its favicon and a copy-to-clipboard login. On phones a tap opens the platform
 * card (`open`) instead of the site, and the actions live there rather than in a menu.
 */
@Component({
    selector: 'app-platform-card',
    imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
    providers: [provideIcons({lucideCopy, lucideEllipsis, lucideExternalLink, lucideGlobe})],
    hostDirectives: [HlmCard],
    host: {class: 'hover:border-ring/60 group relative gap-0 py-0 transition-colors'},
    templateUrl: './platform-card.html',
})
export class PlatformCard {
    readonly platform = input.required<Platform>();
    /** Actions menu, opened from the "…" button */
    readonly menu = input.required<TemplateRef<unknown>>();
    readonly open = output<void>();

    protected readonly host = computed(() => hostOf(this.platform().url));
    protected readonly favicon = computed(() => faviconOf(this.host()));
    /** The favicon failed to load: show a generic icon */
    protected readonly broken = signal(false);

    protected follow(event: MouseEvent) {
        if (!matchMedia('(width < 40rem)').matches) return;
        event.preventDefault();
        this.open.emit();
    }

    protected copy(text: string) {
        void copyToClipboard(text, 'Identifiant copié');
    }
}
