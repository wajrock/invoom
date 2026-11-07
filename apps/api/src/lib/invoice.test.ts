import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invoiceFileName, invoiceTotals, nextInvoiceNumber } from './invoice.ts';

test('nextInvoiceNumber continue la séquence de l’année', () => {
  assert.equal(nextInvoiceNumber([], 2026), '2026-001');
  assert.equal(nextInvoiceNumber(['2026-001', '#2026-007', '2025-012', 'ABC'], 2026), '2026-008');
  assert.equal(nextInvoiceNumber(['2025-012'], 2025), '2025-013');
});

test('invoiceTotals arrondit chaque ligne au centime', () => {
  const t = invoiceTotals({
    vatRate: 0.2,
    lines: [
      { quantity: 2, unitPrice: 62500 },
      { quantity: 1.5, unitPrice: 333 },
    ] as never,
  });
  assert.deepEqual(t, { ht: 125500, vat: 25100, ttc: 150600 });
});

test('invoiceFileName produit un nom sûr', () => {
  assert.equal(invoiceFileName('#2026/001', 'fr'), 'Facture-2026-001.pdf');
  assert.equal(invoiceFileName('2026-001', 'en'), 'Invoice-2026-001.pdf');
});
