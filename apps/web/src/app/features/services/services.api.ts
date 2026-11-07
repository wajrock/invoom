import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Service, ServiceInput} from './service.models';

@Injectable({providedIn: 'root'})
export class ServicesApi {
    private readonly api = inject(ApiClient);

    list() {
        return this.api.get<Service[]>('/api/services');
    }
    create(s: ServiceInput) {
        return this.api.post<Service>('/api/services', s);
    }
    update(id: string, s: ServiceInput) {
        return this.api.put<Service>(`/api/services/${id}`, s);
    }
    delete(id: string) {
        return this.api.delete(`/api/services/${id}`);
    }
}
