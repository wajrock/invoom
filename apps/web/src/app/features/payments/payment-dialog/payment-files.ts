import {Component, inject, model, output, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideFileText, lucidePaperclip, lucideTrash2, lucideUpload} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {errorMessage} from '../../../core/http/error-message';
import {LANG_LABELS, type FileLang, type InvoiceFile} from '../payment.models';
import {PaymentsApi} from '../payments.api';

/** File picked in the form, uploaded once the payment is saved */
export interface PendingFile {
    file: File;
    lang: FileLang;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

/** FR / EN invoice slots of a payment: stored files and files waiting for upload. */
@Component({
    selector: 'app-payment-files',
    imports: [NgIcon, HlmButtonImports, HlmLabelImports],
    providers: [provideIcons({lucideFileText, lucidePaperclip, lucideTrash2, lucideUpload})],
    host: {class: 'grid gap-2'},
    templateUrl: './payment-files.html',
})
export class PaymentFiles {
    protected readonly api = inject(PaymentsApi);
    readonly files = model.required<InvoiceFile[]>();
    readonly pending = model.required<PendingFile[]>();
    /** A stored file was deleted on the server */
    readonly deleted = output<void>();

    protected readonly accept = ACCEPT;
    protected readonly slotLangs: FileLang[] = ['fr', 'en'];
    protected readonly langLabels = LANG_LABELS;
    protected readonly dragOver = signal<FileLang | null>(null);
    protected readonly size = formatSize;

    protected filesFor(lang: FileLang) {
        // "other" files are listed with the French invoice so they stay visible
        return this.files().filter((f) => f.lang === lang || (lang === 'fr' && f.lang === 'other'));
    }
    protected pendingFor(lang: FileLang) {
        return this.pending().filter((p) => p.lang === lang);
    }

    protected onPick(ev: Event, lang: FileLang) {
        const input = ev.target as HTMLInputElement;
        if (input.files?.[0]) this.queue(input.files[0], lang);
        input.value = '';
    }

    protected onDrop(ev: DragEvent, lang: FileLang) {
        ev.preventDefault();
        this.dragOver.set(null);
        const file = ev.dataTransfer?.files?.[0];
        if (file) this.queue(file, lang);
    }

    private queue(file: File, lang: FileLang) {
        if (file.size > MAX_SIZE) return void toast.error('Fichier trop volumineux (10 Mo max)');
        if (!ACCEPT.split(',').includes(file.type)) return void toast.error('Formats acceptés : PDF, PNG, JPEG, WebP');
        this.pending.update((list) => [...list, {file, lang}]);
    }

    protected unqueue(p: PendingFile) {
        this.pending.update((list) => list.filter((x) => x !== p));
    }

    protected async removeFile(f: InvoiceFile) {
        if (!confirm(`Supprimer « ${f.name} » ?`)) return;
        try {
            await this.api.deleteFile(f.id);
            this.files.update((list) => list.filter((x) => x.id !== f.id));
            this.deleted.emit();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }
}
