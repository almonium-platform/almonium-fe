import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PopupTemplateStateService {
  private drawerState = new Subject<{ visible: boolean; content?: any; outside?: boolean }>();
  drawerState$ = this.drawerState.asObservable();

  open(content: any, outside: boolean = false) {
    this.drawerState.next({visible: true, content, outside});
  }

  close() {
    this.drawerState.next({visible: false});
  }
}
