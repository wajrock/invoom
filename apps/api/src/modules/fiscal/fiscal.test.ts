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
    simulateFromGross,
    simulateFromNet,
    type TaxSettings,
} from './index.ts';

/** Test settings: a single period (BNC, 2026), overridable. */
const base = (over: Partial<TaxSettings> = {}, period: Partial<RatePeriod> = {}): TaxSettings => ({
    ...defaultTaxSettings(new Date('2026-01-01')),
    activityStart: '2025-03-10',
    periods: [{...defaultPeriod('bnc', '2025-03-10'), ...period}],
    ...over,
});

test('contributions without ACRE or VL', () => {
    const c = computeCharges([{amount: 10_000_00, paidOn: '2026-02-01'}], base());
    assert.equal(c.social, 2_560_00);
    assert.equal(c.vl, 0);
    assert.equal(c.urssaf, 2_560_00);
});

test('the entered rate is applied as is, VL on top', () => {
    const c = computeCharges(
        [{amount: 1_000_00, paidOn: '2026-02-01'}],
        base({}, {rates: {social: 0.1305, vl: 0.022}, versementLiberatoire: true}),
    );
    assert.equal(c.social, 130_50);
    assert.equal(c.vl, 22_00);
    assert.equal(c.urssaf, 152_50);
});

test('yearly estimate: tax outside VL and no CFE in the first year', () => {
    const s = base({}, {cfeAmount: 300_00});
    const items = [{amount: 30_000_00, paidOn: '2025-05-01'}];
    const y2025 = computeYear(2025, items, s);
    assert.equal(y2025.cfeExempt, true);
    assert.equal(y2025.incomeTaxEstimate, Math.round(30_000_00 * 0.66 * 0.11));
    const y2026 = computeYear(2026, items, s);
    assert.equal(y2026.cfe, 300_00);
});

test('quarterly deadlines and CFE', () => {
    // Start on 2025-03-10: day 90 is 06-08 (Q2) → first declaration covers until 09-30, due by 10-31
    const d = generateDeadlines([2025], [{amount: 1_000_00, paidOn: '2025-04-15'}], base());
    const keys = d.map((x) => x.autoKey);
    assert.ok(!keys.includes('cfe:2025'));
    assert.ok(keys.includes('cfe-decl:2025'));
    assert.ok(!keys.includes('urssaf:2025-Q1') && !keys.includes('urssaf:2025-Q2'));
    const first = d.find((x) => x.autoKey === 'urssaf:2025-Q3');
    assert.equal(first?.dueOn, '2025-10-31');
    assert.equal(first?.periodStart, '2025-03-10');
    assert.equal(first?.amount, 256_00);
    assert.match(first?.title ?? '', /Première déclaration/);
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2025-Q4')?.dueOn, '2026-02-02'); // 31/01 = samedi
});

test('start on 2026-10-01: first declaration covers Oct 2026 → Mar 2027', () => {
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
    assert.equal(urssaf[0].amount, Math.round(5_000_00 * 0.256));
    assert.ok(!d.some((x) => x.autoKey === 'urssaf:2026-Q4'));
    // CFE: initial declaration end of 2026, exempt in 2026, paid from 2027
    assert.ok(d.some((x) => x.autoKey === 'cfe-decl:2026' && x.dueOn === '2026-12-31'));
    assert.ok(!d.some((x) => x.autoKey === 'cfe:2026'));
    assert.ok(d.some((x) => x.autoKey === 'cfe:2027'));
    // 2027 income tax return for 2026 revenue
    assert.ok(d.some((x) => x.autoKey === 'ir:2027' && x.dueOn === '2027-05-31'));
});

test('monthly deadlines', () => {
    const d = generateDeadlines([2026], [], base({}, {declarationFrequency: 'monthly'}));
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2026-12')?.dueOn, '2027-02-01'); // 31/01/2027 = dimanche
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2026-01')?.dueOn, '2026-03-02'); // 28/02/2026 = samedi
    assert.equal(d.find((x) => x.autoKey === 'urssaf:2026-03')?.dueOn, '2026-04-30');
});

