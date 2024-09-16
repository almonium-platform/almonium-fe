import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {IParticlesProps, NgParticlesService} from '@tsparticles/angular';
import {loadFull} from 'tsparticles';
import {BehaviorSubject, Observable} from 'rxjs';
import {catchError, switchMap, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ParticlesService {
  private particlesOptionsSubject = new BehaviorSubject<IParticlesProps | undefined>(undefined);
  particlesOptions$: Observable<IParticlesProps | undefined> = this.particlesOptionsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private particlesService: NgParticlesService
  ) {
  }

  initializeParticles(): void {
    this.http.get<IParticlesProps>('/assets/particles-options.json').pipe(
      tap((options) => {
        this.particlesOptionsSubject.next(options);
      }),
      switchMap(() => this.particlesService.init(async (engine) => {
        await loadFull(engine);
        console.log('Particles engine loaded');
      })),
      catchError((error) => {
        console.error('Error during particles initialization:', error);
        throw error;
      })
    ).subscribe({
      next: () => {
        console.log('Particles initialized with loaded options');
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
