import {inject} from '@angular/core';
import {type CanActivateFn, Router} from '@angular/router';
import {Auth} from './auth.service';

// inject() must run before the first await (synchronous injection context).

export const authGuard: CanActivateFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    return (await auth.check()) || router.parseUrl('/login');
};

export const guestGuard: CanActivateFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    return !(await auth.check()) || router.parseUrl('/');
};
