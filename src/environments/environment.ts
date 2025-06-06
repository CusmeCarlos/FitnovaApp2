// src/environments/environment.ts
// ✅ CONFIGURACIÓN ACTUALIZADA PARA INCREMENTO 2

export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyBt14_G3joQabbwK15lDgYFn7jjVklAAO0",
    authDomain: "fitnova-app.firebaseapp.com",
    projectId: "fitnova-app",
    storageBucket: "fitnova-app.firebasestorage.app",
    messagingSenderId: "553990987723",
    appId: "1:553990987723:web:c6adf166677069789aa04e",
    measurementId: "G-85QSFTH679"
  },
  // ✅ CONFIGURACIÓN PARA MEDIAPIPE
  mediapipe: {
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
    enableSegmentation: false,
    smoothLandmarks: true
  },
  // ✅ CONFIGURACIÓN DE POSES
  pose: {
    maxFps: 30,
    canvasWidth: 640,
    canvasHeight: 480,
    enableDebugInfo: true,
    colors: {
      landmarks: '#00FF00',
      connections: '#0099FF',
      errors: '#FF3030',
      angles: '#FFD700'
    }
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.