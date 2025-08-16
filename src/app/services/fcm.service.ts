// src/app/services/fcm.service.ts
// 🔔 FCM SERVICE SIMPLE - SOLO PARA MANEJO DE TOKENS

import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FCMService {
  private isInitialized = false;

  constructor(
    private firestore: AngularFirestore,
    private auth: AuthService
  ) {}

  // ✅ INICIALIZAR FCM BÁSICO (SIN MESSAGING - SOLO PARA WEB)
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // ✅ SOLICITAR PERMISOS BÁSICOS
      const permission = await this.requestNotificationPermission();
      if (permission) {
        console.log('🔔 Permisos de notificación otorgados');
        
        // ✅ REGISTRAR DISPOSITIVO (SIN TOKEN POR AHORA)
        await this.registerDevice();
        
        this.isInitialized = true;
        console.log('✅ FCM Service inicializado');
      } else {
        console.warn('🔔 Permisos de notificación denegados');
      }

    } catch (error) {
      console.error('🛑 Error inicializando FCM Service:', error);
    }
  }

  // ✅ SOLICITAR PERMISOS
  private async requestNotificationPermission(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('🔔 Notificaciones no soportadas');
        return false;
      }

      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission === 'denied') {
        console.warn('🔔 Permisos denegados permanentemente');
        return false;
      }

      const permission = await Notification.requestPermission();
      return permission === 'granted';

    } catch (error) {
      console.error('🛑 Error solicitando permisos:', error);
      return false;
    }
  }

  // ✅ REGISTRAR DISPOSITIVO (SIN TOKEN FCM POR AHORA)
  private async registerDevice(): Promise<void> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) return;

      // ✅ REGISTRAR DISPOSITIVO BÁSICO
      await this.firestore.collection('userDevices').doc(user.uid).set({
        platform: 'web',
        notificationsEnabled: true,
        registeredAt: new Date(),
        userAgent: navigator.userAgent,
        // fcmToken: null, // Se agregará cuando implementemos FCM completo
      }, { merge: true });

      console.log('🔔 Dispositivo registrado exitosamente');
    } catch (error) {
      console.error('🛑 Error registrando dispositivo:', error);
    }
  }

  // ✅ VERIFICAR SI ESTÁ INICIALIZADO
  isReady(): boolean {
    return this.isInitialized;
  }

  // ✅ MOSTRAR NOTIFICACIÓN LOCAL (TEMPORAL)
  async showLocalNotification(title: string, message: string): Promise<void> {
    try {
      if (!this.isInitialized || Notification.permission !== 'granted') {
        console.warn('🔔 No se pueden mostrar notificaciones');
        return;
      }

      new Notification(title, {
        body: message,
        icon: '/assets/icon/icon-192x192.png',
        tag: 'fitnova-local',
      });

    } catch (error) {
      console.error('🛑 Error mostrando notificación local:', error);
    }
  }
}

// ✅ TAMBIÉN NECESITAS AGREGAR ESTA IMPORTACIÓN
import { take } from 'rxjs/operators';