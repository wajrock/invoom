import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Platform, PlatformInput} from './platform.models';

@Injectable({providedIn: 'root'})
export class PlatformsApi {
    private readonly api = inject(ApiClient);

    list() {
        return this.api.get<Platform[]>('/api/platforms');
    }
    create(p: PlatformInput) {
        return this.api.post<Platform>('/api/platforms', p);
    }
    update(id: string, p: PlatformInput) {
        return this.api.put<Platform>(`/api/platforms/${id}`, p);
    }
    delete(id: string) {
        return this.api.delete(`/api/platforms/${id}`);
    }
    reorder(ids: string[]) {
        return this.api.put<Platform[]>('/api/platforms/order', {ids});
    }
}
