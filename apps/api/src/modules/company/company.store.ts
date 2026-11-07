import type {Deps} from '../../core/deps.ts';
import {getSetting} from '../settings/settings.store.ts';
import {ADDED_FIELDS, DEFAULT_COMPANY} from './company.defaults.ts';
import type {Company} from './company.schema.ts';

export async function getCompany(deps: Deps): Promise<Company> {
    const company = await getSetting<Company>(deps, 'company', () => DEFAULT_COMPANY);
    const fields = [...company.fields];
    for (const {id, before} of ADDED_FIELDS) {
        if (fields.some((x) => x.id === id)) continue;
        const field = DEFAULT_COMPANY.fields.find((x) => x.id === id)!;
        const at = fields.findIndex((x) => x.id === before);
        fields.splice(at === -1 ? fields.length : at, 0, {...field});
    }
    return {fields};
}
