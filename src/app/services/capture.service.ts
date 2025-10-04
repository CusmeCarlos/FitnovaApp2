// src/app/services/capture.service.ts
// 📸 CAPTURESERVICE - CAPTURA CON VIDEO REAL

import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { take } from 'rxjs/operators';

// ✅ INTERFACES
export interface CriticalAlert {
  id?: string;
  uid: string;
  errorType: string;
  severity: string;
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
  captureURL: string;
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
  
  private db = firebase.firestore();

  constructor(
    private storage: AngularFireStorage,
    private auth: AuthService,
    private errorHandler: ErrorHandlerService
  ) {
    console.log('📸 CaptureService inicializado (Firebase directo)');
  }

  // ✅ INICIALIZAR SESIÓN DE ENTRENAMIENTO
  async startTrainingSession(exerciseType: string): Promise<string | null> {
    try {
      console.log('🔍 startTrainingSession() iniciado');
      
      const userId = await this.auth.getCurrentUserId();
      console.log('🔍 Usuario ID:', userId);
      
      if (!userId) {
        console.warn('📸 No hay usuario autenticado');
        return null;
      }

      const sessionData: Omit<TrainingSession, 'id'> = {
        userId,
        exerciseType,
        startTime: new Date(),
        errorsDetected: 0,
        capturesTaken: 0
      };

      console.log('🔍 Creando sesión en Firestore...');
      
      const docRef = await this.db.collection('training-sessions').add(sessionData);
      
      console.log('✅ Sesión creada con ID:', docRef.id);
      
      this.currentSession = {
        id: docRef.id,
        ...sessionData
      };

      this.capturedErrorsInSession.clear();
      this.lastCaptureTime = 0;

      console.log('✅ 📸 Sesión de entrenamiento iniciada exitosamente');
      return docRef.id;
      
    } catch (error) {
      console.error('🛑 Error iniciando sesión:', error);
      return null;
    }
  }

  // ✅ CAPTURA AUTOMÁTICA - FIRMA CORREGIDA
  async captureErrorIfNeeded(
    canvas: HTMLCanvasElement,
    videoElement: HTMLVideoElement, // 👈 PARÁMETRO AGREGADO
    errorType: string,
    severity: string,
    biomechanicsData?: any
  ): Promise<boolean> {
    
    if (!this.currentSession) {
      console.warn('📸 No hay sesión activa para captura');
      return false;
    }

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
      console.log('📸 Límite de capturas alcanzado');
      return false;
    }

    if (now - this.lastCaptureTime < this.MIN_TIME_BETWEEN_CAPTURES) {
      console.log('📸 Cooldown activo');
      return false;
    }

    // ✅ VERIFICAR QUE EL VIDEO ESTÉ LISTO
    if (!videoElement || videoElement.readyState < 2) {
      console.warn('⚠️ Video no está listo para captura');
      return false;
    }

