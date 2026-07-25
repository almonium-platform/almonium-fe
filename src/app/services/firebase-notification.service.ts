import {logger} from "../shared/logger";
import { Injectable, Injector, OnDestroy, inject } from '@angular/core';
import {Messaging, onMessage, onRegistered, register} from '@angular/fire/messaging';
import type {MessagePayload} from 'firebase/messaging';
import {BehaviorSubject} from 'rxjs';
import {environment} from "../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {AppConstants} from "../app.constants";

@Injectable({
  providedIn: 'root',
})
export class FirebaseNotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private injector = inject(Injector);

  private messaging: Messaging | null = null;
  private currentMessage = new BehaviorSubject<MessagePayload | null>(null);
  private stopRegistrationListener?: () => void;
  private stopMessageListener?: () => void;

  public async initFCM() {
    try {
      if (!this.isSupportedBrowser()) {
        logger.warn('FCM is not supported in this browser.');
        return;
      }

      // ✅ Lazy load Messaging only if needed
      this.messaging = this.injector.get(Messaging);

      await this.requestPermission();
      this.listenForMessages();
    } catch {
      logger.error('FCM initialization failed');
    }
  }

  private async requestPermission() {
    try {
      if (!this.messaging) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        logger.warn('User denied notification permission.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      this.stopRegistrationListener?.();
      this.stopRegistrationListener = onRegistered(this.messaging, installationId => {
        this.sendTokenToBackend(installationId);
      });
      await register(this.messaging, {
        vapidKey: environment.firebaseConfig.vapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch (error) {
      logger.error('Failed to request FCM token:', error);
    }
  }

  private listenForMessages() {
    try {
      if (!this.messaging) return;

      this.stopMessageListener?.();
      this.stopMessageListener = onMessage(this.messaging, (payload) => {
        this.currentMessage.next(payload);
      });
    } catch (error) {
      logger.error('Error setting up message listener:', error);
    }
  }

  get currentMessage$() {
    return this.currentMessage.asObservable();
  }

  private sendTokenToBackend(token: string) {
    this.http.post(`${AppConstants.API_URL}/fcm/register`, {token, deviceType: 'web'}, {withCredentials: true})
      .subscribe({
        error: (err) => logger.error('Failed to register FCM token:', err),
      });
  }

  private isSupportedBrowser(): boolean {
    const isSecureContext = window.isSecureContext; // Ensures HTTPS or `localhost` in Chrome
    const hasRequiredApis = 'serviceWorker' in navigator && 'Notification' in window;

    if (!isSecureContext) {
      logger.warn('Push notifications require HTTPS (except in Chrome on localhost).');
      return false;
    }

    if (!hasRequiredApis) {
      logger.warn('Push notifications are not supported in this browser.');
      return false;
    }

    return true;
  }

  ngOnDestroy(): void {
    this.stopRegistrationListener?.();
    this.stopMessageListener?.();
  }
}
