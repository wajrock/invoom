import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Dashboard} from './dashboard.models';

@Injectable({providedIn: 'root'})
export class DashboardApi {
    private readonly api = inject(ApiClient);

    get(year: number) {
        return this.api.get<Dashboard>('/api/dashboard', {year});
    }
}
