import assert from 'node:assert/strict';
import {test} from 'node:test';
import {VAT_MENTIONS, vatRegime, withVatMention} from '../invoices/vat-mention.ts';
import {isAllowedRedirectUri, pkceChallenge} from './oauth.store.ts';

test('agent redirect addresses: HTTPS, or HTTP on the local machine only', () => {
    assert.ok(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'));
    assert.ok(isAllowedRedirectUri('http://localhost:33418/callback'));
    assert.ok(isAllowedRedirectUri('http://127.0.0.1:6274/oauth/callback'));
    assert.ok(!isAllowedRedirectUri('http://evil.example/callback'));
    assert.ok(!isAllowedRedirectUri('https://claude.ai/callback#fragment'));
    assert.ok(!isAllowedRedirectUri('javascript:alert(1)'));
    assert.ok(!isAllowedRedirectUri('not a url'));
});

test('PKCE S256 challenge (RFC 7636, appendix B)', () => {
    assert.equal(
        pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
});

test('invoices created by an agent carry the VAT mention of the client', () => {
    assert.equal(vatRegime({countryCode: 'FR', vatNumber: ''}), 'franchise');
    assert.equal(vatRegime({countryCode: 'IT', vatNumber: 'IT01234567890'}), 'reverse');
    assert.equal(vatRegime({countryCode: 'OTHER', vatNumber: ''}), 'outside');
    const terms = 'Prestation de services.\nTVA non applicable, art. 293 B du CGI.\nPaiement par virement.';
    const reverse = withVatMention(terms, VAT_MENTIONS.reverse.fr);
    assert.equal(reverse.split('\n')[1], VAT_MENTIONS.reverse.fr);
    assert.ok(!reverse.includes('293 B'));
});
