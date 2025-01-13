import {Injectable} from '@angular/core';
import {Observable} from "rxjs";
import {AppConstants} from "../app.constants";
import {map} from "rxjs/operators";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class UtilsService {
  constructor(private http: HttpClient) {
  }

  getQrCodeUrl(text: string): Observable<string> {
    const url = `${AppConstants.UTILS_URL}/qr?text=${encodeURIComponent(text)}`;
    return this.http.get(url, {
      responseType: 'blob',
      withCredentials: true,
    }).pipe(
      map((blob) => {
        return URL.createObjectURL(blob);
      })
    );
  }

  areArraysEqual<T>(
    array1: T[],
    array2: T[],
    comparator: (item1: T, item2: T) => boolean
  ): boolean {
    if (array1.length !== array2.length) {
      return false;
    }

    const sortedArray1 = [...array1].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const sortedArray2 = [...array2].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return sortedArray1.every((item, index) => comparator(item, sortedArray2[index]));
  }
}