    try {
      console.log(`📸 Iniciando captura para ${errorType}...`);

      // 1. Crear alerta
      const alertId = await this.createCriticalAlert(errorType, severity, biomechanicsData);
      if (!alertId) return false;

      // 2. Capturar y subir imagen - AHORA CON VIDEO Y ERRORTYPE
      const captureUrl = await this.performCapture(canvas, videoElement, alertId, errorType);
      if (!captureUrl) return false;

      // 3. Actualizar alerta con URL
      await this.updateAlertWithCapture(alertId, captureUrl);

      // 4. Actualizar sesión
      this.capturedErrorsInSession.add(errorKey);
      this.lastCaptureTime = now;
      
      if (this.currentSession.id) {
        await this.db.collection('training-sessions')
          .doc(this.currentSession.id)
          .update({
            errorsDetected: (this.currentSession.errorsDetected || 0) + 1,
            capturesTaken: (this.currentSession.capturesTaken || 0) + 1
          });
        
        this.currentSession.errorsDetected = (this.currentSession.errorsDetected || 0) + 1;
        this.currentSession.capturesTaken = (this.currentSession.capturesTaken || 0) + 1;
      }

      console.log(`✅ Captura exitosa! URL: ${captureUrl}`);
      return true;

    } catch (error) {
      console.error('🛑 Error durante captura:', error);
      return false;
    }
  }

  // ✅ CREAR ALERTA CRÍTICA
  private async createCriticalAlert(
    errorType: string,
    severity: string,
    biomechanicsData?: any
  ): Promise<string | null> {
    try {
      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return null;

      const alertData: Omit<CriticalAlert, 'id'> = {
        uid: userId,
        errorType,
        severity,
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
        captureURL: '',
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenResolution: `${screen.width}x${screen.height}`
        }
      };

      const docRef = await this.db.collection('criticalAlerts').add(alertData);
      console.log('🚨 Alerta creada con ID:', docRef.id);
      return docRef.id;

    } catch (error) {
      console.error('🛑 Error creando alerta:', error);
      return null;
    }
  }

  // ✅ ACTUALIZAR ALERTA CON URL
  private async updateAlertWithCapture(alertId: string, captureUrl: string): Promise<void> {
    try {
      await this.db.collection('criticalAlerts').doc(alertId).update({
        captureURL: captureUrl,
        hasCaptureImage: true,
        captureTimestamp: new Date()
      });
      
      console.log(`✅ Alerta ${alertId} actualizada con captureURL`);
    } catch (error) {
      console.error('❌ Error actualizando alerta:', error);
      throw error;
    }
  }

  // ✅ CAPTURAR Y SUBIR IMAGEN - FIRMA CORREGIDA CON ERRORTYPE
  private async performCapture(
    canvas: HTMLCanvasElement,
    videoElement: HTMLVideoElement,
    alertId: string,
    errorType: string // 👈 PARÁMETRO AGREGADO
  ): Promise<string | null> {
    try {
      // 🎨 CREAR CANVAS TEMPORAL PARA COMPOSICIÓN
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = videoElement.videoWidth;
      captureCanvas.height = videoElement.videoHeight;
      const ctx = captureCanvas.getContext('2d');
      
      if (!ctx) {
        console.error('❌ No se pudo crear contexto 2D');
        return null;
      }

      // 1️⃣ DIBUJAR VIDEO REAL DE FONDO
      ctx.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);

      // 2️⃣ DIBUJAR ESQUELETO ENCIMA (con transparencia)
      ctx.globalAlpha = 0.7; // Esqueleto semi-transparente
      ctx.drawImage(canvas, 0, 0, captureCanvas.width, captureCanvas.height);
      ctx.globalAlpha = 1.0; // Restaurar opacidad

      // 3️⃣ AGREGAR MARCA DE TIEMPO Y TIPO DE ERROR
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fillRect(10, 10, 400, 60);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`⚠️ ERROR: ${errorType}`, 20, 40); // 👈 AHORA EXISTE errorType
      ctx.font = '16px Arial';
      ctx.fillText(new Date().toLocaleString(), 20, 60);

      // 4️⃣ CONVERTIR A BLOB
      const blob = await this.canvasToBlob(captureCanvas);
      if (!blob) return null;

      // 5️⃣ SUBIR A FIREBASE STORAGE
      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return null;

      const timestamp = Date.now();
      const filename = `error_${alertId}_${timestamp}.png`;
      const storagePath = `captures/${userId}/${this.currentSession.id}/${filename}`;

      const uploadTask = this.storage.upload(storagePath, blob, {
        customMetadata: {
          errorId: alertId,
          errorType: errorType,
          sessionId: this.currentSession.id!,
          uploadedAt: new Date().toISOString()
        }
      });

      await uploadTask;
      const downloadURL = await this.storage.ref(storagePath).getDownloadURL().toPromise();
      
      console.log(`📸 Imagen compuesta subida: ${filename}`);
      return downloadURL;

    } catch (error) {
      console.error('🛑 Error en captura:', error);
      return null;
    }
  }

  // ✅ CONVERTIR CANVAS A BLOB
  private async canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          console.error('❌ No se pudo crear blob del canvas');
          resolve(null);
        }
      }, 'image/png', 0.95);
    });
  }

  // ✅ FINALIZAR SESIÓN
  async endTrainingSession(): Promise<void> {
    if (!this.currentSession?.id) return;

    try {
      await this.db.collection('training-sessions')
        .doc(this.currentSession.id)
        .update({
          endTime: new Date(),
          completed: true
        });

      console.log('📸 Sesión finalizada:', this.currentSession.id);
      this.currentSession = null;
      this.capturedErrorsInSession.clear();

    } catch (error) {
      console.error('🛑 Error finalizando sesión:', error);
    }
  }

  // ✅ VERIFICAR SI PUEDE CAPTURAR ERROR
  canCaptureError(errorType: string): boolean {
    if (!this.currentSession) return false;
    
    const errorKey = `${errorType}_${this.currentSession.exerciseType}`;
    return !this.capturedErrorsInSession.has(errorKey);
  }

  // ✅ OBTENER ESTADÍSTICAS DE SESIÓN
  getSessionStats() {
    return {
      capturesTaken: this.currentSession?.capturesTaken || 0,
      maxCaptures: this.MAX_CAPTURES_PER_SESSION,
      errorsDetected: this.currentSession?.errorsDetected || 0
    };
  }
}