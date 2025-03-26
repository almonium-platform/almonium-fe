import {ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass} from "@angular/common";
import {Router, RouterLink} from "@angular/router";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {ButtonComponent} from "../../button/button.component";
import {LucideAngularModule} from "lucide-angular";

@Component({
  selector: 'app-public-navbar',
  templateUrl: './navbar-public.component.html',
  styleUrls: ['./navbar-public.component.less'],
  imports: [
    FormsModule,
    NgClass,
    NgClickOutsideDirective,
    RouterLink,
    ButtonComponent,
    LucideAngularModule
  ]
})
export class NavbarPublicComponent implements OnInit, OnDestroy {
  @Input() currentRoute: string = '';
  protected isDiscoverMenuOpen: boolean = false;
  isMobile: boolean = false;

  constructor(private router: Router,
              private cdr: ChangeDetectorRef,
  ) {
  }

  ngOnInit(): void {
    this.checkDeviceType();
    window.addEventListener('resize', this.checkDeviceType.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.checkDeviceType.bind(this));
  }

  private checkDeviceType(): void {
    this.isMobile = window.innerWidth <= 690;
    this.cdr.detectChanges();
  }

  toggleDiscoverMenu(): void {
    if (this.isMobile) {
      this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
    } else {
      this.navigateToRoot();
    }
  }

  navigateToRoot() {
    this.router.navigate(['/']).then();
  }

  discoverOnClickOutside(_: Event) {
    this.isDiscoverMenuOpen = false;
  }
}
