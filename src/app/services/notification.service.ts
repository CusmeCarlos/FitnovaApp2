// src/app/services/notification.service.ts
// NOTIFICATIONSERVICE - FCM + ALERTAS AL ENTRENADOR

import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';
import { take } from 'rxjs/operators';

export interface NotificationAlert {
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
  suppressedUntil?: Date; // Para supresión temporal
}

export interface NotificationPreferences {
  uid: string;
  enableCriticalAlerts: boolean;
  enableHighAlerts: boolean;
  enableMediumAlerts: boolean;
  enableLowAlerts: boolean;
  suppressionMinutes: number; // Tiempo de supresión después de alerta
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
  private suppressionMap = new Map<string, Date>(); // errorType_uid -> suppressedUntil
  private hourlyAlertCount = new Map<string, { count: number; resetTime: Date }>(); // uid -> counts

  constructor(
    private firestore: AngularFirestore,
    private functions: AngularFireFunctions,
    private auth: AuthService,
    private errorHandler: ErrorHandlerService
  ) {}

  // ENVIAR ALERTA CRÍTICA AL ENTRENADOR
  async sendCriticalAlert(
    errorType: string,
    exercise: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    sessionId: string,
    captureURL?: string,
    additionalData?: any
  ): Promise<boolean> {
    
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        console.warn(' No hay usuario autenticado para enviar alerta');
        return false;
      }

      // VERIFICAR SUPRESIÓN TEMPORAL
      const suppressionKey = `${errorType}_${user.uid}`;
      if (this.isErrorSuppressed(suppressionKey)) {
        console.log(` Error ${errorType} suprimido temporalmente para ${user.uid}`);
        return false;
      }

      // VERIFICAR LÍMITES POR HORA
      if (!this.canSendAlert(user.uid)) {
        console.log(` Límite de alertas por hora alcanzado para ${user.uid}`);
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

      // GUARDAR ALERTA EN FIRESTORE
      const alertRef = await this.firestore.collection('notifications').add(alert);
      
      // LLAMAR CLOUD FUNCTION PARA PROCESAR ALERTA
      const sendNotification = this.functions.httpsCallable('sendTrainerNotification');
      const result = await sendNotification({
        alertId: alertRef.id,
        ...alert
      }).toPromise();

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

        console.log(` Alerta crítica enviada exitosamente: ${errorType}`);
        return true;
      } else {
        console.error(' Error enviando alerta:', result.error);
        return false;
      }

    } catch (error) {
      console.error(' Error en sendCriticalAlert:', error);
      await this.errorHandler.handleGeneralError(error, 'Error enviando alerta');
      return false;
    }
  }

  // VERIFICAR SI ERROR ESTÁ SUPRIMIDO
  private isErrorSuppressed(suppressionKey: string): boolean {
    const suppressedUntil = this.suppressionMap.get(suppressionKey);
    if (!suppressedUntil) return false;
    
    const now = new Date();
    if (now < suppressedUntil) {
      return true; // Aún suprimido
    } else {
      this.suppressionMap.delete(suppressionKey); // Limpiar supresión expirada
      return false;
    }
  }

  // APLICAR SUPRESIÓN TEMPORAL SEGÚN SEVERIDAD
  private async applySuppression(suppressionKey: string, severity: string): Promise<void> {
    let suppressionMinutes: number;
    
    switch (severity) {
      case 'critical':
        suppressionMinutes = 15; // 15 minutos para críticos
        break;
      case 'high':
        suppressionMinutes = 30; // 30 minutos para altos
        break;
      case 'medium':
        suppressionMinutes = 60; // 1 hora para medios
        break;
      default:
        suppressionMinutes = 120; // 2 horas para bajos
    }

    const suppressedUntil = new Date(Date.now() + suppressionMinutes * 60 * 1000);
    this.suppressionMap.set(suppressionKey, suppressedUntil);
    
    console.log(` Supresión aplicada para ${suppressionKey} hasta ${suppressedUntil.toLocaleTimeString()}`);
  }

  // VERIFICAR LÍMITES DE ALERTAS POR HORA
  private canSendAlert(uid: string): boolean {
    const now = new Date();
    const alertData = this.hourlyAlertCount.get(uid);
    
    if (!alertData) {
      return true; // Primera alerta de la hora
    }

    // RESETEAR CONTADOR SI PASÓ UNA HORA
    if (now.getTime() - alertData.resetTime.getTime() > 60 * 60 * 1000) {
      this.hourlyAlertCount.set(uid, { count: 0, resetTime: now });
      return true;
    }

    // VERIFICAR LÍMITE (5 alertas por hora por defecto)
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

  // CONFIGURAR PREFERENCIAS DE NOTIFICACIÓN
  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      await this.firestore.collection('notificationPreferences')
        .doc(preferences.uid)
        .set(preferences, { merge: true });
      
      console.log(' Preferencias de notificación actualizadas');
    } catch (error) {
      console.error(' Error actualizando preferencias:', error);
      throw error;
    }
  }

  // OBTENER PREFERENCIAS DEL USUARIO
  async getUserPreferences(uid: string): Promise<NotificationPreferences | null> {
    try {
      const doc = await this.firestore.collection('notificationPreferences')
        .doc(uid)
        .get()
        .toPromise();
      
      if (doc?.exists) {
        return doc.data() as NotificationPreferences;
      } else {
        // RETORNAR PREFERENCIAS POR DEFECTO
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
      console.error(' Error obteniendo preferencias:', error);
      return null;
    }
  }

  // REGISTRAR TOKEN FCM (para testing en web)
  async registerFCMToken(token: string): Promise<void> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) return;

      await this.firestore.collection('fcmTokens').doc(user.uid).set({
        token,
        platform: 'web',
        updatedAt: new Date()
      }, { merge: true });

      console.log(' Token FCM registrado exitosamente');
    } catch (error) {
      console.error(' Error registrando token FCM:', error);
    }
  }

  // OBTENER HISTORIAL DE ALERTAS
  async getAlertHistory(uid: string, limit: number = 50): Promise<NotificationAlert[]> {
    try {
      const snapshot = await this.firestore.collection<NotificationAlert>('notifications',
        ref => ref
          .where('uid', '==', uid)
          .orderBy('timestamp', 'desc')
          .limit(limit)
      ).get().toPromise();

      return snapshot?.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as NotificationAlert)) || [];
    } catch (error) {
      console.error(' Error obteniendo historial de alertas:', error);
      return [];
    }
  }

  // LIMPIAR SUPRESIONES EXPIRADAS (llamar periódicamente)
  cleanExpiredSuppressions(): void {
    const now = new Date();
    for (const [key, suppressedUntil] of this.suppressionMap.entries()) {
      if (now >= suppressedUntil) {
        this.suppressionMap.delete(key);
      }
    }
  }
}