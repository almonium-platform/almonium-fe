import {NgModule} from '@angular/core';
import {
  Bell,
  Home,
  Infinity,
  Info,
  Link,
  LucideAngularModule,
  Menu,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RefreshCwOff,
  ScanLine,
  ScanQrCode,
  StarOff,
  UserCheck,
  UserRoundPlus,
  VenetianMask,
  X
} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      Bell,
      Home,
      Info,
      Infinity,
      Link,
      Menu,
      Pencil,
      Plus,
      QrCode,
      RefreshCw,
      RefreshCwOff,
      ScanLine,
      ScanQrCode, // needed?
      StarOff,
      UserCheck,
      UserRoundPlus,
      VenetianMask,
      X,
    }),
  ],
  exports: [LucideAngularModule],
})
export class SharedLucideIconsModule {
}
