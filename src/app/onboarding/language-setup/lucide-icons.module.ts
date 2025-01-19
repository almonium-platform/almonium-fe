import {NgModule} from '@angular/core';
import {
  ChevronLeft,
  ChevronRight,
  CircleChevronLeft,
  Info,
  LucideAngularModule, Pencil,
  QrCode,
  StepBack
} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      CircleChevronLeft,
      ChevronLeft,
      ChevronRight,
      StepBack,
      Info,
      Pencil,
      QrCode,
    }),
  ],
  exports: [LucideAngularModule], // Export the configured module
})
export class LucideIconsModule {
}
