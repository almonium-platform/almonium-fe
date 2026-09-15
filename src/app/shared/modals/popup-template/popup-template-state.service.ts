import {Injectable, TemplateRef} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface DrawerState {
  visible: boolean;
  closeBtnOutside: boolean;
  content?: TemplateRef<unknown>;
  type?: string;
  closing: boolean;
  doNotTrackOutsideClick?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PopupTemplateStateService {
  private drawerState = new BehaviorSubject<DrawerState>({
    visible: false,
    closeBtnOutside: false,
    content: undefined,
    type: undefined,
    closing: false,
  });

  drawerState$: Observable<DrawerState> = this.drawerState.asObservable();

  open(content: TemplateRef<unknown>, type: string, outside = false, doNotTrackOutsideClick = false): void {
    this.drawerState.next({
      visible: true,
      closeBtnOutside: outside,
      content,
      type,
      closing: false,
      doNotTrackOutsideClick: doNotTrackOutsideClick,
    });
  }

  close() {
    const current = this.drawerState.value;
    this.drawerState.next({
      ...current,
      closing: true,
    });

    setTimeout(() => {
      this.drawerState.next({
        ...current,
        visible: false,
        closeBtnOutside: false,
        content: undefined,
        closing: false,
      });
    }, 200);
  }

  closeImmediately() {
    const current = this.drawerState.value;

    this.drawerState.next({
      ...current,
      visible: false,
      closeBtnOutside: false,
      content: undefined,
      closing: false,
    });
  }
}
