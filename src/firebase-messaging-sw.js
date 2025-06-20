importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCotfh0KzDpP3HniEfxyxoAw9HUFAA8gFs",
  authDomain: "almonium.firebaseapp.com",
  projectId: "almonium",
  storageBucket: "almonium.firebasestorage.app",
  messagingSenderId: "33380019461",
  appId: "1:33380019461:web:6b4381869fdf5ec21ddb6c",
  measurementId: "G-6XKWX9LS25",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.info("Received background message:", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/assets/img/logo/192.png",
    badge: "/assets/img/logo/72.png",
  });
});
