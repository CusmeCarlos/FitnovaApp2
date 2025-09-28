// src/app/services/capture.service.ts
// 📸 CAPTURESERVICE - CORREGIDO PARA FIREBASE

import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';
import { take } from 'rxjs/operators';

// ✅ INTERFACES CORREGIDAS PARA FIREBASE
export interface CriticalAlert {
  id?: string;
  uid: string; // ← CORREGIDO: uid no userId
  errorType: string;
  severity: string; // ← CORREGIDO: string no number
  exercise: string;
  exerciseType: string;
  timestamp: any;
  processedAt: any;
  biomechanicsData?: any;
  affectedJoints?: string[];
  angles?: any;
  confidence: number;
  lastSessionId: string;
  sessionId: string;
  status: string;
  captureURL: string; // ← IMPORTANTE: URL de la imagen
  deviceInfo?: any;
  readAt?: any;
  readBy?: string;
  resolvedAt?: any;
  resolvedBy?: string;
  trainerNotes?: string;
  followUpRequired?: boolean;
}

export interface TrainingSession {
  id?: string;
  userId: string;
  exerciseType: string;
  startTime: any;
  endTime?: any;
  completed?: boolean;
  finalStats?: any;
  errorsDetected?: number;
  capturesTaken?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CaptureService {
  private currentSession: TrainingSession | null = null;
  private capturedErrorsInSession = new Set<string>();
  private readonly MAX_CAPTURES_PER_SESSION = 3;
  private readonly MIN_TIME_BETWEEN_CAPTURES = 30000; // 30 segundos
  private lastCaptureTime: number = 0;

  constructor(
    private storage: AngularFireStorage,
    private firestore: AngularFirestore,
    private auth: AuthService,
    private errorHandler: ErrorHandlerService
  ) {}

  // ✅ INICIALIZAR SESIÓN DE ENTRENAMIENTO
  async startTrainingSession(exerciseType: string): Promise<string | null> {
    try {
      const userId = await this.auth.getCurrentUserId();
      if (!userId) {
        console.warn('📸 No hay usuario autenticado para iniciar sesión');
        return null;
      }

      const sessionData: Omit<TrainingSession, 'id'> = {
        userId,
        exerciseType,
        startTime: new Date(),
        errorsDetected: 0,
        capturesTaken: 0
      };

      const sessionRef = await this.firestore.collection('training-sessions').add(sessionData);
      
      this.currentSession = {
        id: sessionRef.id,
        ...sessionData
      };

      this.capturedErrorsInSession.clear();
      this.lastCaptureTime = 0;

      console.log('📸 Sesión de entrenamiento iniciada:', sessionRef.id);
      return sessionRef.id;
      
    } catch (error) {
      console.error('🛑 Error iniciando sesión de entrenamiento:', error);
      return null;
    }
  }

  // ✅ CAPTURA AUTOMÁTICA CORREGIDA
  async captureErrorIfNeeded(
    canvas: HTMLCanvasElement,
    errorType: string,
    severity: string, // ← CAMBIADO: string en lugar de number
    biomechanicsData?: any
  ): Promise<boolean> {
    
    if (!this.currentSession) {
      console.warn('📸 No hay sesión activa para captura');
      return false;
    }

    // ✅ CAPTURAR ERRORES CRÍTICOS Y HIGH
    const shouldCapture = severity === 'critical' || severity === 'high';
    
    if (!shouldCapture) {
      console.log(`📸 Severidad ${severity} no requiere captura`);
      return false;
    }

    const errorKey = `${errorType}_${this.currentSession.exerciseType}`;
    if (this.capturedErrorsInSession.has(errorKey)) {
      console.log(`📸 Error ${errorKey} ya capturado en esta sesión`);
      return false;
    }

    const now = Date.now();
    if ((this.currentSession.capturesTaken || 0) >= this.MAX_CAPTURES_PER_SESSION) {
      console.log('📸 Límite de capturas por sesión alcanzado');
      return false;
    }

    if (now - this.lastCaptureTime < this.MIN_TIME_BETWEEN_CAPTURES) {
      console.log('📸 Muy pronto para otra captura');
      return false;
    }

    try {
      console.log(`📸 ¡Iniciando captura para error ${severity}: ${errorType}!`);

      // ✅ 1. CREAR ALERTA EN FIREBASE (SIN CAPTURA PRIMERO)
      const alertId = await this.createCriticalAlert(errorType, severity, biomechanicsData);
      if (!alertId) return false;

      // ✅ 2. REALIZAR CAPTURA Y SUBIR A STORAGE
      const captureUrl = await this.performCapture(canvas, alertId);
      if (!captureUrl) {
        console.error('❌ No se pudo generar captureURL');
        return false;
      }

      // ✅ 3. ACTUALIZAR ALERTA CON URL DE CAPTURA
      await this.updateAlertWithCapture(alertId, captureUrl);

      // ✅ 4. ACTUALIZAR SESIÓN
      this.capturedErrorsInSession.add(errorKey);
      this.lastCaptureTime = now;
      
      if (this.currentSession.id) {
        await this.firestore.collection('training-sessions')
          .doc(this.currentSession.id)
          .update({
            errorsDetected: (this.currentSession.errorsDetected || 0) + 1,
            capturesTaken: (this.currentSession.capturesTaken || 0) + 1
          });
        
        this.currentSession.errorsDetected = (this.currentSession.errorsDetected || 0) + 1;
        this.currentSession.capturesTaken = (this.currentSession.capturesTaken || 0) + 1;
      }

      console.log(`📸 ¡Captura exitosa! URL: ${captureUrl}`);
      return true;

    } catch (error) {
      console.error('🛑 Error durante captura:', error);
      return false;
    }
  }

  // ✅ CREAR ALERTA CRÍTICA (ESTRUCTURA CORRECTA)
  private async createCriticalAlert(
    errorType: string,
    severity: string,
    biomechanicsData?: any
  ): Promise<string | null> {
    try {
      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return null;

      // ✅ ESTRUCTURA EXACTA QUE ESPERA FIREBASE
      const alertData: Omit<CriticalAlert, 'id'> = {
        uid: userId, // ← CORRECTO: uid no userId
        errorType,
        severity, // ← CORRECTO: string
        exercise: this.currentSession.exerciseType,
        exerciseType: this.currentSession.exerciseType,
        timestamp: new Date(),
        processedAt: new Date(),
        biomechanicsData: biomechanicsData || {},
        affectedJoints: biomechanicsData?.affectedJoints || [],
        angles: biomechanicsData?.angles || {},
        confidence: biomechanicsData?.confidence || 0.8,
        lastSessionId: this.currentSession.id!,
        sessionId: this.currentSession.id!,
        status: 'unread',
        captureURL: '', // ← Se actualiza después
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenResolution: `${screen.width}x${screen.height}`
        }
      };

      // ✅ COLECCIÓN CORRECTA
      const docRef = await this.firestore.collection('criticalAlerts').add(alertData);
      console.log('🚨 Alerta crítica creada con ID:', docRef.id);
      return docRef.id;

    } catch (error) {
      console.error('🛑 Error creando alerta crítica:', error);
      return null;
    }
  }

