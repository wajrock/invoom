import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Activity} from '../settings/tax-settings.models';

export interface OnboardingInput {
    company: {
        name: string;
        legal: string;
        siret: string;
        address: string;
        email: string;
        phone: string;
        iban: string;
        bic: string;
        bank: string;
        accountHolder: string;
    };
    tax: {activity: Activity; activityStart: string; versementLiberatoire: boolean};
}

@Injectable({providedIn: 'root'})
export class OnboardingApi {
    private readonly api = inject(ApiClient);

    complete(body: OnboardingInput) {
        return this.api.post<{ok: true}>('/api/auth/onboarding', body);
    }
}
