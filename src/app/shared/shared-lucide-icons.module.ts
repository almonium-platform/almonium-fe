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
      X,
      UserRoundPlus,
      ScanLine,
      ScanQrCode, // needed?
      Link,
    }),
  ],
  exports: [LucideAngularModule],
})
export class SharedLucideIconsModule {
}
