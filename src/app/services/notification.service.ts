// src/app/services/notification.service.ts
// NOTIFICATIONSERVICE - FCM + ALERTAS AL ENTRENADOR (CORREGIDO NG0203)

import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AngularFireMessaging } from '@angular/fire/compat/messaging';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';
import { firstValueFrom } from 'rxjs';

export interface NotificationAlert {
  id?: string;
  uid: string;
  userDisplayName?: string;
  userEmail?: string;
  errorType: string;
  exercise: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  sessionId: string;
  captureURL?: string;
  deviceInfo?: any;
  biomechanicsData?: any;
  sent: boolean;
  trainerNotified?: boolean;
  suppressedUntil?: Date;
}

export interface NotificationPreferences {
  uid: string;
  enableCriticalAlerts: boolean;
  enableHighAlerts: boolean;
  enableMediumAlerts: boolean;
  enableLowAlerts: boolean;
  suppressionMinutes: number;
  maxAlertsPerHour: number;
  alertMethods: {
    fcm: boolean;
    email: boolean;
    sms?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private suppressionMap = new Map<string, Date>();
  private hourlyAlertCount = new Map<string, { count: number; resetTime: Date }>();
  private fcmToken: string | null = null;
  private isInitialized = false;

  // ✅ CREAR REFERENCIAS DE COLECCIONES EN EL CONSTRUCTOR
  private notificationsCollection: AngularFirestoreCollection<NotificationAlert>;
  private fcmTokensCollection: AngularFirestoreCollection<any>;
  private notificationPreferencesCollection: AngularFirestoreCollection<NotificationPreferences>;

  constructor(
    private firestore: AngularFirestore,
    private functions: AngularFireFunctions,
    private messaging: AngularFireMessaging,
    private auth: AuthService,
    private errorHandler: ErrorHandlerService
  ) {
    // ✅ INICIALIZAR REFERENCIAS DE COLECCIONES AQUÍ
    this.notificationsCollection = this.firestore.collection<NotificationAlert>('notifications');
    this.fcmTokensCollection = this.firestore.collection('fcmTokens');
    this.notificationPreferencesCollection = this.firestore.collection<NotificationPreferences>('notificationPreferences');
  }

  // INICIALIZAR FCM
  async initializeFCM(): Promise<void> {
    try {
      if (this.isInitialized) return;

      console.log('🔔 Inicializando Firebase Cloud Messaging...');

      // SOLICITAR PERMISOS
      const permission = await this.requestPermission();
      if (!permission) {
        console.warn('🔔 Permisos de notificación denegados');
        return;
      }

      // OBTENER TOKEN FCM
      this.fcmToken = await firstValueFrom(this.messaging.requestToken);

      if (this.fcmToken) {
        console.log('🔔 Token FCM obtenido:', this.fcmToken);
        await this.registerFCMToken(this.fcmToken);
      }

      // ESCUCHAR MENSAJES EN PRIMER PLANO
      this.messaging.messages.subscribe((payload) => {
        console.log('🔔 Mensaje FCM recibido:', payload);
        this.handleForegroundMessage(payload);
      });

      // ESCUCHAR CAMBIOS DE TOKEN
      this.messaging.tokenChanges.subscribe(async (token) => {
        if (token) {
          console.log('🔔 Token FCM actualizado:', token);
          this.fcmToken = token;
          await this.registerFCMToken(token);
        }
      });

      this.isInitialized = true;
      console.log('✅ FCM inicializado correctamente');

    } catch (error) {
      console.error('🛑 Error inicializando FCM:', error);
    }
  }

  // SOLICITAR PERMISOS
  private async requestPermission(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('🔔 Notificaciones no soportadas en este navegador');
        return false;
      }

      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission === 'denied') {
        console.warn('🔔 Permisos de notificación denegados permanentemente');
        return false;
      }

