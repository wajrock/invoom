import {HttpErrorResponse, type HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, throwError} from 'rxjs';
import {Auth} from './auth.service';

/** Expired session: back to the login screen. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(Auth);
    const router = inject(Router);
    return next(req).pipe(
        catchError((err: unknown) => {
            if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/api/auth/')) {
                auth.authenticated.set(false);
                void router.navigateByUrl('/login');
            }
            return throwError(() => err);
        }),
    );
};
