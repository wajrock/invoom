import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Deadline, DeadlineInput} from './deadline.models';

@Injectable({providedIn: 'root'})
export class DeadlinesApi {
    private readonly api = inject(ApiClient);

    /** Deadlines between two dates (server default: from the creation year to 12 months ahead) */
    list(range: {from?: string; to?: string} = {}) {
        const params: Record<string, string> = {};
        if (range.from) params['from'] = range.from;
        if (range.to) params['to'] = range.to;
        return this.api.get<Deadline[]>('/api/deadlines', params);
    }
    create(d: DeadlineInput) {
        return this.api.post<{id: string}>('/api/deadlines', d);
    }
    update(id: string, d: DeadlineInput) {
        return this.api.put<{ok: true}>(`/api/deadlines/${id}`, d);
    }
    delete(id: string) {
        return this.api.delete(`/api/deadlines/${encodeURIComponent(id)}`);
    }
    setDone(id: string, done: boolean) {
        return this.api.put<{ok: true}>('/api/deadlines/status', {id, done});
    }
}
