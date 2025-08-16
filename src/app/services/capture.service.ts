// src/app/services/capture.service.ts
// 📸 CAPTURESERVICE - COMPATIBLE CON REGLAS FIRESTORE EXISTENTES

import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';
import { take } from 'rxjs/operators';

// ✅ INTERFACES COMPATIBLES CON TUS REGLAS
export interface CriticalError {
  id?: string;
  userId: string;
  errorType: string;
  severity: number; // 1-10 según tus reglas
  timestamp: any; // Firestore timestamp
  exerciseType: string;
  sessionId: string;
  biomechanicsData?: any;
  deviceInfo?: any;
  reviewed?: boolean;
  trainerNotes?: string;
  reviewedAt?: any;
}

export interface ErrorCapture {
  id?: string;
  userId: string;
  errorId: string;
  captureUrl: string;
  timestamp: any; // Firestore timestamp
  storagePath: string;
  sessionId: string;
  metadata?: any;
}

export interface TrainingSession {
  id?: string;
  userId: string;
  exerciseType: string;
  startTime: any; // Firestore timestamp
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
  private capturedErrorsInSession = new Set<string>(); // Para evitar duplicados
  private readonly MAX_CAPTURES_PER_SESSION = 3; // Límite conservador
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

      // ✅ CREAR SESIÓN SEGÚN TUS REGLAS
      const sessionData: Omit<TrainingSession, 'id'> = {
        userId,
        exerciseType,
        startTime: new Date(), // Firestore lo convertirá a timestamp
        errorsDetected: 0,
        capturesTaken: 0
      };

      const sessionRef = await this.firestore.collection('training-sessions').add(sessionData);
      
      this.currentSession = {
        id: sessionRef.id,
        ...sessionData
      };

      // ✅ LIMPIAR ESTADO DE SESIÓN ANTERIOR
      this.capturedErrorsInSession.clear();
      this.lastCaptureTime = 0;

