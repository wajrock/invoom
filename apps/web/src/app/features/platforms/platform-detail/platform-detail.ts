import {Component, inject, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideArrowDown,
    lucideArrowUp,
    lucideCopy,
    lucideExternalLink,
    lucideGlobe,
    lucidePencil,
} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {DetailFooter} from '../../../shared/ui/detail-footer/detail-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {copyToClipboard} from '../../../shared/utils/clipboard';
import {faviconOf, hostOf, type Platform} from '../platform.models';

export interface PlatformDetailContext {
    platform: Platform;
    /** First or last of its category: it cannot move further that way */
    isFirst: boolean;
    isLast: boolean;
}

export type PlatformDetailAction = 'edit' | 'delete' | 'up' | 'down';

/** Opens the platform card; emits the action picked, or undefined when closed. */
export function openPlatformDetail(dialog: HlmDialogService, context: PlatformDetailContext) {
    return dialog.open<PlatformDetailAction | undefined, PlatformDetailContext>(PlatformDetail, drawerOptions(context))
        .closed$;
}

/** Platform card on phones, where the list card opens it instead of the site: link, login and actions. */
@Component({
    selector: 'app-platform-detail',
    imports: [NgIcon, HlmButtonImports, HlmDialogImports, DetailFooter],
    providers: [
        provideIcons({lucideArrowDown, lucideArrowUp, lucideCopy, lucideExternalLink, lucideGlobe, lucidePencil}),
    ],
    host: {class: 'contents'},
    templateUrl: './platform-detail.html',
})
export class PlatformDetail {
    protected readonly ref = inject<BrnDialogRef<PlatformDetailAction | undefined>>(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<PlatformDetailContext>();

    protected readonly p = this.ctx.platform;
    protected readonly host = hostOf(this.p.url);
    protected readonly favicon = faviconOf(this.host);
    /** The favicon failed to load: show a generic icon */
    protected readonly broken = signal(false);

    protected copy(text: string) {
        void copyToClipboard(text, 'Identifiant copié');
    }

    protected close(action?: PlatformDetailAction) {
        this.ref.close(action);
    }
}