test('moves to the next business day (weekends and holidays)', () => {
    assert.equal(nextBusinessDay('2027-02-26'), '2027-02-26'); // vendredi
    assert.equal(nextBusinessDay('2027-02-28'), '2027-03-01'); // dimanche
    assert.equal(nextBusinessDay('2027-10-31'), '2027-11-02'); // dimanche puis Toussaint
    assert.equal(nextBusinessDay('2027-03-29'), '2027-03-30'); // lundi de Pâques 2027
    assert.equal(nextBusinessDay('2026-05-14'), '2026-05-15'); // Ascension 2026
});

test('actual URSSAF calendar: start on 2026-10-01, monthly declarations', () => {
    const s = base({activityStart: '2026-10-01'}, {from: '2026-10-01', declarationFrequency: 'monthly'});
    const d = generateDeadlines([2026, 2027], [], s).filter((x) => x.kind === 'urssaf');
    // Due dates taken from autoentrepreneur.urssaf.fr
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

test('period in force: the first one also covers everything before it', () => {
    const s = withChange({rates: {social: 0.3, vl: 0.022}});
    assert.equal(periodAt(s, '2020-01-01').rates.social, 0.256);
    assert.equal(periodAt(s, '2026-06-30').rates.social, 0.256);
    assert.equal(periodAt(s, '2026-07-01').rates.social, 0.3);
});

test('a new rate does not change earlier payments', () => {
    const items = [
        {amount: 1_000_00, paidOn: '2026-03-01'},
        {amount: 1_000_00, paidOn: '2026-09-01'},
    ];
    const before = computeCharges(items.slice(0, 1), base());
    const s = withChange({rates: {social: 0.3, vl: 0.022}});
    // L'encaissement de mars garde son ancien montant
    assert.deepEqual(computeCharges(items.slice(0, 1), s), before);
    // Rate change mid-year: each payment keeps its own rate
    assert.equal(computeCharges(items, s).social, 256_00 + 300_00);
});

test('VL enabled mid-year: tax is estimated only on revenue outside VL', () => {
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

test('yearly settings (CFE, thresholds) are those in force on December 31', () => {
    const s = base({}, {cfeAmount: 300_00});
    s.periods.push({...s.periods[0], from: '2026-11-01', cfeAmount: 500_00, tvaThreshold: 25_000_00});
    assert.equal(computeYear(2025, [], s).cfe, 0); // exonérée l'année de création
    assert.equal(computeYear(2026, [], s).cfe, 500_00); // changement au 1er nov. : vaut pour 2026
    assert.equal(computeYear(2026, [], {...s, periods: s.periods.slice(0, 1)}).cfe, 300_00);
});

test('migrates the legacy format without periods', () => {
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

test('simulation from the invoiced amount, without VL', () => {
    // BNC: 25.6 % contributions, income tax 11 % on 66 % of revenue (7.26 %)
    const sim = simulateFromGross(1_000_00, base(), '2026-03-01');
    assert.equal(sim.social, 256_00);
    assert.equal(sim.vl, 0);
    assert.equal(sim.incomeTax, 72_60);
    assert.equal(sim.net, 671_40);
});

test('simulation with the VL scheme replaces the income tax estimate', () => {
    const sim = simulateFromGross(1_000_00, base({}, {versementLiberatoire: true}), '2026-03-01');
    assert.equal(sim.vl, 22_00);
    assert.equal(sim.incomeTax, 0);
    assert.equal(sim.net, 722_00);
});

test('simulation from a target net finds the smallest amount to invoice', () => {
    const s = base();
    for (const target of [1, 99, 1_000_00, 3_333_33, 12_345_67]) {
        const sim = simulateFromNet(target, s, '2026-03-01');
        assert.ok(sim.net >= target, `net ${sim.net} >= ${target}`);
        assert.ok(simulateFromGross(sim.gross - 1, s, '2026-03-01').net < target);
    }
});

test('simulation uses the rates in force on the given date', () => {
    const s = base({}, {});
    s.periods.push({...defaultPeriod('bnc', '2026-07-01'), rates: {social: 0.2, vl: 0.022}});
    assert.equal(simulateFromGross(1_000_00, s, '2026-06-30').social, 256_00);
    assert.equal(simulateFromGross(1_000_00, s, '2026-07-01').social, 200_00);
});
