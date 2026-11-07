import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Client, ClientInput} from './client.models';

@Injectable({providedIn: 'root'})
export class ClientsApi {
    private readonly api = inject(ApiClient);

    list() {
        return this.api.get<Client[]>('/api/clients');
    }
    create(c: ClientInput) {
        return this.api.post<Client>('/api/clients', c);
    }
    update(id: string, c: ClientInput) {
        return this.api.put<Client>(`/api/clients/${id}`, c);
    }
    delete(id: string) {
        return this.api.delete(`/api/clients/${id}`);
    }
}
