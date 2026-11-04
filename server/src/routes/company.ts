import { Hono } from 'hono';
import type { Deps } from '../deps.ts';
import { parseJson } from '../lib/http.ts';
import { getSetting, putSetting } from '../lib/store.ts';
import { companySchema, type Company } from '../lib/types.ts';

const f = (id: string, group: string, label: string) => ({ id, group, label, value: '' });

export const DEFAULT_COMPANY: Company = {
  fields: [
    f('name', 'Identité', 'Nom / dénomination'),
    f('legal', 'Identité', 'Forme juridique'),
    f('siret', 'Identité', 'SIRET'),
    f('siren', 'Identité', 'SIREN'),
    f('ape', 'Identité', 'Code APE / NAF'),
    f('vat', 'Identité', 'N° TVA intracommunautaire'),
    f('vat-mention', 'Identité', 'Mention TVA'),
    f('address', 'Coordonnées', 'Adresse'),
    f('email', 'Coordonnées', 'E-mail'),
    f('phone', 'Coordonnées', 'Téléphone'),
    f('website', 'Coordonnées', 'Site web'),
    f('account-holder', 'Banque', 'Titulaire du compte'),
    f('iban', 'Banque', 'IBAN'),
    f('bic', 'Banque', 'BIC / SWIFT'),
    f('bank', 'Banque', 'Banque'),
  ],
};
DEFAULT_COMPANY.fields.find((x) => x.id === 'vat-mention')!.value = 'TVA non applicable, art. 293 B du CGI';

/** Champs ajoutés après coup : insérés dans les fiches existantes (avant le champ indiqué). */
const ADDED_FIELDS: { id: string; before: string }[] = [{ id: 'account-holder', before: 'iban' }];

export async function getCompany(deps: Deps): Promise<Company> {
  const company = await getSetting<Company>(deps, 'company', () => DEFAULT_COMPANY);
  const fields = [...company.fields];
  for (const { id, before } of ADDED_FIELDS) {
    if (fields.some((x) => x.id === id)) continue;
    const field = DEFAULT_COMPANY.fields.find((x) => x.id === id)!;
    const at = fields.findIndex((x) => x.id === before);
    fields.splice(at === -1 ? fields.length : at, 0, { ...field });
  }
  return { fields };
}

export const companyRoutes = (deps: Deps) =>
  new Hono()
    .get('/', async (c) => c.json(await getCompany(deps)))
    .put('/', async (c) => {
      const body = await parseJson(c, companySchema);
      await putSetting(deps, 'company', body);
      return c.json(body);
    });
