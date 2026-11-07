import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Company} from './company.models';

@Injectable({providedIn: 'root'})
export class CompanyApi {
    private readonly api = inject(ApiClient);

    get() {
        return this.api.get<Company>('/api/company');
    }
    save(company: Company) {
        return this.api.put<Company>('/api/company', company);
    }
}
