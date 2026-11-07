import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {FileLang, InvoiceFile, Payment, PaymentInput} from './payment.models';

@Injectable({providedIn: 'root'})
export class PaymentsApi {
    private readonly api = inject(ApiClient);

    list() {
        return this.api.get<Payment[]>('/api/payments');
    }
    create(p: PaymentInput) {
        return this.api.post<Payment>('/api/payments', p);
    }
    update(id: string, p: PaymentInput) {
        return this.api.put<Payment>(`/api/payments/${id}`, p);
    }
    delete(id: string) {
        return this.api.delete(`/api/payments/${id}`);
    }

    uploadFile(paymentId: string, file: File, lang: FileLang) {
        const form = new FormData();
        form.append('file', file);
        form.append('lang', lang);
        return this.api.post<InvoiceFile>(`/api/payments/${paymentId}/files`, form);
    }
    deleteFile(id: string) {
        return this.api.delete(`/api/files/${id}`);
    }
    fileUrl(id: string, download = false) {
        return `/api/files/${id}${download ? '?download=1' : ''}`;
    }
}
