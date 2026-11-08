import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {type ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners} from '@angular/core';
import {registerLocaleData} from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import {provideRouter, TitleStrategy, withComponentInputBinding, withViewTransitions} from '@angular/router';
import {provideSpartanHlm} from '@spartan-ng/helm/utils';
import {provideEchartsCore} from 'ngx-echarts';
import {routes} from './app.routes';
import {authInterceptor} from './core/auth/auth.interceptor';
import {InvoomTitleStrategy} from './core/title.strategy';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
        {provide: TitleStrategy, useClass: InvoomTitleStrategy},
        provideHttpClient(withInterceptors([authInterceptor])),
        provideSpartanHlm(),
        provideEchartsCore({echarts: () => import('./core/echarts')}),
        {provide: LOCALE_ID, useValue: 'fr-FR'},
    ],
};
