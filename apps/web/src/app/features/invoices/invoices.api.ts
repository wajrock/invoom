import {HttpErrorResponse} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {ApiClient} from '../../core/http/api-client';
import type {Payment} from '../payments/payment.models';
import type {GenerateInvoice, InvoiceSettings} from './invoice.models';

@Injectable({providedIn: 'root'})
export class InvoicesApi {
    private readonly api = inject(ApiClient);

    settings() {
        return this.api.get<InvoiceSettings>('/api/invoices/settings');
    }
    saveSettings(s: InvoiceSettings) {
        return this.api.put<InvoiceSettings>('/api/invoices/settings', s);
    }
    nextNumber(year: number) {
        return this.api.get<{number: string}>('/api/invoices/next-number', {year});
    }

    async preview(body: GenerateInvoice, lang: 'fr' | 'en'): Promise<Blob> {
        try {
            return await firstValueFrom(
                this.api.http.post('/api/invoices/preview', body, {params: {lang}, responseType: 'blob'}),
            );
        } catch (err) {
            // With responseType 'blob', the JSON error body also arrives as a Blob
            if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
                const text = await err.error.text().catch(() => '');
                let message = `Erreur ${err.status}`;
                try {
                    message = (JSON.parse(text) as {error?: string}).error ?? message;
                } catch {
                    // Non-JSON body: keep the status message
                }
                throw new Error(message, {cause: err});
            }
            throw err;
        }
    }

    /** Creates (or updates) the payment and stores the generated FR / EN PDFs */
    generate(body: GenerateInvoice) {
        return this.api.post<Payment>('/api/invoices', body);
    }
}
