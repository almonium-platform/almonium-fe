import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface DrawerState {
  visible: boolean;
  outside: boolean;
  content?: any;
  type?: string;
  closing: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PopupTemplateStateService {
  private drawerState = new BehaviorSubject<DrawerState>({
    visible: false,
    outside: false,
    content: undefined,
    type: undefined,
    closing: false,
  });

  drawerState$: Observable<DrawerState> = this.drawerState.asObservable();

  open(content: any, type: string, outside: boolean = false) {
    this.drawerState.next({
      visible: true,
      outside,
      content,
      type,
      closing: false,
    });
  }

  close() {
    const current = this.drawerState.value;
    this.drawerState.next({
      ...current,
      closing: true,
    });

    setTimeout(() => {
      console.log('closing for real');
      this.drawerState.next({
        ...current,
        visible: false,
        outside: false,
        content: undefined,
        closing: false,
      });
    }, 200);
  }
}
