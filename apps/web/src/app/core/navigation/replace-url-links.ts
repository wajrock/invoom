import {Directive, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NavigationService} from './navigation.service';

/**
 * On a routerLink: in the installed app, the link replaces the current history entry instead of adding one
 * (see NavigationService). In the browser it is left as a normal link.
 */
@Directive({selector: '[appReplaceUrl]'})
export class ReplaceUrlLinks {
    constructor() {
        if (inject(NavigationService).installed) inject(RouterLink).replaceUrl = true;
    }
}
