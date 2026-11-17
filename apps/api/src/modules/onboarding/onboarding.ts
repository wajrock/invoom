import type {Deps} from '../../core/deps.ts';
import {getCompany} from '../company/company.store.ts';
import {defaultPeriod, type TaxSettings} from '../fiscal/index.ts';
import {putSetting} from '../settings/settings.store.ts';
import type {OnboardingInput} from './onboarding.schema.ts';

/** "12345678900012" → "123 456 789 00012", as printed on invoices */
const formatSiret = (s: string) => `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}`;

/**
 * Saves the first-run answers into the workspace: company details (keeping any field already there) and the tax
 * settings for the activity, with its standard rates. Runs in the workspace scope.
 */
export async function applyOnboarding(deps: Deps, {company, tax}: OnboardingInput) {
    const siret = formatSiret(company.siret);
    const values: Record<string, string> = {
        name: company.name,
        legal: company.legal,
        siret,
        siren: siret.slice(0, 11),
        address: company.address,
        email: company.email,
        phone: company.phone,
        iban: company.iban.toUpperCase(),
        bic: company.bic.toUpperCase(),
        bank: company.bank,
        'account-holder': company.accountHolder,
    };
    const current = await getCompany(deps);
    await putSetting(deps, 'company', {
        fields: current.fields.map((f) => (values[f.id] ? {...f, value: values[f.id]} : f)),
    });

    const settings: TaxSettings = {
        activity: tax.activity,
        activityStart: tax.activityStart,
        cfeExemptFirstYear: true,
        periods: [{...defaultPeriod(tax.activity, tax.activityStart), versementLiberatoire: tax.versementLiberatoire}],
        // No deadline by default: the user turns them on in the tax settings
        autoDeadlines: false,
    };
    await putSetting(deps, 'tax', settings);
}
