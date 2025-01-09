import {Injectable} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {
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
