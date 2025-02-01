import {NgModule} from '@angular/core';
import {
  Bell,
  Home,
  Infinity,
  Info,
  LucideAngularModule,
  Menu,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RefreshCwOff,
  StarOff,
  UserCheck,
  VenetianMask
} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      Bell,
      VenetianMask,
      Home,
      Menu,
      UserCheck,
      StarOff,
      Pencil,
      Plus,
      RefreshCw,
      Infinity,
      RefreshCwOff,
      Info,
      QrCode,
    }),
  ],
  exports: [LucideAngularModule],
})
export class SharedLucideIconsModule {
}
