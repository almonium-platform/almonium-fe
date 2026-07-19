import {ParticlesService} from "../../services/particles.service";
import { Component, inject } from "@angular/core";
import {AsyncPipe} from "@angular/common";
import {NgxParticlesModule} from "@tsparticles/angular";
import {IOptions, RecursivePartial} from "@tsparticles/engine";
import {Observable} from "rxjs";

@Component({
  selector: 'app-particles',
  template: `
    @if (particlesOptions$ | async; as particlesOptions) {
      <ngx-particles
        id="tsparticles"
        [options]="particlesOptions"
        (particlesLoaded)="particlesService.particlesLoaded($event)"
      ></ngx-particles>
    }
  `,
  imports: [
    AsyncPipe,
    NgxParticlesModule
  ]
})
export class ParticlesComponent {
  protected particlesService = inject(ParticlesService);

  particlesOptions$: Observable<RecursivePartial<IOptions> | undefined>;

  constructor() {
    this.particlesOptions$ = this.particlesService.particlesOptions$;
    this.particlesService.initializeParticles();
  }
}
