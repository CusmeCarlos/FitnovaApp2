// src/app/services/error-reduction.service.ts
// Servicio para tracking de reducción de errores entre sesiones

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AuthService } from './auth.service';

export interface ExerciseSession {
  sessionNumber: number; // 1, 2, 3, etc.
  timestamp: Date;
  errorsCount: number;
  weekNumber: number;
  year: number;
  errorReduction?: number; // Solo para sesión 2: errores_sesion1 - errores_sesion2
}

export interface ExerciseProgress {
  uid: string;
  exerciseId: string;
  exerciseName: string;
  sessions: ExerciseSession[];
  lastSession: number; // Número de la última sesión
  updatedAt: Date;
}

export interface WeeklyProgress {
  uid: string;
  weekNumber: number;
  year: number;
  totalErrorsReduced: number; // Solo segundas sesiones
  exercises: {
    exerciseId: string;
    exerciseName: string;
    session1Errors: number;
    session2Errors: number;
    errorReduction: number;
  }[];
  createdAt: Date;
}

export interface CurrentWeekSummary {
  weekNumber: number;
  year: number;
  totalErrorsReduced: number;
  exerciseCount: number;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    session1Errors: number;
    session2Errors: number;
    errorReduction: number;
  }[];
}

export interface HistoricalWeek {
  weekNumber: number;
  year: number;
  weekLabel: string; // "Semana 1, 2024"
  totalErrorsReduced: number;
  exerciseCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorReductionService {
  private db = firebase.firestore();
  private currentWeekSubject = new BehaviorSubject<CurrentWeekSummary | null>(null);

  constructor(private auth: AuthService) {}

  /**
   * Registrar una sesión de ejercicio y calcular reducción de errores
   */
  async recordExerciseSession(
    exerciseId: string,
    exerciseName: string,
    errorsCount: number
  ): Promise<{
    isFirstSession: boolean;
    isSecondSession: boolean;
    sessionNumber: number;
    message: string;
    errorReduction?: number;
    session1Errors?: number;
  }> {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { weekNumber, year } = this.getCurrentWeekYear();

      // Buscar el progreso existente del ejercicio
      const progressRef = this.db
        .collection('exerciseProgressTracking')
        .where('uid', '==', user.uid)
        .where('exerciseId', '==', exerciseId);

      const progressSnapshot = await progressRef.get();

      let exerciseProgress: ExerciseProgress;
      let progressDocId: string | null = null;

      if (progressSnapshot.empty) {
        // Primera sesión del ejercicio
        exerciseProgress = {
          uid: user.uid,
          exerciseId: exerciseId,
          exerciseName: exerciseName,
          sessions: [],
          lastSession: 0,
          updatedAt: new Date()
        };
      } else {
        // Ejercicio ya tiene sesiones previas
        progressDocId = progressSnapshot.docs[0].id;
        const data = progressSnapshot.docs[0].data();
        exerciseProgress = {
          uid: data['uid'],
          exerciseId: data['exerciseId'],
          exerciseName: data['exerciseName'],
          sessions: (data['sessions'] || []).map((s: any) => ({
            ...s,
            timestamp: s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp)
          })),
          lastSession: data['lastSession'] || 0,
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date()
        };
      }

      const sessionNumber = exerciseProgress.lastSession + 1;
      const isFirstSession = sessionNumber === 1;
      const isSecondSession = sessionNumber === 2;

      let errorReduction: number | undefined = undefined;
      let session1Errors: number | undefined = undefined;

      // Crear nueva sesión
      const newSession: ExerciseSession = {
        sessionNumber,
        timestamp: new Date(),
        errorsCount,
        weekNumber,
        year
      };

      // Si es la segunda sesión, calcular reducción de errores
      if (isSecondSession && exerciseProgress.sessions.length > 0) {
        const firstSession = exerciseProgress.sessions.find(s => s.sessionNumber === 1);
        if (firstSession) {
          errorReduction = firstSession.errorsCount - errorsCount;
          newSession.errorReduction = errorReduction;
          session1Errors = firstSession.errorsCount;

          // Actualizar progreso semanal solo para segunda sesión
          await this.updateWeeklyProgress(
            user.uid,
            exerciseId,
            exerciseName,
            firstSession.errorsCount,
            errorsCount,
            errorReduction,
            weekNumber,
            year
          );
        }
      }

      // Agregar nueva sesión al progreso
      exerciseProgress.sessions.push(newSession);
      exerciseProgress.lastSession = sessionNumber;
      exerciseProgress.updatedAt = new Date();

      // Guardar en Firestore
      if (progressDocId) {
        await this.db.collection('exerciseProgressTracking').doc(progressDocId).update({
          sessions: exerciseProgress.sessions,
          lastSession: sessionNumber,
          updatedAt: firebase.firestore.Timestamp.now()
        });
      } else {
        await this.db.collection('exerciseProgressTracking').add({
          uid: exerciseProgress.uid,
          exerciseId: exerciseProgress.exerciseId,
          exerciseName: exerciseProgress.exerciseName,
          sessions: exerciseProgress.sessions,
          lastSession: sessionNumber,
          updatedAt: firebase.firestore.Timestamp.now()
        });
      }

      // Construir mensaje
      let message = '';
      if (isFirstSession) {
        message = `Primera sesión completada: ${errorsCount} errores detectados`;
      } else if (isSecondSession && errorReduction !== undefined && session1Errors !== undefined) {
        message = `¡Progreso! Primera sesión: ${session1Errors} errores → Segunda sesión: ${errorsCount} errores = Mejoraste ${errorReduction} errores`;
      } else {
        message = `Sesión ${sessionNumber} completada: ${errorsCount} errores detectados`;
      }

      // Actualizar el resumen de la semana actual
      await this.loadCurrentWeekSummary();

      console.log('✅ Sesión registrada:', { sessionNumber, isFirstSession, isSecondSession, errorReduction });

      return {
        isFirstSession,
        isSecondSession,
        sessionNumber,
        message,
        errorReduction,
        session1Errors
      };

    } catch (error) {
      console.error('❌ Error registrando sesión de ejercicio:', error);
      throw error;
    }
  }

  /**
   * Actualizar progreso semanal (solo para segundas sesiones)
   */
  private async updateWeeklyProgress(
    uid: string,
    exerciseId: string,
    exerciseName: string,
    session1Errors: number,
    session2Errors: number,
    errorReduction: number,
    weekNumber: number,
    year: number
  ): Promise<void> {
    try {
      const weekRef = this.db
        .collection('weeklyErrorReduction')
        .where('uid', '==', uid)
        .where('weekNumber', '==', weekNumber)
        .where('year', '==', year);

      const weekSnapshot = await weekRef.get();

      if (weekSnapshot.empty) {
        // Crear nueva semana
        const newWeek: WeeklyProgress = {
          uid,
          weekNumber,
          year,
          totalErrorsReduced: errorReduction,
          exercises: [{
            exerciseId,
            exerciseName,
            session1Errors,
            session2Errors,
            errorReduction
          }],
          createdAt: new Date()
        };

        await this.db.collection('weeklyErrorReduction').add(newWeek);
      } else {
        // Actualizar semana existente
        const weekDocId = weekSnapshot.docs[0].id;
        const weekData = weekSnapshot.docs[0].data() as WeeklyProgress;

        // Verificar si el ejercicio ya existe
        const existingExerciseIndex = weekData.exercises.findIndex(
          e => e.exerciseId === exerciseId
        );

        if (existingExerciseIndex >= 0) {
          // Actualizar ejercicio existente (por si repite segunda sesión)
          weekData.exercises[existingExerciseIndex] = {
            exerciseId,
            exerciseName,
            session1Errors,
            session2Errors,
            errorReduction
          };
        } else {
          // Agregar nuevo ejercicio
          weekData.exercises.push({
            exerciseId,
            exerciseName,
            session1Errors,
            session2Errors,
            errorReduction
          });
        }

        // Recalcular total
        weekData.totalErrorsReduced = weekData.exercises.reduce(
          (sum, ex) => sum + ex.errorReduction,
          0
        );

        await this.db.collection('weeklyErrorReduction').doc(weekDocId).update({
          exercises: weekData.exercises,
          totalErrorsReduced: weekData.totalErrorsReduced
        });
      }

      console.log('✅ Progreso semanal actualizado');
    } catch (error) {
      console.error('❌ Error actualizando progreso semanal:', error);
    }
  }

  /**
   * Obtener resumen de la semana actual
   */
  async getCurrentWeekSummary(): Promise<CurrentWeekSummary> {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { weekNumber, year } = this.getCurrentWeekYear();

      const weekRef = this.db
        .collection('weeklyErrorReduction')
        .where('uid', '==', user.uid)
        .where('weekNumber', '==', weekNumber)
        .where('year', '==', year);

      const weekSnapshot = await weekRef.get();

      if (weekSnapshot.empty) {
        return {
          weekNumber,
          year,
          totalErrorsReduced: 0,
          exerciseCount: 0,
          exercises: []
        };
      }

      const weekData = weekSnapshot.docs[0].data() as WeeklyProgress;

      return {
        weekNumber,
        year,
        totalErrorsReduced: weekData.totalErrorsReduced,
        exerciseCount: weekData.exercises.length,
        exercises: weekData.exercises
      };

    } catch (error) {
      console.error('❌ Error obteniendo resumen semanal:', error);
      return {
        weekNumber: 0,
        year: 0,
        totalErrorsReduced: 0,
        exerciseCount: 0,
        exercises: []
      };
    }
  }

  /**
   * Cargar resumen de la semana actual y emitirlo
   */
  async loadCurrentWeekSummary(): Promise<void> {
    const summary = await this.getCurrentWeekSummary();
    this.currentWeekSubject.next(summary);
  }

  /**
   * Observable del resumen de la semana actual
   */
  getCurrentWeek$(): Observable<CurrentWeekSummary | null> {
    return this.currentWeekSubject.asObservable();
  }

  /**
   * Obtener historial de semanas anteriores
   */
  async getHistoricalWeeks(): Promise<HistoricalWeek[]> {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { weekNumber: currentWeek, year: currentYear } = this.getCurrentWeekYear();

      const weeksRef = this.db
        .collection('weeklyErrorReduction')
        .where('uid', '==', user.uid)
        .orderBy('year', 'desc')
        .orderBy('weekNumber', 'desc');

      const weeksSnapshot = await weeksRef.get();

      const historicalWeeks: HistoricalWeek[] = [];

      weeksSnapshot.docs.forEach(doc => {
        const data = doc.data() as WeeklyProgress;

        // Excluir la semana actual
        if (data.year === currentYear && data.weekNumber === currentWeek) {
          return;
        }

        historicalWeeks.push({
          weekNumber: data.weekNumber,
          year: data.year,
          weekLabel: `Semana ${data.weekNumber}, ${data.year}`,
          totalErrorsReduced: data.totalErrorsReduced,
          exerciseCount: data.exercises.length
        });
      });

      console.log('📊 Historial de semanas cargado:', historicalWeeks.length);
      return historicalWeeks;

    } catch (error) {
      console.error('❌ Error obteniendo historial de semanas:', error);
      return [];
    }
  }

  /**
   * Obtener número de semana y año actual
   */
  private getCurrentWeekYear(): { weekNumber: number; year: number } {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const year = now.getFullYear();

    return { weekNumber, year };
  }

  /**
   * Resetear progreso (solo para testing)
   */
  async resetAllProgress(): Promise<void> {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Eliminar progreso de ejercicios
      const progressSnapshot = await this.db
        .collection('exerciseProgressTracking')
        .where('uid', '==', user.uid)
        .get();

      const batch1 = this.db.batch();
      progressSnapshot.docs.forEach(doc => {
        batch1.delete(doc.ref);
      });
      await batch1.commit();

      // Eliminar progreso semanal
      const weeksSnapshot = await this.db
        .collection('weeklyErrorReduction')
        .where('uid', '==', user.uid)
        .get();

      const batch2 = this.db.batch();
      weeksSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
      });
      await batch2.commit();

      // Limpiar subject
      this.currentWeekSubject.next(null);

      console.log('✅ Todo el progreso ha sido reseteado');
    } catch (error) {
      console.error('❌ Error reseteando progreso:', error);
      throw error;
    }
  }
}
