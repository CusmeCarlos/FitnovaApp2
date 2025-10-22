// src/app/services/dashboard.service.ts - REEMPLAZAR COMPLETO
// 🔥 DASHBOARD SERVICE CON FIREBASE DIRECTO - SIN ANGULAR FIRE

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, map, catchError, of, switchMap, take } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastController } from '@ionic/angular';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import * as _ from 'lodash';

export interface UserStats {
  uid: string;
  lastCriticalError: any;
  totalCriticalErrors: number;
  lastErrorType: string;
  lastExercise: string;
  lastSessionId: string;
  accuracy?: number;
  weeklyGoalProgress?: number;
  totalWorkouts?: number;
  totalHours?: number;
  averageAccuracy?: number;
  weeklyStreak?: number;
  improvementRate?: number;
  lastSessionDurationSeconds?: number;
  totalSeconds?: number;
  lastSessionRepetitions?: number; // ← AGREGAR REPETICIONES
}

export interface CriticalAlert {
  id: string;
  uid: string;
  errorType: string;
  exercise: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  timestamp: any;
  processedAt: any;
  biomechanicsData: any;
  affectedJoints: string[];
  angles: any;
  captureURL: string;
  lastSessionId?: string;
}

export interface DashboardMetrics {
  totalWorkouts: number;
  accuracy: number;
  totalHours: number;
  weeklyImprovement: number;
  weeklyGoalProgress: number;
  currentStreak: number;
  criticalErrorsToday: number;
  mostCommonError: string;
  recentAlerts: CriticalAlert[];
  errorsByType: { [key: string]: number };
  weeklyProgress: { day: string; workouts: number; errors: number }[];
  accuracyTrend: { date: string; accuracy: number }[];
  exerciseStats: { exercise: string; count: number; avgAccuracy: number }[];
  isEmpty: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private userStatsSubject = new BehaviorSubject<UserStats | null>(null);
  private alertsSubject = new BehaviorSubject<CriticalAlert[]>([]);
  private db = firebase.firestore();

  constructor(
    private auth: AuthService,
    private toastController: ToastController
  ) {
    this.initializeService();
  }

