import {inject, Injectable} from '@angular/core';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {openDocumentViewer} from '../../shared/ui/document-viewer/document-viewer';
import type {InvoiceFile} from './payment.models';
import {PaymentsApi} from './payments.api';

/** Opens a payment's invoice or attached file in the app's document viewer */
@Injectable({providedIn: 'root'})
export class InvoiceFileViewer {
    private readonly dialog = inject(HlmDialogService);
    private readonly api = inject(PaymentsApi);

    open(file: InvoiceFile, title: string) {
        openDocumentViewer(this.dialog, {
            title,
            source: {url: this.api.fileUrl(file.id), downloadUrl: this.api.fileUrl(file.id, true)},
            fileName: file.name,
        });
    }
}
