// src/app/services/cloud-functions.service.ts
// ☁️ CLOUDFUNCTIONSSERVICE - BRIDGE MÓVIL <-> CLOUD FUNCTIONS

import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ErrorHandlerService } from './error-handler.service';
import { AuthService } from './auth.service';
import { take } from 'rxjs/operators';

export interface CloudFunctionResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp?: Date;
}

export interface ProcessAlertRequest {
  alertId: string;
  uid: string;
  userEmail: string;
  userDisplayName: string;
  errorType: string;
  exercise: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  captureURL?: string;
  sessionId: string;
  biomechanicsData?: any;
  deviceInfo?: any;
}

export interface GenerateRoutineRequest {
  uid: string;
  userProfile: any;
  fitnessLevel: string;
  goals: string[];
  medicalHistory: any;
  currentRoutine?: any;
}

export interface RoutineResponse {
  routineId: string;
  exercises: any[];
  duration: number;
  difficulty: string;
  adaptations: string[];
  needsTrainerApproval: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CloudFunctionsService {

  constructor(
    private functions: AngularFireFunctions,
    private errorHandler: ErrorHandlerService,
    private auth: AuthService
  ) {}

  // ✅ PROCESAR ALERTA CRÍTICA AL ENTRENADOR
  async processTrainerAlert(alertData: ProcessAlertRequest): Promise<CloudFunctionResponse> {
    try {
      const processAlert = this.functions.httpsCallable('processTrainerAlert');
      const result = await processAlert(alertData).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error:any) {
      console.error('🛑 Error procesando alerta:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido procesando alerta',
        timestamp: new Date()
      };
    }
  }

  // ✅ ENVIAR NOTIFICACIÓN FCM AL ENTRENADOR
  async sendTrainerNotification(alertData: ProcessAlertRequest): Promise<CloudFunctionResponse> {
    try {
      const sendNotification = this.functions.httpsCallable('sendTrainerNotification');
      const result = await sendNotification(alertData).toPromise();
      
      console.log('🔔 Notificación enviada al entrenador:', result);
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error('🛑 Error enviando notificación:', error);
      return {
        success: false,
        error: error.message || 'Error enviando notificación',
        timestamp: new Date()
      };
    }
  }

  async generateAdaptiveRoutine(profileData: any): Promise<CloudFunctionResponse> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }
  
      const requestData = {
        userId: user.uid,
        personalInfo: profileData.personalInfo || {},
        medicalHistory: profileData.medicalHistory || {},
        fitnessGoals: profileData.fitnessGoals || {},
        fitnessLevel: profileData.fitnessLevel || 'beginner',
        trainingPreferences: profileData.trainingPreferences || {}
      };
  
      console.log('📤 Enviando a Cloud Function:', requestData);
  
      const generateRoutine = this.functions.httpsCallable('generateAdaptiveRoutine');
      const result = await generateRoutine(requestData).toPromise();
      
      console.log('📥 Respuesta Cloud Function:', result);
      
