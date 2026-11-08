import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {CustomRates, Simulation, SimulationFrom} from './simulator.models';

@Injectable({providedIn: 'root'})
export class SimulatorApi {
    private readonly api = inject(ApiClient);

    /** Uses the saved tax settings, or `custom` rates when given. */
    simulate(amount: number, from: SimulationFrom, custom?: CustomRates) {
        const rates = custom ? {rates: 'custom', ...custom, vlOn: String(custom.vlOn)} : {rates: 'saved'};
        return this.api.get<Simulation>('/api/simulator', {amount, from, ...rates});
    }
}
