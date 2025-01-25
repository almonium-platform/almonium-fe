import {NgModule} from '@angular/core';
import {LucideAngularModule, UserRoundPlus} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      UserRoundPlus,
    }),
  ],
  exports: [LucideAngularModule],
})
export class LucideSocialIconsModule {
}