      console.log('📸 Sesión de entrenamiento iniciada:', sessionRef.id);
      return sessionRef.id;
      
    } catch (error) {
      console.error('🛑 Error iniciando sesión de entrenamiento:', error);
      return null;
    }
  }

  // ✅ CAPTURA AUTOMÁTICA ÚNICA POR ERROR EN SESIÓN
  async captureErrorIfNeeded(
    canvas: HTMLCanvasElement,
    errorType: string,
    severity: number, // 1-10 según tus reglas
    biomechanicsData?: any
  ): Promise<boolean> {
    
    // ✅ VALIDACIONES PREVIAS
    if (!this.currentSession) {
      console.warn('📸 No hay sesión activa para captura');
      return false;
    }

    // ✅ SOLO CAPTURAR ERRORES CRÍTICOS (severity >= 7)
    if (severity < 7) {
      return false;
    }

    // ✅ VERIFICAR SI YA SE CAPTURÓ ESTE ERROR EN LA SESIÓN
    const errorKey = `${errorType}_${this.currentSession.exerciseType}`;
    if (this.capturedErrorsInSession.has(errorKey)) {
      console.log(`📸 Error ${errorKey} ya capturado en esta sesión`);
      return false;
    }

    // ✅ VERIFICAR LÍMITES DE TIEMPO Y CANTIDAD
    const now = Date.now();
    if ((this.currentSession.capturesTaken || 0) + this.MAX_CAPTURES_PER_SESSION >= this.MAX_CAPTURES_PER_SESSION) {
      console.log('📸 Límite de capturas por sesión alcanzado');
      return false;
    }

    if (now - this.lastCaptureTime < this.MIN_TIME_BETWEEN_CAPTURES) {
      console.log('📸 Muy pronto para otra captura');
      return false;
    }

    try {
      // ✅ 1. CREAR ERROR CRÍTICO EN FIRESTORE
      const errorId = await this.createCriticalError(errorType, severity, biomechanicsData);
      if (!errorId) return false;

      // ✅ 2. REALIZAR CAPTURA Y SUBIR A STORAGE
      const captureUrl = await this.performCapture(canvas, errorId);
      if (!captureUrl) return false;

      // ✅ 3. REGISTRAR CAPTURA EN FIRESTORE
      await this.createErrorCapture(errorId, captureUrl);

      // ✅ 4. ACTUALIZAR ESTADO DE SESIÓN
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

      console.log(`📸 Captura exitosa: ${errorType} (severity: ${severity})`);
      return true;

    } catch (error) {
      console.error('🛑 Error durante captura:', error);
      return false;
    }
  }

  // ✅ CREAR ERROR CRÍTICO SEGÚN TUS REGLAS
  private async createCriticalError(
    errorType: string,
    severity: number,
    biomechanicsData?: any
  ): Promise<string | null> {
    try {
      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return null;

      const errorData: Omit<CriticalError, 'id'> = {
        userId,
        errorType,
        severity,
        timestamp: new Date(), // Firestore timestamp
        exerciseType: this.currentSession.exerciseType,
        sessionId: this.currentSession.id!,
        biomechanicsData,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenResolution: `${screen.width}x${screen.height}`
        },
        reviewed: false
      };

      const errorRef = await this.firestore.collection('critical-errors').add(errorData);
      console.log('🚨 Error crítico registrado:', errorRef.id);
      return errorRef.id;

    } catch (error) {
      console.error('🛑 Error creando error crítico:', error);
      return null;
    }
  }

  // ✅ REALIZAR CAPTURA Y SUBIR A STORAGE
  private async performCapture(canvas: HTMLCanvasElement, errorId: string): Promise<string | null> {
    try {
      // ✅ CONVERTIR CANVAS A BLOB
      const blob = await this.canvasToBlob(canvas);
      if (!blob) return null;

      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return null;

      // ✅ GENERAR PATH ÚNICO
      const timestamp = Date.now();
      const filename = `error_${errorId}_${timestamp}.png`;
      const storagePath = `captures/${userId}/${this.currentSession.id}/${filename}`;

      // ✅ SUBIR A CLOUD STORAGE
      const uploadTask = this.storage.upload(storagePath, blob, {
        customMetadata: {
          errorId,
          errorType: 'critical',
          sessionId: this.currentSession.id!,
          uploadedAt: new Date().toISOString()
        }
      });

      await uploadTask;
      
      // ✅ OBTENER URL DE DESCARGA
      const downloadURL = await this.storage.ref(storagePath).getDownloadURL().toPromise();
      
      console.log(`📸 Imagen subida: ${filename}`);
      return downloadURL;

    } catch (error) {
      console.error('🛑 Error en captura:', error);
      return null;
    }
  }

  // ✅ REGISTRAR CAPTURA EN FIRESTORE
  private async createErrorCapture(errorId: string, captureUrl: string): Promise<void> {
    try {
      const userId = await this.auth.getCurrentUserId();
      if (!userId || !this.currentSession) return;

      const captureData: Omit<ErrorCapture, 'id'> = {
        userId,
        errorId,
        captureUrl,
        timestamp: new Date(), // Firestore timestamp
        storagePath: captureUrl,
        sessionId: this.currentSession.id!
      };

      await this.firestore.collection('error-captures').add(captureData);
      console.log('📸 Captura registrada en Firestore');

    } catch (error) {
      console.error('🛑 Error registrando captura:', error);
    }
  }

  // ✅ FINALIZAR SESIÓN DE ENTRENAMIENTO
  async endTrainingSession(): Promise<void> {
    if (!this.currentSession || !this.currentSession.id) return;

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

  // ✅ MÉTODOS AUXILIARES
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
      sessionId: this.currentSession?.id,
      exerciseType: this.currentSession?.exerciseType,
      errorsDetected: this.currentSession?.errorsDetected || 0,
      capturesTaken: this.currentSession?.capturesTaken || 0,
      canCaptureMore: (this.currentSession?.capturesTaken || 0) < this.MAX_CAPTURES_PER_SESSION
    };
  }
}