import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {ActivityDefaults, TaxSettings} from './tax-settings.models';

@Injectable({providedIn: 'root'})
export class TaxSettingsApi {
    private readonly api = inject(ApiClient);

    get() {
        return this.api.get<TaxSettings>('/api/settings/tax');
    }
    save(s: TaxSettings) {
        return this.api.put<TaxSettings>('/api/settings/tax', s);
    }
    defaults() {
        return this.api.get<ActivityDefaults[]>('/api/settings/tax/defaults');
    }
}
