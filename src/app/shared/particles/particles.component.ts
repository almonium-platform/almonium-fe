import {ParticlesService} from "../../services/particles.service";
import {Component} from "@angular/core";
import {AsyncPipe, NgIf} from "@angular/common";
import {NgxParticlesModule} from "@tsparticles/angular";
import {IOptions, RecursivePartial} from "@tsparticles/engine";
import {Observable} from "rxjs";

@Component({
  selector: 'app-particles',
  template: `
    <ngx-particles
      *ngIf="particlesOptions$ | async as particlesOptions"
      id="tsparticles"
      [options]="particlesOptions"
      (particlesLoaded)="particlesService.particlesLoaded($event)"
    ></ngx-particles>
  `,
  imports: [
    AsyncPipe,
    NgIf,
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
