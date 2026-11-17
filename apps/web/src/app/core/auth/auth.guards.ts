import {inject} from '@angular/core';
import {type CanActivateFn, Router} from '@angular/router';
import {Auth} from './auth.service';

// inject() must run before the first await (synchronous injection context).

/** Signed in and set up; a new workspace goes through the first-run setup first */
export const authGuard: CanActivateFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    if (!(await auth.check())) return router.parseUrl('/login');
    return auth.onboarded() || router.parseUrl('/bienvenue');
};

/** The first-run setup: only for a signed-in workspace that has not done it yet */
export const onboardingGuard: CanActivateFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    if (!(await auth.check())) return router.parseUrl('/login');
    return !auth.onboarded() || router.parseUrl('/');
};

export const guestGuard: CanActivateFn = async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    return !(await auth.check()) || router.parseUrl('/');
};

/** Signed in, or off to the login page, which brings the user back here afterwards */
export const authReturnGuard: CanActivateFn = async (_route, state) => {
    const auth = inject(Auth);
    const router = inject(Router);
    return (await auth.check()) || router.createUrlTree(['/login'], {queryParams: {next: state.url}});
};
