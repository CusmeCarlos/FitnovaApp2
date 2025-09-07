// src/app/services/ai-routine.service.ts
// ✅ SERVICIO COMPLETO PARA RUTINAS ADAPTATIVAS IA

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';
import { CloudFunctionsService } from './cloud-functions.service';
import { ErrorHandlerService } from './error-handler.service';

import { 
  AIGeneratedRoutine, 
  AIRoutineRequest, 
  AIRoutineResponse, 
  Profile,
  AIExercise 
} from '../interfaces/profile.interface';
import { take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AiRoutineService {
  private readonly COLLECTION = 'aiRoutines';
  private readonly USER_ROUTINES_COLLECTION = 'userRoutines';
  
  private currentRoutineSubject = new BehaviorSubject<AIGeneratedRoutine | null>(null);
  public currentRoutine$ = this.currentRoutineSubject.asObservable();
  
  private routineHistorySubject = new BehaviorSubject<AIGeneratedRoutine[]>([]);
  public routineHistory$ = this.routineHistorySubject.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private auth: AuthService,
    private cloudFunctions: CloudFunctionsService,
    private errorHandler: ErrorHandlerService
  ) {
    this.initializeUserRoutines();
  }

  // ✅ INICIALIZAR RUTINAS DEL USUARIO
  private async initializeUserRoutines(): Promise<void> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) return;

      // Cargar rutina actual
      this.loadCurrentRoutine(user.uid);
      
      // Cargar historial
      this.loadRoutineHistory(user.uid);
    } catch (error) {
      console.error('❌ Error inicializando rutinas:', error);
    }
  }

  // ✅ CARGAR RUTINA ACTUAL
  private loadCurrentRoutine(uid: string): void {
    this.firestore
      .collection(this.COLLECTION)
      .doc(uid)
      .collection('routines', ref => 
        ref.where('status', '==', 'approved')
           .orderBy('approvedAt', 'desc')
           .limit(1)
      )
      .valueChanges({ idField: 'id' })
      .subscribe((routines: any[]) => {
        const currentRoutine = routines.length > 0 ? routines[0] : null;
        this.currentRoutineSubject.next(currentRoutine);
      });
  }

  // ✅ CARGAR HISTORIAL DE RUTINAS
  private loadRoutineHistory(uid: string): void {
    this.firestore
      .collection(this.COLLECTION)
      .doc(uid)
      .collection('routines', ref => 
        ref.orderBy('generatedAt', 'desc').limit(20)
      )
      .valueChanges({ idField: 'id' })
      .subscribe((routines: any[]) => {
        this.routineHistorySubject.next(routines);
      });
  }

  async generateAdaptiveRoutine(profileData: Profile): Promise<AIRoutineResponse> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) {
        throw new Error('Usuario no autenticado');
      }
  
      console.log('🧠 Iniciando generación de rutina IA...');
  
      if (!this.validateProfileForAI(profileData)) {
        return {
          success: false,
          error: 'Perfil incompleto para generar rutina IA',
          needsTrainerApproval: false,
          confidenceScore: 0
        };
      }
  
      const aiRequest: AIRoutineRequest = {
        userId: user.uid,
        personalInfo: profileData.personalInfo,
        medicalHistory: profileData.medicalHistory,
        fitnessGoals: profileData.fitnessGoals!,
        fitnessLevel: profileData.fitnessLevel,
        trainingPreferences: profileData.trainingPreferences,
        specialRequests: '',
        urgency: 'normal'
      };
  
              const cloudResponse = await this.cloudFunctions.generateAdaptiveRoutine(aiRequest);

        console.log('🔍 DEBUG - cloudResponse completo:', JSON.stringify(cloudResponse, null, 2));

        if (cloudResponse.success) {
          // La respuesta está directamente en cloudResponse.data, no anidada
          const responseData = cloudResponse.data;
          
          console.log('🔍 DEBUG - responseData:', JSON.stringify(responseData, null, 2));
          
          if (!responseData || !responseData.routine) {
            console.error('❌ Estructura de respuesta inválida:', responseData);
            throw new Error('La Cloud Function no devolvió una rutina válida');
          }
          
          // Guardar rutina localmente
          await this.saveGeneratedRoutine(user.uid, responseData.routine);

          console.log('✅ Rutina IA generada exitosamente');
          
          return {
            success: true,
            routineId: responseData.routineId || 'unknown',
            routine: responseData.routine,
            needsTrainerApproval: responseData.needsTrainerApproval || false,
            confidenceScore: responseData.aiConfidence || 0
          };
        } else {
          throw new Error(cloudResponse.error || 'Error desconocido en Cloud Function');
        }
  
    } catch (error: any) {
      console.error('❌ Error generando rutina IA:', error);
      await this.errorHandler.handleGeneralError(error, 'Error generando rutina IA');
      
      return {
        success: false,
        error: error.message || 'Error inesperado generando rutina',
        needsTrainerApproval: false,
        confidenceScore: 0
      };
    }
  }

  async getCurrentUserRoutine(): Promise<AIGeneratedRoutine | null> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) throw new Error('Usuario no autenticado');
  
      const routineDoc = await this.firestore
        .collection('aiRoutines')
        .doc(user.uid)
        .get()
        .toPromise();
  
      if (!routineDoc?.exists) {
        return null;
      }
  
      const data = routineDoc.data() as any;
      return {
        ...data,
        createdAt: data.createdAt,
        approvedAt: data.approvedAt
      } as AIGeneratedRoutine;
  
    } catch (error) {
      console.error('Error obteniendo rutina actual:', error);
      return null;
    }
  }
  
  // Establecer rutina activa para entrenamiento
  async setActiveRoutineForTraining(routine: AIGeneratedRoutine): Promise<void> {
    try {
      // Guardar en localStorage para Tab2
      localStorage.setItem('activeRoutine', JSON.stringify(routine));
      
      // Actualizar estado en Firestore
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (user) {
        await this.firestore
          .collection('aiRoutines')
          .doc(user.uid)
          .update({
            status: 'active',
            lastActiveAt: new Date()
          });
      }
    } catch (error) {
      console.error('Error activando rutina:', error);
    }
  }

  // ✅ VALIDAR PERFIL PARA IA
  private validateProfileForAI(profile: Profile): boolean {
    // Validar información personal básica
    if (!profile.personalInfo?.age || !profile.personalInfo?.weight || 
        !profile.personalInfo?.height || !profile.personalInfo?.gender) {
      return false;
    }

    // Validar capacidad física
    if (!profile.medicalHistory?.physicalCapacity?.walkingCapacity ||
        !profile.medicalHistory?.physicalCapacity?.stairsCapacity ||
        !profile.medicalHistory?.physicalCapacity?.weightExperience ||
        !profile.medicalHistory?.physicalCapacity?.energyLevel) {
      return false;
    }

    // Validar objetivos
    if (!profile.fitnessGoals?.primaryGoals?.length) {
      return false;
    }

    // Validar nivel fitness
    if (!profile.fitnessLevel) {
      return false;
    }

    return true;
  }
  private async saveGeneratedRoutine(uid: string, routineData: any): Promise<void> {
    console.log('💾 Guardando rutina:', routineData);
    
    const routineDoc = {
      ...routineData,
      userId: uid,
      generatedAt: new Date(),
      lastUpdated: new Date(),
      status: 'pending_approval'
    };
  
    // Usar Firebase directamente sin AngularFirestore
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');
    const db = getFirestore();
    const docRef = doc(db, this.COLLECTION, uid);
    
    await setDoc(docRef, routineDoc);
    console.log('💾 Rutina guardada correctamente');
  }
  // ✅ OBTENER RUTINA ACTUAL
  getCurrentRoutine(): Observable<AIGeneratedRoutine | null> {
    return this.currentRoutine$;
  }

  // ✅ OBTENER HISTORIAL DE RUTINAS
  getRoutineHistory(): Observable<AIGeneratedRoutine[]> {
    return this.routineHistory$;
  }

  // ✅ OBTENER RUTINA POR ID
  async getRoutineById(routineId: string): Promise<AIGeneratedRoutine | null> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) return null;

      const doc = await this.firestore
        .collection(this.COLLECTION)
        .doc(user.uid)
        .collection('routines')
        .doc(routineId)
        .get()
        .toPromise();

      if (doc && doc.exists) {
        return { id: doc.id, ...doc.data() } as AIGeneratedRoutine;
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo rutina:', error);
      return null;
    }
  }

  // ✅ SOLICITAR MODIFICACIÓN DE RUTINA
  async requestRoutineModification(routineId: string, modifications: string): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) return false;

      const modificationRequest = {
        routineId,
        userId: user.uid,
        modifications,
        requestedAt: new Date(),
        status: 'pending'
      };

      await this.firestore
        .collection('routineModifications')
        .add(modificationRequest);

      // Notificar al entrenador
      await this.cloudFunctions.sendTrainerNotification({
        alertId: 'routine_modification_' + Date.now(),
        uid: user.uid,
        userEmail: user.email || '',
        userDisplayName: user.displayName || 'Usuario',
        errorType: 'routine_modification_request',
        exercise: 'Rutina ID: ' + routineId,
        severity: 'medium' as any,
        sessionId: 'modification_request',
        biomechanicsData: { modifications }
      });

      return true;
    } catch (error) {
      console.error('❌ Error solicitando modificación:', error);
      return false;
    }
  }

  // ✅ MARCAR RUTINA COMO COMPLETADA
  async markRoutineAsCompleted(routineId: string, sessionData: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) return false;

      const completionData = {
        routineId,
        userId: user.uid,
        completedAt: new Date(),
        sessionData,
        performance: this.calculatePerformanceScore(sessionData)
      };

      await this.firestore
        .collection('completedRoutines')
        .add(completionData);

      // Actualizar estadísticas del usuario
      await this.updateUserStats(user.uid, completionData);

      return true;
    } catch (error) {
      console.error('❌ Error marcando rutina como completada:', error);
      return false;
    }
  }

  // ✅ CALCULAR PUNTUACIÓN DE RENDIMIENTO
  private calculatePerformanceScore(sessionData: any): number {
    // Algoritmo simple de puntuación basado en:
    // - Tiempo completado vs. estimado
    // - Errores cometidos
    // - Ejercicios completados
    
    let score = 100;
    
    if (sessionData.errors?.length > 0) {
      score -= sessionData.errors.length * 5;
    }
    
    if (sessionData.incompleteExercises > 0) {
      score -= sessionData.incompleteExercises * 10;
    }
    
    if (sessionData.timeOverrun > 0) {
      score -= Math.min(sessionData.timeOverrun / 60, 20); // Max 20 puntos por tiempo
    }
    
    return Math.max(score, 0);
  }

  // ✅ ACTUALIZAR ESTADÍSTICAS DEL USUARIO
  private async updateUserStats(uid: string, completionData: any): Promise<void> {
    try {
      const statsRef = this.firestore.collection('userStats').doc(uid);
      
      await this.firestore.firestore.runTransaction(async (transaction) => {
        const statsDoc = await transaction.get(statsRef.ref);
        
        if (statsDoc.exists) {
          const currentStats: any = statsDoc.data(); // ✅ AGREGAR TIPO
          const updatedStats = {
            ...currentStats,
            totalRoutinesCompleted: (currentStats?.totalRoutinesCompleted || 0) + 1,
            lastRoutineCompletion: new Date(),
            averagePerformance: this.calculateAveragePerformance(
              currentStats?.averagePerformance || 0,
              currentStats?.totalRoutinesCompleted || 0,
              completionData.performance
            ),
            lastUpdated: new Date()
          };
          
          transaction.update(statsRef.ref, updatedStats);
        }else {
          const newStats = {
            uid,
            totalRoutinesCompleted: 1,
            lastRoutineCompletion: new Date(),
            averagePerformance: completionData.performance,
            createdAt: new Date(),
            lastUpdated: new Date()
          };
          
          transaction.set(statsRef.ref, newStats);
        }
      });
      
    } catch (error) {
      console.error('❌ Error actualizando estadísticas:', error);
    }
  }

  // ✅ CALCULAR PROMEDIO DE RENDIMIENTO
  private calculateAveragePerformance(currentAvg: number, completedCount: number, newScore: number): number {
    if (completedCount === 0) return newScore;
    return Math.round(((currentAvg * completedCount) + newScore) / (completedCount + 1));
  }

  // ✅ OBTENER EJERCICIOS DE RUTINA ACTUAL
  async getCurrentRoutineExercises(): Promise<AIExercise[]> {
    try {
      const currentRoutine = await this.currentRoutine$.pipe(take(1)).toPromise();
      return currentRoutine?.routine?.exercises || [];
    } catch (error) {
      console.error('❌ Error obteniendo ejercicios:', error);
      return [];
    }
  }

  // ✅ SOLICITAR NUEVA RUTINA SI NO HAY ACTUAL
  async ensureUserHasRoutine(profileData: Profile): Promise<boolean> {
    try {
      const currentRoutine = await this.currentRoutine$.pipe(take(1)).toPromise();
      
      if (!currentRoutine) {
        console.log('🔄 Usuario sin rutina, generando automáticamente...');
        const result = await this.generateAdaptiveRoutine(profileData);
        return result.success;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error asegurando rutina del usuario:', error);
      return false;
    }
  }

  // ✅ VERIFICAR SI NECESITA NUEVA RUTINA
  needsNewRoutine(): Observable<boolean> {
    return new Observable(observer => {
      this.currentRoutine$.subscribe(routine => {
        if (!routine) {
          observer.next(true);
          return;
        }
        
        // Verificar si la rutina es muy antigua (más de 4 semanas)
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        
        const routineDate = routine.generatedAt instanceof Date ? 
          routine.generatedAt : 
          new Date(routine.generatedAt);
          
        observer.next(routineDate < fourWeeksAgo);
      });
    });
  }

  // ✅ OBTENER ESTADÍSTICAS DE RUTINAS
  async getRoutineStats(): Promise<any> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) return null;

      const stats = await this.firestore
        .collection('userStats')
        .doc(user.uid)
        .get()
        .toPromise();

      return stats?.exists ? stats.data() : null;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }

  // ✅ LIMPIAR RECURSOS
  destroy(): void {
    this.currentRoutineSubject.complete();
    this.routineHistorySubject.complete();
  }
}