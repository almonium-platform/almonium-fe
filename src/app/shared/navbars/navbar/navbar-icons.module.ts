import {NgModule} from '@angular/core';
import {
  BadgeDollarSign,
  Bell,
  Dices,
  Home,
  Info,
  LucideAngularModule,
  Star,
  Telescope,
  Timer,
  Settings,
  LogOut,
  Users
} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      Users,
      Bell,
      Home,
      Info,
      Telescope,
      Star,
      Dices,
      BadgeDollarSign,
      Timer,
      Settings,
      LogOut,
    }),
  ],
  exports: [LucideAngularModule],
})
export class NavbarLucideIconsModule {
}
