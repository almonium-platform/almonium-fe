import { Injectable, inject } from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UrlService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);


  clearUrl() {
    const clearedUrl = this.getClearedUrl();
    void this.router.navigateByUrl(clearedUrl, {replaceUrl: true}).then();
  }

  getClearedUrl() {
    return this.router.createUrlTree([], {relativeTo: this.route, queryParams: {}}).toString();
  }
}
