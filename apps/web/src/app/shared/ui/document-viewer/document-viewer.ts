import {Component, type ElementRef, inject, signal, viewChild, type OnDestroy} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideDownload} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import type {PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {drawerOptions} from '../drawer/drawer';
import {Spinner} from '../spinner/spinner';

export interface DocumentViewerContext {
    title: string;
    /** File address in the API, or a document generated in the page (invoice preview) */
    source: {url: string; downloadUrl?: string} | {blob: Blob};
    /** File name when saving a generated document */
    fileName?: string;
}

/** Opens an invoice (PDF) or an attached image in the app, without a new browser tab. */
export function openDocumentViewer(dialog: HlmDialogService, context: DocumentViewerContext) {
    return dialog.open(DocumentViewer, drawerOptions(context, 'wide')).closed$;
}

/**
 * Document viewer. PDFs are drawn page by page with pdf.js, loaded on first use: the browser's own viewer shows only
 * the first page in a frame on iPhone, and opening a tab leaves the app.
 */
@Component({
    selector: 'app-document-viewer',
    imports: [NgIcon, HlmButtonImports, HlmDialogImports, Spinner],
    providers: [provideIcons({lucideDownload})],
    host: {class: 'contents'},
    template: `
        <!-- Room on the right for the download button, laid out like the dialog's close button next to it -->
        <hlm-dialog-header class="pr-24!">
            <h2 hlmDialogTitle class="truncate text-xl leading-6 font-semibold">{{ ctx.title }}</h2>
        </hlm-dialog-header>
        @if (downloadUrl()) {
            <a
                hlmBtn
                variant="ghost"
                size="icon-sm"
                class="absolute end-13 top-5 max-sm:end-12 max-sm:top-[calc(1.25rem+env(safe-area-inset-top))]"
                [href]="downloadUrl()"
                [attr.download]="ctx.fileName ?? ''"
                aria-label="Télécharger"
                title="Télécharger"
            >
                <ng-icon name="lucideDownload" />
            </a>
        }

        <!-- Rounded like the panel's bottom corners, which it reaches (there is no footer) -->
        <div class="bg-muted/50 -mx-6 overflow-y-auto overscroll-contain p-4 max-sm:-mx-4 sm:rounded-b-2xl sm:p-6">
            @if (error()) {
                <div class="grid justify-items-center gap-3 py-10 text-center">
                    <p class="text-destructive text-sm">{{ error() }}</p>
                    @if (downloadUrl()) {
                        <a
                            hlmBtn
                            variant="outline"
                            size="sm"
                            [href]="downloadUrl()"
                            [attr.download]="ctx.fileName ?? ''"
                        >
                            <ng-icon name="lucideDownload" /> Télécharger le document
                        </a>
                    }
                </div>
            } @else if (imageUrl(); as src) {
                <img [src]="src" [alt]="ctx.title" class="mx-auto max-w-full rounded-md shadow-sm" />
            } @else {
                @if (loading()) {
                    <div class="text-muted-foreground flex justify-center py-16"><app-spinner /></div>
                }
                <div #pages class="mx-auto grid max-w-3xl gap-4"></div>
            }
        </div>
    `,
})
export class DocumentViewer implements OnDestroy {
    protected readonly ref = inject(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<DocumentViewerContext>();

    protected readonly loading = signal(true);
    protected readonly error = signal('');
    protected readonly imageUrl = signal<string | null>(null);
    protected readonly downloadUrl = signal<string | null>(null);
    private readonly pages = viewChild<ElementRef<HTMLElement>>('pages');
    /** Object URLs of generated documents, released on close */
    private readonly objectUrls: string[] = [];
    private destroyed = false;

    constructor() {
        void this.load();
    }

    ngOnDestroy() {
        this.destroyed = true;
        for (const url of this.objectUrls) URL.revokeObjectURL(url);
    }

    private objectUrl(blob: Blob) {
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);
        return url;
    }

    private async load() {
        try {
            const source = this.ctx.source;
            let blob: Blob;
            if ('blob' in source) {
                blob = source.blob;
                this.downloadUrl.set(this.objectUrl(blob));
            } else {
                const res = await fetch(source.url, {credentials: 'same-origin'});
                if (!res.ok) throw new Error();
                blob = await res.blob();
                this.downloadUrl.set(source.downloadUrl ?? source.url);
            }
            if (blob.type.startsWith('image/')) {
                this.imageUrl.set(this.objectUrl(blob));
            } else {
                await this.renderPdf(await blob.arrayBuffer());
            }
        } catch (err) {
            // Kept in the console: the message alone does not tell why (network, worker, unreadable file)
            console.error('Document viewer', err);
            this.error.set('Impossible d’afficher ce document.');
        } finally {
            this.loading.set(false);
        }
    }

    /** Every page at the width of the panel, sharp on high-density screens */
    private async renderPdf(data: ArrayBuffer) {
        // Legacy build: the modern one relies on very recent JavaScript (Uint8Array.toHex) that phones a little out
        // of date lack
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        // Served by the app itself (angular.json assets): the security policy only allows its own scripts
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        const task = pdfjs.getDocument({data, standardFontDataUrl: '/pdfjs/standard_fonts/'});
        try {
            await this.drawPages(await task.promise);
        } finally {
            // Also when drawing fails or the viewer closes midway: frees the worker
            await task.destroy();
        }
    }

    private async drawPages(pdf: PDFDocumentProxy) {
        const container = this.pages()?.nativeElement;
        if (!container) return;
        const width = container.clientWidth;
        const ratio = window.devicePixelRatio || 1;
        for (let n = 1; n <= pdf.numPages && !this.destroyed; n++) {
            const page = await pdf.getPage(n);
            const viewport = page.getViewport({scale: (width / page.getViewport({scale: 1}).width) * ratio});
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = 'w-full rounded-md bg-white shadow-sm';
            canvas.setAttribute('aria-label', `Page ${n} sur ${pdf.numPages}`);
            container.append(canvas);
            await page.render({canvas, viewport}).promise;
            if (n === 1) this.loading.set(false);
        }
    }
}
