importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

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
  // The backend puts the in-app path in data; a tap opens it (a book that became ready opens at chapter one).
  const path = payload.data && payload.data.path ? payload.data.path : "/";
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/assets/img/logo/192.png",
    badge: "/assets/img/logo/72.png",
    data: {path},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({type: "window", includeUncontrolled: true}).then((windowClients) => {
      const open = windowClients.find((client) => client.url.startsWith(self.location.origin) && "focus" in client);
      if (open) {
        return open.focus().then((client) => (client && "navigate" in client ? client.navigate(url) : client));
      }
      return clients.openWindow(url);
    }),
  );
});
