import {Injectable, Injector} from '@angular/core';
import {Messaging, getToken, onMessage} from '@angular/fire/messaging';
import {BehaviorSubject} from 'rxjs';
import {environment} from "../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {AppConstants} from "../app.constants";

@Injectable({
  providedIn: 'root',
})
export class FirebaseNotificationService {
  private messaging: Messaging | null = null;
  private currentMessage = new BehaviorSubject<any | null>(null);

  constructor(private http: HttpClient, private injector: Injector) {
  }

  public async initFCM() {
    try {
      if (!this.isSupportedBrowser()) {
        console.warn('FCM is not supported in this browser.');
        return;
      }

      // ✅ Lazy load Messaging only if needed
      this.messaging = this.injector.get(Messaging);

      await this.requestPermission();
      this.listenForMessages();
    } catch (error) {
      console.error('FCM initialization failed');
    }
  }

  private async requestPermission() {
    try {
      if (!this.messaging) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('User denied notification permission.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebaseConfig.vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log('FCM Token:', token);
        this.sendTokenToBackend(token);
      } else {
        console.warn('No FCM token received.');
      }
    } catch (error) {
      console.error('Failed to request FCM token:', error);
    }
  }

  private listenForMessages() {
    try {
      if (!this.messaging) return;

      onMessage(this.messaging, (payload) => {
        console.log('Message received:', payload);
        this.currentMessage.next(payload);
      });
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  }

  get currentMessage$() {
    return this.currentMessage.asObservable();
  }

  private sendTokenToBackend(token: string) {
    this.http.post(`${AppConstants.API_URL}/fcm/register`, {token, deviceType: 'web'}, {withCredentials: true})
      .subscribe({
        next: () => console.log('FCM Token registered successfully'),
        error: (err) => console.error('Failed to register FCM token:', err),
      });
  }

  private isSupportedBrowser(): boolean {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSecureContext = window.isSecureContext; // Ensures HTTPS or `localhost` in Chrome

    if (!isSecureContext) {
      console.warn('Push notifications require HTTPS (except in Chrome on localhost).');
      return false;
    }

    if (!(isChrome || isFirefox)) {
      console.warn('Push notifications are not supported in this browser.');
      return false;
    }

    return true;
  }
}
