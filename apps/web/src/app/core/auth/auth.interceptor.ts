import {HttpErrorResponse, type HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {NavigationService} from '../navigation/navigation.service';
import {catchError, throwError} from 'rxjs';
import {Auth} from './auth.service';

/** Expired session: back to the login screen. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(Auth);
    const nav = inject(NavigationService);
    return next(req).pipe(
        catchError((err: unknown) => {
            if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/api/auth/')) {
                auth.authenticated.set(false);
                void nav.navigateByUrl('/login');
            }
            return throwError(() => err);
        }),
    );
};
