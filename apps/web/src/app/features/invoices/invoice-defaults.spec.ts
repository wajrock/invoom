import type {Service} from '../services/service.models';
import {nextDefaults, paymentDayOptions, servicesForClient} from './invoice-defaults';

const settings = {paymentDays: 7, termsFr: 'FR par défaut', termsEn: 'EN default'};

describe('invoice defaults', () => {
    it('keeps the default terms unless they were customised', () => {
        expect(nextDefaults(settings, 30, null)).toEqual({...settings, paymentDays: 30});
        expect(nextDefaults(settings, 30, {fr: 'Perso', en: 'Custom'})).toEqual({
            paymentDays: 30,
            termsFr: 'Perso',
            termsEn: 'Custom',
        });
    });

    it('bounds the payment delay', () => {
        expect(nextDefaults(settings, 500, null).paymentDays).toBe(120);
        expect(nextDefaults(settings, -3, null).paymentDays).toBe(0);
    });

    it('offers the usual delays plus an unusual current one', () => {
        expect(paymentDayOptions(30)).toEqual([0, 7, 15, 30, 45, 60]);
        expect(paymentDayOptions(10)).toEqual([0, 7, 10, 15, 30, 45, 60]);
    });

    it('lists the client services before the shared ones', () => {
        const svc = (id: string, clientId: string | null) => ({id, clientId}) as Service;
        const list = [svc('shared', null), svc('mine', 'c1'), svc('other', 'c2')];
        expect(servicesForClient(list, 'c1').map((s) => s.id)).toEqual(['mine', 'shared']);
        expect(servicesForClient(list, '').map((s) => s.id)).toEqual(['shared']);
    });
});