  private initializeService(): void {
    // Escuchar cambios de usuario y cargar sus datos
    this.auth.user$.subscribe(user => {
      if (user?.uid) {
        this.loadUserData(user.uid);
      } else {
        this.userStatsSubject.next(null);
        this.alertsSubject.next([]);
      }
    });
  }
  // MÉTODO PARA RESETEAR COMPLETAMENTE EL DASHBOARD
  async resetDashboardData(): Promise<void> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        console.error('No hay usuario autenticado para resetear');
        return;
      }

      console.log('🔄 Reseteando dashboard completamente...');

      // Resetear userStats a cero
      const resetStats = {
        uid: user.uid,
        lastCriticalError: null,
        totalCriticalErrors: 0,
        lastErrorType: '',
        lastExercise: '',
        lastSessionId: '',
        accuracy: 0,
        weeklyGoalProgress: 0,
        totalWorkouts: 0,
        totalHours: 0,
        averageAccuracy: 0,
        weeklyStreak: 0,
        improvementRate: 0,
        lastSessionDurationSeconds: 0,
        totalSeconds: 0,
        updatedAt: firebase.firestore.Timestamp.now()
      };

      // Usar Firebase directo
      await this.db.collection('userStats').doc(user.uid).set(resetStats);

      // También limpiar alertas críticas si quieres
      const alertsSnapshot = await this.db.collection('criticalAlerts')
        .where('uid', '==', user.uid)
        .get();

      const batch = this.db.batch();
      alertsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (!alertsSnapshot.empty) {
        await batch.commit();
        console.log(`🗑️ Eliminadas ${alertsSnapshot.size} alertas críticas`);
      }

      console.log('✅ Dashboard reseteado completamente');
      await this.showSuccessToast('Dashboard reseteado - Empezando desde cero');
      
    } catch (error) {
      console.error('❌ Error reseteando dashboard:', error);
      await this.showErrorToast('Error reseteando dashboard');
    }
  }
  private loadUserData(uid: string): void {
    try {
      // Cargar UserStats
      this.db.collection('userStats').doc(uid).onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data() as UserStats;
          this.userStatsSubject.next(data);
        } else {
          this.userStatsSubject.next(null);
        }
      });

      // Cargar CriticalAlerts
      this.db.collection('criticalAlerts')
        .where('uid', '==', uid)
        .orderBy('processedAt', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
          const alerts: CriticalAlert[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            alerts.push({
              id: doc.id,
              ...data,
              timestamp: data['timestamp'] ? data['timestamp'].toDate() : new Date(),
              processedAt: data['processedAt'] ? data['processedAt'].toDate() : new Date()
            } as CriticalAlert);
          });
          this.alertsSubject.next(alerts);
        });

    } catch (error) {
      console.error('Error cargando datos del usuario:', error);
      this.userStatsSubject.next(null);
      this.alertsSubject.next([]);
    }
  }

  getUserStats(): Observable<UserStats | null> {
    return this.userStatsSubject.asObservable();
  }

  getRecentCriticalAlerts(limit: number = 50): Observable<CriticalAlert[]> {
    return this.alertsSubject.asObservable().pipe(
      map(alerts => alerts.slice(0, limit))
    );
  }

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return combineLatest([
      this.userStatsSubject.asObservable(),
      this.alertsSubject.asObservable()
    ]).pipe(
      map(([userStats, alerts]) => {
        // SI NO HAY DATOS REALES, RETORNAR DASHBOARD VACÍO
        if (!userStats && alerts.length === 0) {
          console.log('📊 Dashboard vacío - Sin datos de usuario ni alertas');
          return this.getEmptyMetrics();
        }

        const metrics = this.calculateRealMetrics(userStats, alerts);
        console.log('📊 Métricas REALES calculadas:', metrics);
        return metrics;
      }),
      catchError(error => {
        console.error('❌ Error calculando métricas dashboard:', error);
        return of(this.getEmptyMetrics());
      })
    );
  }

  private calculateRealMetrics(userStats: UserStats | null, alerts: CriticalAlert[]): DashboardMetrics {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Si no hay alertas ni userStats, dashboard vacío
    if (alerts.length === 0 && !userStats) {
      return this.getEmptyMetrics();
    }

    const recentAlerts = alerts.filter(alert => alert.processedAt >= weekAgo).slice(0, 10);
    const todayAlerts = alerts.filter(alert => alert.processedAt >= today);

    // USAR DATOS DEL userStats SI ESTÁN DISPONIBLES
    const totalWorkouts = userStats?.totalWorkouts || this.calculateRealWorkouts(alerts);
    
    // ← CAMBIO CRÍTICO: No usar fallback ficticio para totalHours
    const totalHours = userStats?.totalHours || 0; // ← CAMBIAR ESTA LÍNEA
    
    const accuracy = userStats?.averageAccuracy || this.calculateRealAccuracy(alerts);

    const errorsByType = _.countBy(alerts.slice(0, 30), 'errorType');
    const mostCommonError = _.maxBy(Object.entries(errorsByType), '1')?.[0] || '';

    const weeklyProgress = this.calculateWeeklyProgress(alerts);
    const accuracyTrend = this.calculateAccuracyTrend(alerts);
    const weeklyImprovement = this.calculateWeeklyImprovement(alerts);
    const exerciseStats = this.calculateExerciseStats(alerts);

    // ← AGREGAR LOG PARA DEBUGGING
    console.log('🔍 Debug calculateRealMetrics:', {
      userStats: userStats,
      totalWorkouts,
      totalHours,
      userStatsTotalHours: userStats?.totalHours,
      userStatsTotalSeconds: userStats?.totalSeconds
    });

    return {
      totalWorkouts,
      accuracy,
      totalHours: totalHours, // ← YA NO redondear aquí
      weeklyImprovement,
      weeklyGoalProgress: this.calculateRealWeeklyGoal(weeklyProgress),
      currentStreak: this.calculateStreak(alerts),
      criticalErrorsToday: todayAlerts.length,
      mostCommonError,
      recentAlerts,
      errorsByType,
      weeklyProgress,
      accuracyTrend,
      exerciseStats,
      isEmpty: totalWorkouts === 0 && alerts.length === 0
    };
  }

  // MÉTODOS PRIVADOS DE CÁLCULO (SIN CAMBIOS)
  private calculateRealWorkouts(alerts: CriticalAlert[]): number {
    if (alerts.length === 0) return 0;
    const sessionIds = _.uniqBy(alerts, alert => alert.lastSessionId || alert.id).length;
    const uniqueDays = _.uniqBy(alerts, alert => alert.processedAt.toDateString()).length;
    return Math.max(sessionIds, uniqueDays, 0);
  }

  private calculateRealAccuracy(alerts: CriticalAlert[]): number {
    if (alerts.length === 0) return 0;
    const confidences = alerts
      .filter(alert => alert.confidence && alert.confidence > 0)
      .map(alert => alert.confidence);
    if (confidences.length === 0) return 0;
    const avgConfidence = _.mean(confidences);
    const severityWeights = { 'low': 0.1, 'medium': 0.3, 'high': 0.6, 'critical': 1.0 };
    const weightedErrors = alerts.reduce((sum, alert) => 
      sum + (severityWeights[alert.severity] || 0.5), 0);
    const totalSessions = this.calculateRealWorkouts(alerts);
    if (totalSessions === 0) return 0;
    const errorRate = Math.min(weightedErrors / totalSessions, 1);
    return Math.max(0, Math.min(100, Math.round((1 - errorRate) * 100)));
  }

  private calculateRealWeeklyGoal(weeklyProgress: { day: string; workouts: number; errors: number }[]): number {
    const workoutDays = weeklyProgress.filter(day => day.workouts > 0).length;
    const goalDays = 5;
    return Math.min((workoutDays / goalDays) * 100, 100);
  }

  private calculateWeeklyProgress(alerts: CriticalAlert[]): 
    { day: string; workouts: number; errors: number }[] {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyAlerts = alerts.filter(alert => alert.processedAt >= weekAgo);
    const alertsByDay = _.groupBy(weeklyAlerts, alert => {
      const dayIndex = (alert.processedAt.getDay() + 6) % 7;
      return days[dayIndex];
    });
    return days.map(day => ({
      day,
      workouts: alertsByDay[day] ? _.uniqBy(alertsByDay[day], alert => alert.lastSessionId || alert.id).length : 0,
      errors: alertsByDay[day]?.length || 0
    }));
  }

 private calculateWeeklyImprovement(alerts: CriticalAlert[]): number {
  if (alerts.length < 2) return 0;
  
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  // ✅ CAMBIO: Obtener alertas por semana
  const thisWeekAlerts = alerts.filter(alert => 
    alert.processedAt >= weekAgo && alert.processedAt < now);
  const lastWeekAlerts = alerts.filter(alert => 
    alert.processedAt >= twoWeeksAgo && alert.processedAt < weekAgo);
  
  // ✅ CAMBIO: Calcular precisión promedio, no cantidad de errores
  const thisWeekAccuracy = this.calculateWeekAccuracy(thisWeekAlerts);
  const lastWeekAccuracy = this.calculateWeekAccuracy(lastWeekAlerts);
  
  // ✅ CAMBIO: Validaciones mejoradas
  if (thisWeekAlerts.length === 0 && lastWeekAlerts.length === 0) return 0;
  if (lastWeekAlerts.length === 0) return 0; // Sin referencia previa, mostrar 0%
  if (thisWeekAlerts.length === 0) return -10; // Esta semana sin entrenamientos
  
  // ✅ CAMBIO: Fórmula basada en precisión
  const improvement = thisWeekAccuracy - lastWeekAccuracy;
  
  // ✅ CAMBIO: Límites razonables
  return Math.max(-50, Math.min(50, Math.round(improvement)));
}
private calculateWeekAccuracy(weekAlerts: CriticalAlert[]): number {
  if (weekAlerts.length === 0) return 0;
  
  // Obtener confidence promedio
  const confidences = weekAlerts
    .filter(alert => alert.confidence && alert.confidence > 0)
    .map(alert => alert.confidence);
  
  if (confidences.length === 0) return 50; // Precisión base sin datos
  
  const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  
  // Penalizar por severidad de errores
  const severityPenalty = weekAlerts.reduce((penalty, alert) => {
    const weights = { 'low': 2, 'medium': 5, 'high': 8, 'critical': 12 };
    return penalty + (weights[alert.severity] || 5);
  }, 0);
  
  // Estimar sesiones (aproximadamente 3-4 errores por sesión)
  const estimatedSessions = Math.max(1, Math.ceil(weekAlerts.length / 3.5));
  const avgPenaltyPerSession = severityPenalty / estimatedSessions;
  
  // Calcular precisión final
  const baseAccuracy = avgConfidence * 100;
  const finalAccuracy = Math.max(0, baseAccuracy - avgPenaltyPerSession);
  
  return Math.round(finalAccuracy);
}

  private calculateAccuracyTrend(alerts: CriticalAlert[]): 
    { date: string; accuracy: number }[] {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayAlerts = alerts.filter(alert => 
        alert.processedAt >= dayStart && alert.processedAt < dayEnd);
      const dayAccuracy = dayAlerts.length > 0 ? this.calculateRealAccuracy(dayAlerts) : 0;
      last7Days.push({
        date: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        accuracy: dayAccuracy
      });
    }
    return last7Days;
  }

  private calculateExerciseStats(alerts: CriticalAlert[]): 
    { exercise: string; count: number; avgAccuracy: number }[] {
    if (alerts.length === 0) return [];
    const exerciseGroups = _.groupBy(alerts.slice(0, 50), 'exercise');
    return Object.entries(exerciseGroups).map(([exercise, exerciseAlerts]) => ({
      exercise: exercise || 'Desconocido',
      count: exerciseAlerts.length,
      avgAccuracy: this.calculateRealAccuracy(exerciseAlerts)
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  private calculateStreak(alerts: CriticalAlert[]): number {
    if (alerts.length === 0) return 0;
    const uniqueDays = _.uniqBy(alerts, alert => alert.processedAt.toDateString())
      .map(alert => alert.processedAt.toDateString()).sort();
    if (uniqueDays.length < 2) return uniqueDays.length;
    let currentStreak = 1;
    for (let i = uniqueDays.length - 2; i >= 0; i--) {
      const today = new Date(uniqueDays[i + 1]);
      const yesterday = new Date(uniqueDays[i]);
      const diffDays = Math.round((today.getTime() - yesterday.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        currentStreak++;
      } else {
        break;
      }
    }
    return currentStreak;
  }

  // MÉTRICAS COMPLETAMENTE VACÍAS PARA USUARIOS NUEVOS
  private getEmptyMetrics(): DashboardMetrics {
    return {
      totalWorkouts: 0,
      accuracy: 0,
      totalHours: 0,
      weeklyImprovement: 0,
      weeklyGoalProgress: 0,
      currentStreak: 0,
      criticalErrorsToday: 0,
      mostCommonError: '',
      recentAlerts: [],
      errorsByType: {},
      weeklyProgress: [
        { day: 'Lun', workouts: 0, errors: 0 },
        { day: 'Mar', workouts: 0, errors: 0 },
        { day: 'Mié', workouts: 0, errors: 0 },
        { day: 'Jue', workouts: 0, errors: 0 },
        { day: 'Vie', workouts: 0, errors: 0 },
        { day: 'Sáb', workouts: 0, errors: 0 },
        { day: 'Dom', workouts: 0, errors: 0 }
      ],
      accuracyTrend: [
        { date: 'Lun', accuracy: 0 },
        { date: 'Mar', accuracy: 0 },
        { date: 'Mié', accuracy: 0 },
        { date: 'Jue', accuracy: 0 },
        { date: 'Vie', accuracy: 0 },
        { date: 'Sáb', accuracy: 0 },
        { date: 'Dom', accuracy: 0 }
      ],
      exerciseStats: [],
      isEmpty: true
    };
  }

  // ← NUEVO MÉTODO: Guardar sesión completa en Firestore
  async saveWorkoutSession(sessionData: {
    exerciseName: string;
    errorCount: number;
    sessionId: string;
    totalCorrections: number;
    sessionDurationSeconds?: number;
    repetitions?: number;
  }): Promise<void> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        console.error('❌ No hay usuario autenticado');
        return;
      }

      const accuracy = sessionData.totalCorrections > 0 ?
        ((sessionData.totalCorrections - sessionData.errorCount) / sessionData.totalCorrections) * 100 : 100;

      // Guardar sesión completa en una nueva colección
      const workoutSession = {
        uid: user.uid,
        sessionId: sessionData.sessionId,
        exercise: sessionData.exerciseName,
        date: firebase.firestore.Timestamp.now(),
        durationSeconds: sessionData.sessionDurationSeconds || 0,
        repetitions: sessionData.repetitions || 0, // ← REPETICIONES REALES
        errorsCount: sessionData.errorCount,
        accuracy: Math.round(accuracy),
        totalCorrections: sessionData.totalCorrections,
        createdAt: firebase.firestore.Timestamp.now()
      };

      // Guardar en la colección workoutSessions
      await this.db.collection('workoutSessions').add(workoutSession);

      console.log('✅ Sesión de entrenamiento guardada:', workoutSession);

    } catch (error) {
      console.error('❌ Error guardando sesión de entrenamiento:', error);
    }
  }

  async updateUserStats(sessionData: {
    exerciseName: string;
    errorCount: number;
    sessionId: string;
    totalCorrections: number;
    sessionDurationSeconds?: number;
    repetitions?: number; // ← AGREGAR REPETICIONES REALES
  }): Promise<void> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user) {
        console.error('❌ No hay usuario autenticado para actualizar stats');
        return;
      }

      console.log('🆕 Actualizando UserStats con datos reales:', sessionData);

      // ← GUARDAR SESIÓN COMPLETA PRIMERO
      await this.saveWorkoutSession(sessionData);
  
      const accuracy = sessionData.totalCorrections > 0 ? 
        ((sessionData.totalCorrections - sessionData.errorCount) / sessionData.totalCorrections) * 100 : 100;
  
      // Obtener stats actuales usando Firebase directo
      const currentStatsDoc = await this.db.collection('userStats').doc(user.uid).get();
      const existingData = currentStatsDoc.exists ? (currentStatsDoc.data() as UserStats) : {} as UserStats;
  
      // ← AGREGAR LOGS DETALLADOS
      console.log('🔍 Datos existentes en Firestore:', existingData);
      console.log('🔍 totalHours actual en Firestore:', existingData.totalHours);
      console.log('🔍 totalSeconds actual en Firestore:', existingData.totalSeconds);
  
      // Calcular nuevos totales
      const totalSessions = (existingData.totalWorkouts || 0) + 1;
      
      // Acumular tiempo real en segundos, luego convertir a horas
      const currentTotalSeconds = (existingData.totalHours || 0) * 3600; // Convertir horas actuales a segundos
      const sessionSeconds = sessionData.sessionDurationSeconds || 0; // Segundos de esta sesión
      const newTotalSeconds = currentTotalSeconds + sessionSeconds; // Sumar segundos
      const newTotalHours = newTotalSeconds / 3600; // Convertir de vuelta a horas
  
      // ← AGREGAR MÁS LOGS
      console.log('🔍 Cálculo de tiempo:');
      console.log('  - Segundos actuales (desde totalHours):', currentTotalSeconds);
      console.log('  - Segundos de esta sesión:', sessionSeconds);
      console.log('  - Nuevos segundos totales:', newTotalSeconds);
      console.log('  - Nuevas horas totales:', newTotalHours);
  
      const newStats = {
        uid: user.uid,
        lastSessionId: sessionData.sessionId,
        lastExercise: sessionData.exerciseName,
        lastSessionAccuracy: accuracy,
        totalWorkouts: totalSessions,
        totalHours: newTotalHours, // ← AHORA USA TIEMPO REAL ACUMULADO
        lastCriticalError: firebase.firestore.Timestamp.now(),
        totalCriticalErrors: (existingData.totalCriticalErrors || 0) + sessionData.errorCount,
        averageAccuracy: accuracy,
        updatedAt: firebase.firestore.Timestamp.now(),
        // Campos para debugging
        lastSessionDurationSeconds: sessionSeconds,
        totalSeconds: newTotalSeconds,
        // ← AGREGAR REPETICIONES REALES
        lastSessionRepetitions: sessionData.repetitions || 0
      };
  
      console.log('🔍 Nuevos stats que se van a guardar:', newStats);
  
      // Usar Firebase directo para evitar NG0203
      await this.db.collection('userStats').doc(user.uid).set(newStats, { merge: true });
  
      console.log('✅ UserStats actualizado exitosamente con tiempo real');
      console.log(`⏱️ Sesión: ${sessionSeconds}s | Total acumulado: ${newTotalHours.toFixed(4)}h`);
      
      // ← VERIFICAR QUE SE GUARDÓ CORRECTAMENTE
      const verifyDoc = await this.db.collection('userStats').doc(user.uid).get();
      const verifyData = verifyDoc.data() as UserStats;
      console.log('🔍 Verificación - Datos guardados en Firestore:', verifyData);
      console.log('🔍 Verificación - totalHours guardado:', verifyData.totalHours);
      
      // Mostrar toast de éxito
      await this.showSuccessToast('Datos de entrenamiento guardados correctamente');
      
    } catch (error) {
      console.error('❌ Error actualizando UserStats:', error);
      await this.showErrorToast('Error guardando datos del entrenamiento');
    }
  }

  async getTrainingHistory(): Promise<any[]> {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      console.log('📊 Cargando historial REAL de entrenamiento para:', user.uid);

      // ← PRIMERO: Intentar obtener sesiones desde workoutSessions (DATOS REALES)
      const workoutSessionsSnapshot = await this.db
        .collection('workoutSessions')
        .where('uid', '==', user.uid)
        .orderBy('date', 'desc')
        .limit(20)
        .get();

      const sessions: any[] = [];

      // PROCESAR SESIONES REALES
      workoutSessionsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        sessions.push({
          date: data.date?.toDate?.()?.toISOString() || new Date().toISOString(),
          exercise: data.exercise || 'Entrenamiento',
          duration: Math.round(data.durationSeconds / 60) || 0, // Convertir a minutos
          repetitions: data.repetitions || 0, // ← REPETICIONES REALES GUARDADAS
          errorsCount: data.errorsCount || 0,
          accuracy: data.accuracy || 0,
          sessionId: data.sessionId || doc.id,
          confidence: 0.95
        });
      });

      console.log('📊 Sesiones REALES cargadas desde workoutSessions:', sessions.length);

      // Si hay sesiones reales, retornarlas directamente
      if (sessions.length > 0) {
        console.log('✅ Historial REAL encontrado:', sessions.length, 'sesiones');
        return sessions.slice(0, 10);
      }

      // ← FALLBACK: Si no hay sesiones en workoutSessions, intentar con criticalAlerts (legacy)
      console.log('⚠️ No hay sesiones en workoutSessions, buscando en criticalAlerts...');

      const alertsSnapshot = await this.db
        .collection('criticalAlerts')
        .where('uid', '==', user.uid)
        .orderBy('processedAt', 'desc')
        .limit(20)
        .get();

      if (!alertsSnapshot.empty) {
        const sessionGroups = new Map<string, any[]>();

        alertsSnapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          const sessionKey = data.lastSessionId ||
                            data.processedAt?.toDate?.()?.toDateString() ||
                            'unknown';

          if (!sessionGroups.has(sessionKey)) {
            sessionGroups.set(sessionKey, []);
          }
          sessionGroups.get(sessionKey)!.push({
            id: doc.id,
            ...data,
            processedAt: data.processedAt?.toDate?.() || new Date()
          });
        });

        sessionGroups.forEach((alerts, sessionKey) => {
          const sessionDate = alerts[0].processedAt;
          const exercise = alerts[0].exercise || 'Entrenamiento General';
          const errorsCount = alerts.length;
          const avgConfidence = alerts.reduce((sum, alert) => sum + (alert.confidence || 0), 0) / alerts.length;
          const accuracy = Math.max(0, 100 - (errorsCount * 10));

          sessions.push({
            date: sessionDate.toISOString(),
            exercise: exercise,
            duration: Math.floor(Math.random() * 20) + 15,
            repetitions: Math.max(10, 30 - errorsCount), // Estimación
            errorsCount: errorsCount,
            accuracy: Math.round(accuracy),
            sessionId: sessionKey,
            confidence: Math.round(avgConfidence * 100) / 100
          });
        });

        console.log('📊 Sesiones legacy cargadas desde criticalAlerts:', sessions.length);
      }

      // Si aún no hay sesiones, mostrar vacío (sin datos de ejemplo)
      if (sessions.length === 0) {
        console.log('📊 No hay historial disponible - Usuario sin entrenamientos');
        return [];
      }

      sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log('📊 Historial procesado:', sessions.length, 'sesiones encontradas');
      return sessions.slice(0, 10);

    } catch (error) {
      console.error('❌ Error cargando historial:', error);
      return [];
    }
  }
  // MÉTODOS AUXILIARES PARA TOASTS
  private async showSuccessToast(message: string): Promise<void> {
    try {
      const toast = await this.toastController.create({
        message,
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Error mostrando toast de éxito:', error);
    }
  }

  private async showErrorToast(message: string): Promise<void> {
    try {
      const toast = await this.toastController.create({
        message,
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    } catch (error) {
      console.error('Error mostrando toast de error:', error);
    }
  }
}