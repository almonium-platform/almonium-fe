import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IParticlesProps, NgParticlesService } from '@tsparticles/angular';
import { loadFull } from 'tsparticles';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ParticlesService {
  private particlesOptionsSubject = new BehaviorSubject<IParticlesProps | undefined>(undefined);
  particlesOptions$: Observable<IParticlesProps | undefined> = this.particlesOptionsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private particlesService: NgParticlesService
  ) {}

  initParticles(): void {
    this.particlesService.init(async (engine) => {
      await loadFull(engine);
      console.log('Particles initialized');
    });
  }

  loadParticlesOptions(): void {
    this.http.get<IParticlesProps>('/assets/particles-options.json').subscribe({
      next: (options) => {
        this.particlesOptionsSubject.next(options);
      },
      error: (error) => {
        console.error('Error loading particles options:', error);
      },
    });
  }

  particlesLoaded(container: any): void {
    console.log('Particles loaded');
  }
}
