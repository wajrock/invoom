import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  ActivityDefaults,
  Client,
  ClientInput,
  Company,
  Dashboard,
  Deadline,
  DeadlineInput,
  FileLang,
  GenerateInvoice,
  InvoiceFile,
  InvoiceSettings,
  Service,
  ServiceInput,
  Payment,
  PaymentInput,
  Platform,
  PlatformInput,
  TaxSettings,
} from './models';

/** Message d'erreur lisible à partir d'une réponse de l'API. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Serveur injoignable';
    const body = err.error as { error?: string } | null;
    return body?.error ?? `Erreur ${err.status}`;
  }
  return err instanceof Error ? err.message : 'Erreur inattendue';
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private run<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }

  // Tableau de bord
  dashboard(year: number) {
    return this.run(this.http.get<Dashboard>('/api/dashboard', { params: { year } }));
  }

  // Entreprise
  company() {
    return this.run(this.http.get<Company>('/api/company'));
  }
  saveCompany(company: Company) {
    return this.run(this.http.put<Company>('/api/company', company));
  }

  // Paramètres fiscaux
  taxSettings() {
    return this.run(this.http.get<TaxSettings>('/api/settings/tax'));
  }
  saveTaxSettings(s: TaxSettings) {
    return this.run(this.http.put<TaxSettings>('/api/settings/tax', s));
  }
  taxDefaults() {
    return this.run(this.http.get<ActivityDefaults[]>('/api/settings/tax/defaults'));
  }

  // Plateformes
  platforms() {
    return this.run(this.http.get<Platform[]>('/api/platforms'));
  }
  createPlatform(p: PlatformInput) {
    return this.run(this.http.post<Platform>('/api/platforms', p));
  }
  updatePlatform(id: string, p: PlatformInput) {
    return this.run(this.http.put<Platform>(`/api/platforms/${id}`, p));
  }
  deletePlatform(id: string) {
    return this.run(this.http.delete<void>(`/api/platforms/${id}`));
  }
  reorderPlatforms(ids: string[]) {
    return this.run(this.http.put<Platform[]>('/api/platforms/order', { ids }));
  }

  // Clients
  clients() {
    return this.run(this.http.get<Client[]>('/api/clients'));
  }
  createClient(c: ClientInput) {
    return this.run(this.http.post<Client>('/api/clients', c));
  }
  updateClient(id: string, c: ClientInput) {
    return this.run(this.http.put<Client>(`/api/clients/${id}`, c));
  }
  deleteClient(id: string) {
    return this.run(this.http.delete<void>(`/api/clients/${id}`));
  }

  // Catalogue de prestations
  services() {
    return this.run(this.http.get<Service[]>('/api/services'));
  }
  createService(s: ServiceInput) {
    return this.run(this.http.post<Service>('/api/services', s));
  }
  updateService(id: string, s: ServiceInput) {
    return this.run(this.http.put<Service>(`/api/services/${id}`, s));
  }
  deleteService(id: string) {
    return this.run(this.http.delete<void>(`/api/services/${id}`));
  }

  // Générateur de factures
  invoiceSettings() {
    return this.run(this.http.get<InvoiceSettings>('/api/invoices/settings'));
  }
  saveInvoiceSettings(s: InvoiceSettings) {
    return this.run(this.http.put<InvoiceSettings>('/api/invoices/settings', s));
  }
  nextInvoiceNumber(year: number) {
    return this.run(this.http.get<{ number: string }>('/api/invoices/next-number', { params: { year } }));
  }
  async previewInvoice(body: GenerateInvoice, lang: 'fr' | 'en'): Promise<Blob> {
    try {
      return await this.run(this.http.post('/api/invoices/preview', body, { params: { lang }, responseType: 'blob' }));
    } catch (err) {
      // En mode « blob », le corps d'erreur JSON arrive lui aussi sous forme de Blob
      if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
        const text = await err.error.text().catch(() => '');
        let message = `Erreur ${err.status}`;
        try {
          message = (JSON.parse(text) as { error?: string }).error ?? message;
        } catch {
          /* corps non JSON */
        }
        throw new Error(message);
      }
      throw err;
    }
  }
  /** Crée (ou met à jour) le paiement et stocke les PDF FR / EN générés */
  generateInvoice(body: GenerateInvoice) {
    return this.run(this.http.post<Payment>('/api/invoices', body));
  }

  // Paiements et factures
  payments() {
    return this.run(this.http.get<Payment[]>('/api/payments'));
  }
  createPayment(p: PaymentInput) {
    return this.run(this.http.post<Payment>('/api/payments', p));
  }
  updatePayment(id: string, p: PaymentInput) {
    return this.run(this.http.put<Payment>(`/api/payments/${id}`, p));
  }
  deletePayment(id: string) {
    return this.run(this.http.delete<void>(`/api/payments/${id}`));
  }
  uploadFile(paymentId: string, file: File, lang: FileLang) {
    const form = new FormData();
    form.append('file', file);
    form.append('lang', lang);
    return this.run(this.http.post<InvoiceFile>(`/api/payments/${paymentId}/files`, form));
  }
  deleteFile(id: string) {
    return this.run(this.http.delete<void>(`/api/files/${id}`));
  }
  fileUrl(id: string, download = false) {
    return `/api/files/${id}${download ? '?download=1' : ''}`;
  }

  // Échéances
  /** Échéances entre deux dates (par défaut : depuis l'année de création jusqu'à dans 12 mois) */
  deadlines(range: { from?: string; to?: string } = {}) {
    const params: Record<string, string> = {};
    if (range.from) params['from'] = range.from;
    if (range.to) params['to'] = range.to;
    return this.run(this.http.get<Deadline[]>('/api/deadlines', { params }));
  }
  createDeadline(d: DeadlineInput) {
    return this.run(this.http.post<{ id: string }>('/api/deadlines', d));
  }
  updateDeadline(id: string, d: DeadlineInput) {
    return this.run(this.http.put<{ ok: true }>(`/api/deadlines/${id}`, d));
  }
  deleteDeadline(id: string) {
    return this.run(this.http.delete<void>(`/api/deadlines/${id}`));
  }
  setDeadlineDone(id: string, done: boolean) {
    return this.run(this.http.put<{ ok: true }>('/api/deadlines/status', { id, done }));
  }
}
