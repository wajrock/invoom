import type {Deps} from '../../core/deps.ts';
import {getSetting} from '../settings/settings.store.ts';
import {DEFAULT_INVOICE_SETTINGS} from './invoice.ts';
import type {InvoiceSettings} from './invoice.schema.ts';

export const getInvoiceSettings = (deps: Deps): Promise<InvoiceSettings> =>
    getSetting<InvoiceSettings>(deps, 'invoice', () => DEFAULT_INVOICE_SETTINGS);
