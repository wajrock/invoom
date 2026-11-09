import {computed} from '@angular/core';
import {reactiveForm} from './reactive-form';

describe('reactiveForm', () => {
    it('behaves like a plain object', () => {
        const form = reactiveForm({name: 'a', count: 1});
        form.name = 'b';
        Object.assign(form, {count: 2});
        expect({...form}).toEqual({name: 'b', count: 2});
    });

    it('notifies readers when a field changes', () => {
        const form = reactiveForm({currency: 'EUR'});
        const label = computed(() => `in ${form.currency}`);
        expect(label()).toBe('in EUR');
        form.currency = 'USD';
        expect(label()).toBe('in USD');
    });
});
