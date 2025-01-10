import {Injectable} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UrlService {
  constructor(private router: Router, private route: ActivatedRoute) {
  }

  clearUrl() {
    const clearedUrl = this.getClearedUrl();
    this.router.navigateByUrl(clearedUrl, {replaceUrl: true}).then();
  }

  getClearedUrl() {
    return this.router.createUrlTree([], {relativeTo: this.route, queryParams: {}}).toString();
  }
}
