import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';
import type {Simulation, SimulationFrom} from './simulator.models';

@Injectable({providedIn: 'root'})
export class SimulatorApi {
    private readonly api = inject(ApiClient);

    simulate(amount: number, from: SimulationFrom) {
        return this.api.get<Simulation>('/api/simulator', {amount, from});
    }
}
