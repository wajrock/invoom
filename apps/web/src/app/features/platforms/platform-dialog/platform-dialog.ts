import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {errorMessage} from '../../../core/http/error-message';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {hostOf, type Platform, type PlatformInput} from '../platform.models';
import {PlatformsApi} from '../platforms.api';

export interface PlatformDialogContext {
    platform?: Platform;
    /** Existing categories (suggestions) */
    categories: string[];
}

/** Opens the platform form; emits true when something was saved. */
export function openPlatformDialog(dialog: HlmDialogService, context: PlatformDialogContext) {
    return dialog.open<boolean, PlatformDialogContext>(PlatformDialog, {
        context,
        contentClass: 'sm:max-w-lg',
        closeLabel: 'Fermer',
    }).closed$;
}

@Component({
    selector: 'app-platform-dialog',
    imports: [FormsModule, HlmDialogImports, HlmInputImports, HlmLabelImports, DialogFooter],
    host: {class: 'contents'},
    templateUrl: './platform-dialog.html',
})
export class PlatformDialog {
    private readonly api = inject(PlatformsApi);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<PlatformDialogContext>();
    protected readonly existing = this.ctx.platform;
    protected readonly saving = signal(false);
    protected readonly form: PlatformInput = {
        name: this.existing?.name ?? '',
        url: this.existing?.url ?? '',
        category: this.existing?.category ?? 'Autre',
        description: this.existing?.description ?? '',
        login: this.existing?.login ?? '',
    };

    async save() {
        let url = this.form.url.trim();
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
        if (!this.form.name.trim() || !hostOf(url)) return void toast.error('Nom et adresse valide requis');
        const body: PlatformInput = {
            ...this.form,
            url,
            name: this.form.name.trim(),
            category: this.form.category.trim() || 'Autre',
        };
        this.saving.set(true);
        try {
            if (this.existing) await this.api.update(this.existing.id, body);
            else await this.api.create(body);
            toast.success(this.existing ? 'Plateforme mise à jour' : 'Plateforme ajoutée');
            this.ref.close(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
