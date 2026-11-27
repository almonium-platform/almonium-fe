import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {PublicFooterComponent} from '../../shared/public-footer/public-footer.component';
import {PageSeoService} from '../../shared/seo/page-seo.service';

/**
 * /about (design C3): one column, no sell. Four headings set at reading size and the brand plate with its
 * etymology, which appears on the web only here. The only button on the page is the Sign in already in the bar.
 */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, PublicFooterComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.less',
})
export class AboutComponent implements OnInit, OnDestroy {
  private readonly seo = inject(PageSeoService);

  protected readonly contact = 'hello@almonium.com';
  protected readonly contactHref = `mailto:${this.contact}`;

  ngOnInit(): void {
    this.seo.describe({
      title: $localize`About · Almonium`,
      description: $localize`Almonium turns the books you read into the vocabulary you use. What it is, who built it, what it costs and how to get in touch.`,
      path: '/about',
    });
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }
}
