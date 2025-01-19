import {NgModule} from '@angular/core';
import {ChevronLeft, ChevronRight, CircleChevronLeft, Info, LucideAngularModule, StepBack} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      CircleChevronLeft,
      ChevronLeft,
      ChevronRight,
      StepBack,
      Info,
    }),
  ],
  exports: [LucideAngularModule], // Export the configured module
})
export class LucideIconsModule {
}
