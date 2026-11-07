import {HttpClient, type HttpParams} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

type Params = HttpParams | Record<string, string | number | boolean>;

/** Promise-based wrapper around HttpClient shared by the feature data-access services. */
@Injectable({providedIn: 'root'})
export class ApiClient {
    readonly http = inject(HttpClient);

    get<T>(url: string, params?: Params): Promise<T> {
        return firstValueFrom(this.http.get<T>(url, {params}));
    }

    post<T>(url: string, body: unknown, params?: Params): Promise<T> {
        return firstValueFrom(this.http.post<T>(url, body, {params}));
    }

    put<T>(url: string, body: unknown): Promise<T> {
        return firstValueFrom(this.http.put<T>(url, body));
    }

    delete<T = void>(url: string): Promise<T> {
        return firstValueFrom(this.http.delete<T>(url));
    }
}
