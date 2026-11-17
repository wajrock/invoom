import assert from 'node:assert/strict';
import {test} from 'node:test';
import {onboardingSchema} from './onboarding.schema.ts';

const valid = {
    company: {
        name: 'Jo Dupont',
        legal: 'Entrepreneur individuel',
        siret: '732 829 320 00074',
        address: '1 rue des Fleurs\n75001 Paris',
        email: 'jo@exemple.fr',
        iban: 'FR76 3000 6000 0112 3456 7890 189',
        bank: 'Banque Exemple',
        accountHolder: 'Jo Dupont',
    },
    tax: {activity: 'bnc', activityStart: '2026-01-01'},
};
const withCompany = (over: Record<string, string>) => ({...valid, company: {...valid.company, ...over}});

test('onboarding: complete answers pass, the SIRET loses its spaces', () => {
    const parsed = onboardingSchema.parse(valid);
    assert.equal(parsed.company.siret, '73282932000074');
    assert.equal(parsed.tax.versementLiberatoire, false);
});

test('onboarding: the SIRET must have 14 digits and a valid checksum', () => {
    assert.equal(onboardingSchema.safeParse(withCompany({siret: '7328293200007'})).success, false);
    assert.equal(onboardingSchema.safeParse(withCompany({siret: '73282932000075'})).success, false);
    assert.equal(onboardingSchema.safeParse(withCompany({siret: '35600000000001'})).success, true);
});

test('onboarding: the bank details are required', () => {
    for (const field of ['iban', 'bank', 'accountHolder']) {
        assert.equal(onboardingSchema.safeParse(withCompany({[field]: ' '})).success, false, field);
    }
});
