import {inject, Injectable} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {type RouterStateSnapshot, TitleStrategy} from '@angular/router';

/** Route titles hold the page name only; the tab title is always "<Page> · Invoom". */
@Injectable()
export class InvoomTitleStrategy extends TitleStrategy {
    private readonly title = inject(Title);

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const page = this.buildTitle(snapshot);
        this.title.setTitle(page ? `${page} · Invoom` : 'Invoom');
    }
}
