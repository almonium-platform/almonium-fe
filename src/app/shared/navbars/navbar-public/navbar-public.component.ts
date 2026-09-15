import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import {NgClass} from "@angular/common";
import {RouterLink} from "@angular/router";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {LucideAngularModule} from "lucide-angular";

@Component({
  selector: 'app-public-navbar',
  templateUrl: './navbar-public.component.html',
  styleUrls: ['./navbar-public.component.less'],
  imports: [
    NgClass,
    NgClickOutsideDirective,
    RouterLink,
    LucideAngularModule
  ]
})
export class NavbarPublicComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() currentRoute = '';
  protected isDiscoverMenuOpen = false;
  isMobile = false;
  private readonly resizeListener = () => this.checkDeviceType();

  ngOnInit(): void {
    this.checkDeviceType();
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
  }

  private checkDeviceType(): void {
    this.isMobile = window.innerWidth <= 690;
    this.cdr.detectChanges();
  }

  toggleDiscoverMenu(): void {
    this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
  }

  discoverOnClickOutside() {
    this.isDiscoverMenuOpen = false;
  }
}