  // ✅ ACTUALIZAR ALERTA CON URL DE CAPTURA
  private async updateAlertWithCapture(alertId: string, captureUrl: string): Promise<void> {
    try {
      await this.firestore.collection('criticalAlerts').doc(alertId).update({
        captureURL: captureUrl,
        hasCaptureImage: true,
        captureTimestamp: new Date()
      });
      
      console.log(`✅ Alerta ${alertId} actualizada con captureURL`);
    } catch (error) {
      console.error('❌ Error actualizando alerta con captura:', error);
      throw error;
    }
  }

  // ✅ REALIZAR CAPTURA Y SUBIR A STORAGE (SIN CAMBIOS)
  private async performCapture(canvas: HTMLCanvasElement, alertId: string): Promise<string | null> {
    try {
      const blob = await this.canvasToBlob(canvas);
      if (!blob) return null;

      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return null;

      const timestamp = Date.now();
      const filename = `error_${alertId}_${timestamp}.png`;
      const storagePath = `captures/${userId}/${this.currentSession.id}/${filename}`;

      const uploadTask = this.storage.upload(storagePath, blob, {
        customMetadata: {
          errorId: alertId,
          errorType: 'critical',
          sessionId: this.currentSession.id!,
          uploadedAt: new Date().toISOString()
        }
      });

      await uploadTask;
      
      const downloadURL = await this.storage.ref(storagePath).getDownloadURL().toPromise();
      
      console.log(`📸 Imagen subida: ${filename}`);
      return downloadURL;

    } catch (error) {
      console.error('🛑 Error en captura:', error);
      return null;
    }
  }

  // ✅ FINALIZAR SESIÓN
  async endTrainingSession(): Promise<void> {
    if (!this.currentSession?.id) return;

    try {
      await this.firestore.collection('training-sessions')
        .doc(this.currentSession.id)
        .update({
          endTime: new Date(),
          completed: true,
          finalStats: {
            totalErrors: this.currentSession.errorsDetected || 0,
            totalCaptures: this.currentSession.capturesTaken || 0,
            duration: Date.now() - (this.currentSession.startTime?.getTime() || Date.now())
          }
        });

      console.log('📸 Sesión de entrenamiento finalizada:', this.currentSession.id);
      this.currentSession = null;
      this.capturedErrorsInSession.clear();

    } catch (error) {
      console.error('🛑 Error finalizando sesión:', error);
    }
  }

  // ✅ MÉTODOS AUXILIARES CON NULL SAFETY
  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.9);
    });
  }

  getCurrentSession(): TrainingSession | null {
    return this.currentSession;
  }

  canCaptureError(errorType: string): boolean {
    if (!this.currentSession) return false;
    
    const errorKey = `${errorType}_${this.currentSession.exerciseType}`;
    return !this.capturedErrorsInSession.has(errorKey) &&
           (this.currentSession.capturesTaken || 0) < this.MAX_CAPTURES_PER_SESSION;
  }

  getSessionStats() {
    return {
      sessionId: this.currentSession?.id || null,
      exerciseType: this.currentSession?.exerciseType || null,
      errorsDetected: this.currentSession?.errorsDetected || 0,
      capturesTaken: this.currentSession?.capturesTaken || 0,
      canCaptureMore: (this.currentSession?.capturesTaken || 0) < this.MAX_CAPTURES_PER_SESSION
    };
  }
}