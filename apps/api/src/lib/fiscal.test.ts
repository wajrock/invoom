import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    computeCharges,
    computeYear,
    defaultPeriod,
    defaultTaxSettings,
    generateDeadlines,
    nextBusinessDay,
    normalizeTaxSettings,
    periodAt,
    type RatePeriod,
    type TaxSettings,
} from './fiscal.ts';

/** Paramètres de test : une seule période (BNC, 2026), personnalisable. */
const base = (over: Partial<TaxSettings> = {}, period: Partial<RatePeriod> = {}): TaxSettings => ({
    ...defaultTaxSettings(new Date('2026-01-01')),
    activityStart: '2025-03-10',
    periods: [{...defaultPeriod('bnc', '2025-03-10'), ...period}],
    ...over,
});

test('cotisations sans ACRE ni VL', () => {
    const c = computeCharges([{amount: 10_000_00, paidOn: '2026-02-01'}], base());
    assert.equal(c.social, 2_610_00);
    assert.equal(c.vl, 0);
    assert.equal(c.urssaf, 2_610_00);
});

test('le taux saisi est appliqué tel quel, VL en plus', () => {
    const c = computeCharges(
        [{amount: 1_000_00, paidOn: '2026-02-01'}],
        base({}, {rates: {social: 0.1305, vl: 0.022}, versementLiberatoire: true}),
    );
    assert.equal(c.social, 130_50);
    assert.equal(c.vl, 22_00);
    assert.equal(c.urssaf, 152_50);
});

test('estimation annuelle : impôt hors VL et CFE exonérée la 1re année', () => {
    const s = base({}, {cfeAmount: 300_00});
    const items = [{amount: 30_000_00, paidOn: '2025-05-01'}];
    const y2025 = computeYear(2025, items, s);
    assert.equal(y2025.cfeExempt, true);
    assert.equal(y2025.incomeTaxEstimate, Math.round(30_000_00 * 0.66 * 0.11));
    const y2026 = computeYear(2026, items, s);
    assert.equal(y2026.cfe, 300_00);
});

test('échéances trimestrielles et CFE', () => {
    // Début le 10/03/2025 : 90e jour le 08/06 (T2) → 1re déclaration jusqu'au 30/09, à faire avant le 31/10
    const d = generateDeadlines([2025], [{amount: 1_000_00, paidOn: '2025-04-15'}], base());
    const keys = d.map((x) => x.autoKey);
    assert.ok(!keys.includes('cfe:2025'));
    assert.ok(keys.includes('cfe-decl:2025'));
    assert.ok(!keys.includes('urssaf:2025-Q1') && !keys.includes('urssaf:2025-Q2'));
    const first = d.find((x) => x.autoKey === 'urssaf:2025-Q3');
    assert.equal(first?.dueOn, '2025-10-31');
    assert.equal(first?.periodStart, '2025-03-10');
    assert.equal(first?.amount, 261_00);
    assert.match(first?.title ?? '', /Première déclaration/);
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2025-Q4')?.dueOn, '2026-02-02'); // 31/01 = samedi
});

test('début au 1er octobre 2026 : 1re déclaration couvrant oct. 2026 → mars 2027', () => {
    const s = base({activityStart: '2026-10-01'}, {from: '2026-10-01'});
    const items = [
        {amount: 2_000_00, paidOn: '2026-11-10'},
        {amount: 3_000_00, paidOn: '2027-02-10'},
    ];
    const d = generateDeadlines([2026, 2027], items, s);
    const urssaf = d.filter((x) => x.kind === 'urssaf');
    assert.equal(urssaf[0].autoKey, 'urssaf:2027-Q1');
    assert.equal(urssaf[0].dueOn, '2027-04-30');
    assert.equal(urssaf[0].periodStart, '2026-10-01');
    assert.equal(urssaf[0].periodEnd, '2027-03-31');
    assert.equal(urssaf[0].amount, Math.round(5_000_00 * 0.261));
    assert.ok(!d.some((x) => x.autoKey === 'urssaf:2026-Q4'));
    // CFE : déclaration initiale fin 2026, exonération en 2026, paiement dès 2027
    assert.ok(d.some((x) => x.autoKey === 'cfe-decl:2026' && x.dueOn === '2026-12-31'));
    assert.ok(!d.some((x) => x.autoKey === 'cfe:2026'));
    assert.ok(d.some((x) => x.autoKey === 'cfe:2027'));
    // Déclaration de revenus 2027 pour le CA 2026
    assert.ok(d.some((x) => x.autoKey === 'ir:2027' && x.dueOn === '2027-05-31'));
});

test('échéances mensuelles', () => {
    const d = generateDeadlines([2026], [], base({}, {declarationFrequency: 'monthly'}));
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2026-12')?.dueOn, '2027-02-01'); // 31/01/2027 = dimanche
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2026-01')?.dueOn, '2026-03-02'); // 28/02/2026 = samedi
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2026-03')?.dueOn, '2026-04-30');
});

test('report au jour ouvré suivant (week-end et jours fériés)', () => {
    assert.equal(nextBusinessDay('2027-02-26'), '2027-02-26'); // vendredi
    assert.equal(nextBusinessDay('2027-02-28'), '2027-03-01'); // dimanche
    assert.equal(nextBusinessDay('2027-10-31'), '2027-11-02'); // dimanche puis Toussaint
    assert.equal(nextBusinessDay('2027-03-29'), '2027-03-30'); // lundi de Pâques 2027
    assert.equal(nextBusinessDay('2026-05-14'), '2026-05-15'); // Ascension 2026
});