      const permission = await Notification.requestPermission();
      return permission === 'granted';

    } catch (error) {
      console.error('🛑 Error solicitando permisos:', error);
      return false;
    }
  }

  // MANEJAR MENSAJES EN PRIMER PLANO
  private handleForegroundMessage(payload: any): void {
    try {
      const title = payload.notification?.title || 'FitNova - Alerta';
      const options = {
        body: payload.notification?.body || 'Nueva notificación',
        icon: '/assets/icon/icon-192x192.png',
        tag: 'fitnova-foreground',
        requireInteraction: payload.data?.severity === 'critical'
      };

      new Notification(title, options);

    } catch (error) {
      console.error('🛑 Error mostrando notificación:', error);
    }
  }

  // ✅ ENVIAR ALERTA CRÍTICA (CORREGIDO)
  async sendCriticalAlert(
    errorType: string,
    exercise: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    sessionId: string,
    captureURL?: string,
    additionalData?: any
  ): Promise<boolean> {
    
    try {
      const user = await firstValueFrom(this.auth.user$);
      if (!user) {
        console.warn('🔔 No hay usuario autenticado para enviar alerta');
        return false;
      }

      // VERIFICAR SUPRESIÓN TEMPORAL
      const suppressionKey = `${errorType}_${user.uid}`;
      if (this.isErrorSuppressed(suppressionKey)) {
        console.log(`🔔 Error ${errorType} suprimido temporalmente para ${user.uid}`);
        return false;
      }

      // VERIFICAR LÍMITES POR HORA
      if (!this.canSendAlert(user.uid)) {
        console.log(`🔔 Límite de alertas por hora alcanzado para ${user.uid}`);
        return false;
      }

      // CREAR ALERTA
      const alert: NotificationAlert = {
        uid: user.uid,
        userDisplayName: user.displayName || 'Usuario',
        userEmail: user.email,
        errorType,
        exercise,
        severity,
        timestamp: new Date(),
        sessionId,
        captureURL,
        deviceInfo: additionalData?.deviceInfo,
        biomechanicsData: additionalData?.biomechanicsData,
        sent: false,
        trainerNotified: false
      };

      // ✅ USAR REFERENCIA DE COLECCIÓN PRECONFIGURADA
      const alertRef = await this.notificationsCollection.add(alert);
      
      // LLAMAR CLOUD FUNCTION PARA PROCESAR ALERTA
      const sendNotification = this.functions.httpsCallable('sendTrainerNotification');
      const result = await firstValueFrom(sendNotification({
        alertId: alertRef.id,
        fcmToken: this.fcmToken,
        ...alert
      }));

      if (result.success) {
        // MARCAR COMO ENVIADA
        await alertRef.update({
          sent: true,
          trainerNotified: true,
          sentAt: new Date()
        });

        // APLICAR SUPRESIÓN TEMPORAL
        await this.applySuppression(suppressionKey, severity);
        
        // INCREMENTAR CONTADOR POR HORA
        this.incrementHourlyCount(user.uid);

        console.log(`✅ Alerta crítica enviada exitosamente: ${errorType}`);
        return true;
      } else {
        console.error('🛑 Error enviando alerta:', result.error);
        return false;
      }

    } catch (error) {
      console.error('🛑 Error en sendCriticalAlert:', error);
      await this.errorHandler.handleGeneralError(error, 'Error enviando alerta');
      return false;
    }
  }

  // OBTENER TOKEN FCM ACTUAL
  getCurrentFCMToken(): string | null {
    return this.fcmToken;
  }

  // VERIFICAR SI FCM ESTÁ INICIALIZADO
  isFCMInitialized(): boolean {
    return this.isInitialized;
  }

  // ✅ REGISTRAR TOKEN FCM (CORREGIDO)
  async registerFCMToken(token: string): Promise<void> {
    try {
      const user = await firstValueFrom(this.auth.user$);
      if (!user) return;

      // ✅ USAR REFERENCIA DE COLECCIÓN PRECONFIGURADA
      await this.fcmTokensCollection.doc(user.uid).set({
        token,
        platform: 'web',
        updatedAt: new Date(),
        userId: user.uid,
        userEmail: user.email
      }, { merge: true });

      console.log('✅ Token FCM registrado exitosamente');
    } catch (error) {
      console.error('🛑 Error registrando token FCM:', error);
    }
  }

  // VERIFICAR SI ERROR ESTÁ SUPRIMIDO
  private isErrorSuppressed(suppressionKey: string): boolean {
    const suppressedUntil = this.suppressionMap.get(suppressionKey);
    if (!suppressedUntil) return false;
    
    const now = new Date();
    if (now < suppressedUntil) {
      return true;
    } else {
      this.suppressionMap.delete(suppressionKey);
      return false;
    }
  }

  // APLICAR SUPRESIÓN TEMPORAL SEGÚN SEVERIDAD
  private async applySuppression(suppressionKey: string, severity: string): Promise<void> {
    let suppressionMinutes: number;
    
    switch (severity) {
      case 'critical':
        suppressionMinutes = 15;
        break;
      case 'high':
        suppressionMinutes = 30;
        break;
      case 'medium':
        suppressionMinutes = 60;
        break;
      default:
        suppressionMinutes = 120;
    }

    const suppressedUntil = new Date(Date.now() + suppressionMinutes * 60 * 1000);
    this.suppressionMap.set(suppressionKey, suppressedUntil);
    
    console.log(`🔔 Supresión aplicada para ${suppressionKey} hasta ${suppressedUntil.toLocaleTimeString()}`);
  }

  // VERIFICAR LÍMITES DE ALERTAS POR HORA
  private canSendAlert(uid: string): boolean {
    const now = new Date();
    const alertData = this.hourlyAlertCount.get(uid);
    
    if (!alertData) {
      return true;
    }

    if (now.getTime() - alertData.resetTime.getTime() > 60 * 60 * 1000) {
      this.hourlyAlertCount.set(uid, { count: 0, resetTime: now });
      return true;
    }

    return alertData.count < 5;
  }

  // INCREMENTAR CONTADOR POR HORA
  private incrementHourlyCount(uid: string): void {
    const now = new Date();
    const alertData = this.hourlyAlertCount.get(uid);
    
    if (!alertData || (now.getTime() - alertData.resetTime.getTime() > 60 * 60 * 1000)) {
      this.hourlyAlertCount.set(uid, { count: 1, resetTime: now });
    } else {
      alertData.count++;
    }
  }

  // ✅ CONFIGURAR PREFERENCIAS (CORREGIDO)
  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      await this.notificationPreferencesCollection
        .doc(preferences.uid)
        .set(preferences, { merge: true });
      
      console.log('✅ Preferencias de notificación actualizadas');
    } catch (error) {
      console.error('🛑 Error actualizando preferencias:', error);
      throw error;
    }
  }

  // ✅ OBTENER PREFERENCIAS (CORREGIDO)
  async getUserPreferences(uid: string): Promise<NotificationPreferences | null> {
    try {
      const doc = await firstValueFrom(this.notificationPreferencesCollection
        .doc(uid)
        .get());
      
      if (doc?.exists) {
        return doc.data() as NotificationPreferences;
      } else {
        return {
          uid,
          enableCriticalAlerts: true,
          enableHighAlerts: true,
          enableMediumAlerts: false,
          enableLowAlerts: false,
          suppressionMinutes: 15,
          maxAlertsPerHour: 5,
          alertMethods: {
            fcm: true,
            email: false
          }
        };
      }
    } catch (error) {
      console.error('🛑 Error obteniendo preferencias:', error);
      return null;
    }
  }

  // ✅ OBTENER HISTORIAL (CORREGIDO)
  async getAlertHistory(uid: string, limit: number = 50): Promise<NotificationAlert[]> {
    try {
      const snapshot = await this.notificationsCollection
        .ref.where('uid', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as NotificationAlert));
    } catch (error) {
      console.error('🛑 Error obteniendo historial de alertas:', error);
      return [];
    }
  }

  // LIMPIAR SUPRESIONES EXPIRADAS
  cleanExpiredSuppressions(): void {
    const now = new Date();
    for (const [key, suppressedUntil] of this.suppressionMap.entries()) {
      if (now >= suppressedUntil) {
        this.suppressionMap.delete(key);
      }
    }
  }
}