import {ParticlesService} from "../../services/particles.service";
import {Component} from "@angular/core";
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
  particlesOptions$: Observable<RecursivePartial<IOptions> | undefined>;

  constructor(
    protected particlesService: ParticlesService
  ) {
    this.particlesOptions$ = this.particlesService.particlesOptions$;
    this.particlesService.initializeParticles();
  }
}
