import {inject, Injectable} from '@angular/core';
import {Messaging, getToken, onMessage} from '@angular/fire/messaging';
import {BehaviorSubject} from 'rxjs';
import {environment} from "../../environments/environment";
import firebase from "firebase/compat";
import MessagePayload = firebase.messaging.MessagePayload;
import {HttpClient} from "@angular/common/http";
import {AppConstants} from "../app.constants";

@Injectable({
  providedIn: 'root',
})
export class FirebaseNotificationService {
  private messaging = inject(Messaging);
  private currentMessage = new BehaviorSubject<MessagePayload | null>(null);

  constructor(
    private http: HttpClient) {
    this.requestPermission();
    this.listenForMessages();
  }

  requestPermission() {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        navigator.serviceWorker
          .register('/firebase-messaging-sw.js', {type: 'module'})
          .then((registration) => {
            return getToken(this.messaging, {
              vapidKey: environment.firebaseConfig.vapidKey,
              serviceWorkerRegistration: registration,
            });
          })
          .then((token) => {
            if (token) {
              // Send the token to your server to store it and use it to send notifications
              console.log('FCM Token:', token);
            } else {
              console.log('No registration token available.');
            }
          })
          .catch((err) => {
            console.error('An error occurred while retrieving token. ', err);
          });
      } else {
        console.log('Unable to get permission to notify.');
      }
    });
  }

  listenForMessages() {
    onMessage(this.messaging, (payload) => {
      console.log('Message received. ', payload);
      this.currentMessage.next(payload);
    });
  }

  get currentMessage$() {
    return this.currentMessage.asObservable();
  }

  requestFCMToken(): void {
    console.log('Requesting FCM token');
    navigator.serviceWorker.ready.then((registration) => {
      getToken(this.messaging, {
        vapidKey: environment.firebaseConfig.vapidKey,
        serviceWorkerRegistration: registration,
      })
        .then((token) => {
          if (token) {
            console.log('FCM Token:', token);
            this.sendTokenToBackend(token);
          } else {
            console.warn('No FCM token received');
          }
        })
        .catch((err) => console.error('Error retrieving FCM token:', err));
    });
  }

  private sendTokenToBackend(token: string): void {
    this.http.post(`${AppConstants.API_URL}/fcm/register`,
      {token, deviceType: 'web'},
      {withCredentials: true}
    ).subscribe({
      next: () => console.log('FCM Token registered successfully'),
      error: (err) => console.error('Failed to register FCM token:', err),
    });
  }
}