test('calendrier URSSAF réel : début au 1er octobre 2026, déclaration mensuelle', () => {
    const s = base({activityStart: '2026-10-01'}, {from: '2026-10-01', declarationFrequency: 'monthly'});
    const d = generateDeadlines([2026, 2027], [], s).filter((x) => x.kind === 'urssaf');
    // Exigibilités relevées sur autoentrepreneur.urssaf.fr
    const expected: [string, string, string][] = [
        ['urssaf:2027-01', '2026-10-01', '2027-03-01'], // octobre 2026 → janvier 2027 regroupés
        ['urssaf:2027-02', '2027-02-01', '2027-03-31'],
        ['urssaf:2027-03', '2027-03-01', '2027-04-30'],
        ['urssaf:2027-04', '2027-04-01', '2027-05-31'],
        ['urssaf:2027-05', '2027-05-01', '2027-06-30'],
        ['urssaf:2027-06', '2027-06-01', '2027-08-02'],
        ['urssaf:2027-07', '2027-07-01', '2027-08-31'],
        ['urssaf:2027-08', '2027-08-01', '2027-09-30'],
        ['urssaf:2027-09', '2027-09-01', '2027-11-02'],
    ];
    assert.deepEqual(
        d.slice(0, expected.length).map((x) => [x.autoKey, x.periodStart, x.dueOn]),
        expected,
    );
});

// ---------------------------------------------------------------------------
// Historique des taux
// ---------------------------------------------------------------------------

const withChange = (change: Partial<RatePeriod>, from = '2026-07-01'): TaxSettings => {
    const s = base();
    return {...s, periods: [...s.periods, {...s.periods[0], ...change, from}]};
};

test('période en vigueur : la première couvre aussi tout ce qui précède', () => {
    const s = withChange({rates: {social: 0.3, vl: 0.022}});
    assert.equal(periodAt(s, '2020-01-01').rates.social, 0.261);
    assert.equal(periodAt(s, '2026-06-30').rates.social, 0.261);
    assert.equal(periodAt(s, '2026-07-01').rates.social, 0.3);
});

test('un nouveau taux ne modifie pas les encaissements antérieurs', () => {
    const items = [
        {amount: 1_000_00, paidOn: '2026-03-01'},
        {amount: 1_000_00, paidOn: '2026-09-01'},
    ];
    const before = computeCharges(items.slice(0, 1), base());
    const s = withChange({rates: {social: 0.3, vl: 0.022}});
    // L'encaissement de mars garde son ancien montant
    assert.deepEqual(computeCharges(items.slice(0, 1), s), before);
    // Changement en cours d'année : chaque encaissement a son taux
    assert.equal(computeCharges(items, s).social, 261_00 + 300_00);
});

test('versement libératoire activé en cours d’année : impôt estimé seulement sur la part hors VL', () => {
    const s = withChange({versementLiberatoire: true});
    const items = [
        {amount: 10_000_00, paidOn: '2026-03-01'},
        {amount: 10_000_00, paidOn: '2026-09-01'},
    ];
    const y = computeYear(2026, items, s);
    assert.equal(y.caUnderVl, 10_000_00);
    assert.equal(y.vl, 220_00);
    assert.equal(y.incomeTaxEstimate, Math.round(10_000_00 * 0.66 * 0.11));
    const ir = generateDeadlines([2027], items, s).find((d) => d.autoKey === 'ir:2027');
    assert.equal(ir?.amount, y.incomeTaxEstimate);
    assert.match(ir?.note ?? '', /sous versement libératoire/);
});

test('paramètres annuels (CFE, seuils) : ceux en vigueur au 31 décembre', () => {
    const s = base({}, {cfeAmount: 300_00});
    s.periods.push({...s.periods[0], from: '2026-11-01', cfeAmount: 500_00, tvaThreshold: 25_000_00});
    assert.equal(computeYear(2025, [], s).cfe, 0); // exonérée l'année de création
    assert.equal(computeYear(2026, [], s).cfe, 500_00); // changement au 1er nov. : vaut pour 2026
    assert.equal(computeYear(2026, [], {...s, periods: s.periods.slice(0, 1)}).cfe, 300_00);
});

test('migration de l’ancien format sans périodes', () => {
    const legacy = {
        activity: 'bnc',
        activityStart: '2025-03-10',
        declarationFrequency: 'monthly',
        versementLiberatoire: true,
        acre: true,
        acreReduction: 0.5, // champs ACRE de l'ancien format : ignorés
        rates: {social: 0.256, cfp: 0.002, vl: 0.022, chamber: 0},
        incomeTaxRate: 0.3,
        cfeAmount: 200_00,
        cfeExemptFirstYear: true,
        caCeiling: 77_700_00,
        tvaThreshold: 37_500_00,
    };
    const s = normalizeTaxSettings(legacy as never);
    assert.equal(s.periods.length, 1);
    assert.equal(s.periods[0].from, '2025-03-10');
    assert.deepEqual(s.periods[0].rates, {social: 0.256, vl: 0.022}); // CFP et chambre retirées
    assert.equal(s.periods[0].declarationFrequency, 'monthly');
    assert.ok(!('acre' in s) && !('acreReduction' in s.periods[0]));
});