      // La respuesta de Cloud Functions viene en result directamente, no en result.data
      return {
        success: true,
        data: result,  // result ES la respuesta de la Cloud Function
        timestamp: new Date()
      };
      
    } catch (error: any) {
      console.error('❌ Error detallado:', error);
      return {
        success: false,
        error: error.message || 'Error generando rutina',
        timestamp: new Date()
      };
    }
  }

  // ✅ PROCESAR ANÁLISIS BIOMECÁNICO AVANZADO
  async processBiomechanicsAnalysis(analysisData: any): Promise<CloudFunctionResponse> {
    try {
      const processBiomechanics = this.functions.httpsCallable('processBiomechanicsAnalysis');
      const result = await processBiomechanics(analysisData).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error('🛑 Error en análisis biomecánico:', error);
      return {
        success: false,
        error: error.message || 'Error en análisis biomecánico',
        timestamp: new Date()
      };
    }
  }

  // ✅ SOLICITAR APROBACIÓN DE RUTINA AL ENTRENADOR
  async requestRoutineApproval(routineData: any): Promise<CloudFunctionResponse> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const approvalRequest = {
        uid: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName,
        routineData,
        requestedAt: new Date()
      };

      const requestApproval = this.functions.httpsCallable('requestRoutineApproval');
      const result = await requestApproval(approvalRequest).toPromise();
      
      console.log('📋 Solicitud de aprobación enviada:', result);
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error:any) {
      console.error('🛑 Error solicitando aprobación:', error);
      return {
        success: false,
        error: error.message || 'Error solicitando aprobación',
        timestamp: new Date()
      };
    }
  }

  // ✅ SINCRONIZAR DATOS CON APLICACIÓN WEB
  async syncWithWebApp(syncData: any): Promise<CloudFunctionResponse> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const syncRequest = {
        uid: user.uid,
        mobileData: syncData,
        syncTimestamp: new Date(),
        platform: 'mobile'
      };

      const syncFunction = this.functions.httpsCallable('syncMobileData');
      const result = await syncFunction(syncRequest).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error:any) {
      console.error('🛑 Error sincronizando datos:', error);
      return {
        success: false,
        error: error.message || 'Error sincronizando datos',
        timestamp: new Date()
      };
    }
  }

  // ✅ OBTENER CONFIGURACIÓN GLOBAL DE LA IA
  async getAIConfiguration(): Promise<CloudFunctionResponse> {
    try {
      const getConfig = this.functions.httpsCallable('getAIConfiguration');
      const result = await getConfig({}).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error:any) {
      console.error('🛑 Error obteniendo configuración IA:', error);
      return {
        success: false,
        error: error.message || 'Error obteniendo configuración',
        timestamp: new Date()
      };
    }
  }

  // ✅ REPORTAR MÉTRICAS DE USO
  async reportUsageMetrics(metricsData: any): Promise<CloudFunctionResponse> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const metricsRequest = {
        uid: user.uid,
        metrics: metricsData,
        reportedAt: new Date(),
        platform: 'mobile'
      };

      const reportMetrics = this.functions.httpsCallable('reportUsageMetrics');
      const result = await reportMetrics(metricsRequest).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error:any) {
      console.error('🛑 Error reportando métricas:', error);
      return {
        success: false,
        error: error.functionName || 'Error reportando métricas',
        timestamp: new Date()
      };
    }
  }

  // ✅ OBTENER ESTADO DE CONEXIÓN CON ENTRENADOR
  async getTrainerConnectionStatus(): Promise<CloudFunctionResponse> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const getStatus = this.functions.httpsCallable('getTrainerConnectionStatus');
      const result = await getStatus({ uid: user.uid }).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error: any) {
        console.error('🛑 Error obteniendo estado del entrenador:', error);
        return {
          success: false,
          error: error?.message || 'Error obteniendo estado del entrenador',
          timestamp: new Date()
        };
      }
  }

  // ✅ FUNCIÓN GENÉRICA PARA LLAMAR CUALQUIER CLOUD FUNCTION
  async callFunction(functionName: string, data: any): Promise<CloudFunctionResponse> {
    try {
      const cloudFunction = this.functions.httpsCallable(functionName);
      const result = await cloudFunction(data).toPromise();
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error: any) {
        console.error(`🛑 Error llamando función ${functionName}:`, error);
        const errorMessage = error?.message || `Error en función ${functionName}`;
        return {
          success: false,
          error: errorMessage,
          timestamp: new Date()
        };
      }
  }

  // ✅ VERIFICAR CONECTIVIDAD CON CLOUD FUNCTIONS
  async testConnection(): Promise<boolean> {
    try {
      const testFunction = this.functions.httpsCallable('ping');
      const result = await testFunction({ timestamp: new Date() }).toPromise();
      console.log('☁️ Conexión con Cloud Functions OK:', result);
      return true;
    } catch (error) {
      console.error('🛑 Error de conectividad con Cloud Functions:', error);
      return false;
    }
  }
}