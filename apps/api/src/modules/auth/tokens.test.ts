import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode} from './tokens.ts';

test('recovery codes are unique and formatted XXXX-XXXX-XXXX-XXXX', () => {
    const codes = generateRecoveryCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    for (const c of codes) assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
});

test('input tolerates dashes, spaces, lower case and O/0, I/L/1 confusions', () => {
    assert.equal(normalizeRecoveryCode(' ab1o-0il2 '), 'AB10011' + '2');
    assert.equal(hashRecoveryCode('ABCD-EFGH-1JKM-0NPQ'), hashRecoveryCode('abcd efgh ijkm onpq'));
    assert.notEqual(hashRecoveryCode('ABCD-EFGH-1JKM-0NPQ'), hashRecoveryCode('ABCD-EFGH-1JKM-0NPR'));
});
