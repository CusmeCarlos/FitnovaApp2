// src/firebase-messaging-sw.js
// 🔔 SERVICE WORKER PARA FIREBASE CLOUD MESSAGING

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// ✅ CONFIGURACIÓN FIREBASE (usar tu configuración exacta)
const firebaseConfig = {
  apiKey: "AIzaSyBt14_G3joQabbwK15lDgYFn7jjVklAAO0",
  authDomain: "fitnova-app.firebaseapp.com",
  projectId: "fitnova-app",
  storageBucket: "fitnova-app.firebasestorage.app",
  messagingSenderId: "553990987723",
  appId: "1:553990987723:web:c6adf166677069789aa04e",
  measurementId: "G-85QSFTH679"
};

// ✅ INICIALIZAR FIREBASE
firebase.initializeApp(firebaseConfig);

// ✅ INICIALIZAR MESSAGING
const messaging = firebase.messaging();

// 🔔 MANEJAR MENSAJES EN BACKGROUND
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 Background Message received:', payload);

  // ✅ EXTRAER DATOS DEL PAYLOAD
  const notificationTitle = payload.notification?.title || 'FitNova - Alerta Crítica';
  const notificationOptions = {
    body: payload.notification?.body || 'Error crítico detectado durante entrenamiento',
    icon: '/assets/icon/icon-192x192.png',
    badge: '/assets/icon/icon-72x72.png',
    tag: 'fitnova-critical-error',
    requireInteraction: true, // Requiere interacción del usuario
    data: {
      errorType: payload.data?.errorType || 'unknown',
      severity: payload.data?.severity || 'critical',
      sessionId: payload.data?.sessionId || '',
      exerciseType: payload.data?.exerciseType || '',
      timestamp: payload.data?.timestamp || new Date().toISOString()
    },
    actions: [
      {
        action: 'view-details',
        title: 'Ver Detalles'
      },
      {
        action: 'dismiss',
        title: 'Cerrar'
      }
    ]
  };

  // ✅ MOSTRAR NOTIFICACIÓN
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 🔔 MANEJAR CLICS EN NOTIFICACIONES
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification click received:', event);

  // ✅ CERRAR NOTIFICACIÓN
  event.notification.close();

  // ✅ MANEJAR ACCIONES
  if (event.action === 'view-details') {
    // Abrir app en la sección de alertas críticas
    event.waitUntil(
      clients.openWindow('/tabs/tab1?section=critical-alerts')
    );
  } else if (event.action === 'dismiss') {
    // Solo cerrar
    return;
  } else {
    // Clic general - abrir app
    event.waitUntil(
      clients.openWindow('/tabs/tab1')
    );
  }
});

// 🔔 MANEJAR INSTALACIÓN DEL SERVICE WORKER
self.addEventListener('install', (event) => {
  console.log('🔔 FCM Service Worker instalado');
  self.skipWaiting();
});

// 🔔 MANEJAR ACTIVACIÓN DEL SERVICE WORKER
self.addEventListener('activate', (event) => {
  console.log('🔔 FCM Service Worker activado');
  event.waitUntil(self.clients.claim());
});