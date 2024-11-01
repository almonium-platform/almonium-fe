import {Injectable} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UrlService {
  constructor(private router: Router, private route: ActivatedRoute) {
  }

  clearUrl() {
    const url = this.router.createUrlTree([], {relativeTo: this.route, queryParams: {}}).toString();
    this.router.navigateByUrl(url, {replaceUrl: true}).then(r => r);
  }
}
