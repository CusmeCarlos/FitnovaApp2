// src/app/tab2/tab2.page.ts
// ✅ PÁGINA PRINCIPAL CORREGIDA CON SISTEMA TOAST INTELIGENTE

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/user.interface';
import { PoseCameraComponent } from '../features/training/components/pose-camera/pose-camera.component';
import { 
  ExerciseType, 
  PoseKeypoints, 
  PostureError 
} from '../shared/models/pose.models';

interface ToastMessage {
  id: string;
  message: string;
  color: string;
  lastShown: number;
  cooldown: number;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  @ViewChild(PoseCameraComponent) cameraComponent!: PoseCameraComponent;
  
  user: User | null = null;
  
  // Estado de la vista
  showCamera = false;
  selectedExercise: ExerciseType = ExerciseType.SQUATS;
  
  // Datos de la sesión actual
  sessionData = {
    repetitions: 0,
    totalErrors: 0,
    avgQuality: 0,
    startTime: null as Date | null,
    errors: [] as PostureError[],
    duration: 0
  };

  // Estadísticas del día
  todayStats = {
    duration: 0,
    repetitions: 0,
    avgQuality: 0
  };

  // Para almacenar puntuaciones de calidad
  private qualityScores: number[] = [];
  private sessionTimer: any = null;

  // 🍞 SISTEMA DE TOAST INTELIGENTE
  private toastHistory: Map<string, ToastMessage> = new Map();
  private activeToasts: Set<string> = new Set();
  private lastErrorTime: number = 0;
  private lastRepetitionToast: number = 0;
  private currentErrorType: string = '';
  private lastQualityFeedback: number = 0;

  constructor(
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    console.log('🎬 Tab2Page ngOnInit');
    
    // Suscribirse al usuario actual
    this.authService.user$.subscribe(user => {
      this.user = user;
    });
    
    // Cargar estadísticas del día
    this.loadTodayStats();

    // Limpiar historial de toasts cada 5 minutos
    setInterval(() => {
      this.clearOldToastHistory();
    }, 300000);
  }

  ngOnDestroy() {
    this.clearSessionTimer();
  }

  // 🍞 MÉTODOS DEL SISTEMA DE TOAST INTELIGENTE

  private async showSmartToast(
    message: string, 
    color: string = 'primary', 
    cooldown: number = 3000, 
    category: string = 'general'
  ): Promise<boolean> {
    const toastId = this.generateToastId(message, category);
    const now = Date.now();
    
    // Verificar si el toast está en cooldown
    if (this.isToastInCooldown(toastId, now)) {
      console.log(`🚫 Toast "${message}" está en cooldown`);
      return false;
    }
    
    // Verificar si ya hay un toast activo del mismo tipo
    if (this.activeToasts.has(toastId)) {
      console.log(`🚫 Toast "${message}" ya está activo`);
      return false;
    }
    
    // Registrar el toast
    this.toastHistory.set(toastId, {
      id: toastId,
      message,
      color,
      lastShown: now,
      cooldown
    });
    
    this.activeToasts.add(toastId);
    
    // Crear y mostrar el toast
    const toast = await this.toastController.create({
      message,
      duration: this.calculateToastDuration(color),
      position: 'bottom',
      color,
      buttons: color === 'danger' ? [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ] : undefined
    });
    
    // Remover de activos cuando se cierre
    toast.onDidDismiss().then(() => {
      this.activeToasts.delete(toastId);
    });
    
    await toast.present();
    console.log(`✅ Toast mostrado: "${message}"`);
    return true;
  }
  
  private generateToastId(message: string, category: string): string {
    const messageHash = message.toLowerCase().replace(/[^\w\s]/g, '').slice(0, 20);
    return `${category}_${messageHash}`;
  }
  
  private isToastInCooldown(toastId: string, currentTime: number): boolean {
    const lastToast = this.toastHistory.get(toastId);
    if (!lastToast) return false;
    
    return (currentTime - lastToast.lastShown) < lastToast.cooldown;
  }
  
  private calculateToastDuration(color: string): number {
    switch (color) {
      case 'danger': return 4000;
      case 'warning': return 3500;
      case 'success': return 2500;
      default: return 3000;
    }
  }
  
  private clearOldToastHistory(maxAge: number = 300000): void {
    const now = Date.now();
    for (const [id, toast] of this.toastHistory.entries()) {
      if (now - toast.lastShown > maxAge) {
        this.toastHistory.delete(id);
      }
    }
  }

  // Métodos específicos de toast
  private async showErrorToast(message: string): Promise<boolean> {
    return this.showSmartToast(message, 'danger', 5000, 'error');
  }
  
  private async showSuccessToast(message: string): Promise<boolean> {
    return this.showSmartToast(message, 'success', 3000, 'success');
  }
  
  private async showWarningToast(message: string): Promise<boolean> {
    return this.showSmartToast(message, 'warning', 4000, 'warning');
  }
  
  private async showCoachingToast(message: string): Promise<boolean> {
    return this.showSmartToast(`💡 ${message}`, 'primary', 8000, 'coaching');
  }
  
  private async showProgressToast(message: string): Promise<boolean> {
    return this.showSmartToast(message, 'success', 2000, 'progress');
  }

  // 🏋️ INICIAR EJERCICIO CON CÁMARA
  async startExercise(exerciseType: string) {
    console.log('🎯 === INICIANDO EJERCICIO ===');
    console.log('🎯 Tipo:', exerciseType);

    const exerciseMap: { [key: string]: ExerciseType } = {
      'squats': ExerciseType.SQUATS,
      'pushups': ExerciseType.PUSHUPS,
      'plank': ExerciseType.PLANK,
      'lunges': ExerciseType.LUNGES,
      'bicep_curls': ExerciseType.BICEP_CURLS,
      'deadlift': ExerciseType.DEADLIFT,
      'bench_press': ExerciseType.BENCH_PRESS,
      'shoulder_press': ExerciseType.SHOULDER_PRESS
    };

    const exercise = exerciseMap[exerciseType];
    
    if (!exercise) {
      console.log('❌ Ejercicio no encontrado:', exerciseType);
      await this.showErrorToast('Ejercicio no disponible');
      return;
    }

    this.selectedExercise = exercise;
    this.showCamera = true;
    this.resetSessionData();
    this.startSessionTimer();
    
    await this.showSuccessToast(`¡Ejercicio ${this.getExerciseName(exercise)} iniciado!`);
  }

  // ⏱️ TEMPORIZADOR DE SESIÓN
  private startSessionTimer() {
    this.sessionData.startTime = new Date();
    
    this.sessionTimer = setInterval(() => {
      if (this.sessionData.startTime) {
        const duration = (Date.now() - this.sessionData.startTime.getTime()) / (1000 * 60);
        this.sessionData.duration = Math.round(duration * 10) / 10;
      }
    }, 1000);
  }

  private clearSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  // 🔄 REINICIAR DATOS DE SESIÓN
  private resetSessionData() {
    this.sessionData = {
      repetitions: 0,
      totalErrors: 0,
      avgQuality: 0,
      startTime: new Date(),
      errors: [],
      duration: 0
    };
    this.qualityScores = [];
    
    // Reiniciar contadores de toast
    this.lastErrorTime = 0;
    this.lastRepetitionToast = 0;
    this.currentErrorType = '';
    this.lastQualityFeedback = 0;
  }

  // 📊 CARGAR ESTADÍSTICAS DEL DÍA
  private loadTodayStats() {
    // TODO: Implementar carga desde Firestore
    // Por ahora usar datos por defecto
    this.todayStats = {
      duration: 0,
      repetitions: 0,
      avgQuality: 0
    };
  }

  // 🛑 DETENER EJERCICIO
  async stopExercise() {
    console.log('🛑 === DETENIENDO EJERCICIO ===');
    
    this.clearSessionTimer();
    
    // Si hay progreso, preguntar antes de salir
    if (this.sessionData.repetitions > 0) {
      const alert = await this.alertController.create({
        header: '🛑 Finalizar Ejercicio',
        message: `¿Quieres guardar tu progreso?\n\n• ${this.sessionData.repetitions} repeticiones\n• ${this.sessionData.duration} minutos\n• ${this.sessionData.avgQuality}% calidad promedio`,
        buttons: [
          {
            text: 'Descartar',
            role: 'cancel',
            handler: () => {
              this.discardSession();
            }
          },
          {
            text: 'Guardar',
            handler: () => {
              this.saveSession();
            }
          }
        ]
      });
      await alert.present();
    } else {
      this.discardSession();
    }
  }

  // 🗑️ DESCARTAR SESIÓN
  private discardSession() {
    this.showCamera = false;
    this.resetSessionData();
    console.log('🗑️ Sesión descartada');
  }

  // 📊 EVENTOS DE LA CÁMARA CON TOAST INTELIGENTE

  onPoseDetected(pose: PoseKeypoints) {
    // Pose detectada - se podría usar para analytics futuro
  }

  onErrorDetected(errors: PostureError[]) {
    this.sessionData.errors = errors;
    this.sessionData.totalErrors += errors.length;
    
    // Mostrar toast para errores críticos (severidad >= 8)
    const criticalErrors = errors.filter(error => error.severity >= 8);
    if (criticalErrors.length > 0) {
      const error = criticalErrors[0];
      const now = Date.now();
      
      // Solo mostrar si es un error diferente o han pasado 5 segundos
      if (this.currentErrorType !== error.type || (now - this.lastErrorTime) > 5000) {
        this.showErrorToast(error.description);
        this.currentErrorType = error.type;
        this.lastErrorTime = now;
      }
    }
  }

  onRepetitionComplete(repetitionCount: number) {
    this.sessionData.repetitions = repetitionCount;
    
    // Feedback háptico si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
    
    // Mensajes de aliento más inteligentes
    if (repetitionCount % 5 === 0 && repetitionCount > 0) {
      const now = Date.now();
      
      // Evitar repetir el mismo mensaje si no han pasado 3 segundos
      if ((now - this.lastRepetitionToast) > 3000) {
        const messages = [
          `¡${repetitionCount} repeticiones! ¡Excelente trabajo!`,
          `¡Vas muy bien! ${repetitionCount} repeticiones completadas`,
          `¡Increíble! Ya llevas ${repetitionCount} repeticiones`,
          `¡Sigue así! ${repetitionCount} repeticiones perfectas`
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        this.showProgressToast(randomMessage);
        this.lastRepetitionToast = now;
      }
    }
    
    // Hitos especiales
    if (repetitionCount === 10) {
      this.showSuccessToast('🎉 ¡10 repeticiones! ¡Estás en fuego!');
    } else if (repetitionCount === 25) {
      this.showSuccessToast('🔥 ¡25 repeticiones! ¡Eres una máquina!');
    } else if (repetitionCount === 50) {
      this.showSuccessToast('⭐ ¡50 repeticiones! ¡Nivel experto!');
    }
  }

  onQualityScore(score: number) {
    this.qualityScores.push(score);
    
    // Calcular promedio de calidad
    if (this.qualityScores.length > 0) {
      const sum = this.qualityScores.reduce((a, b) => a + b, 0);
      this.sessionData.avgQuality = Math.round(sum / this.qualityScores.length);
      
      // Mostrar feedback de calidad solo en momentos específicos
      if (this.qualityScores.length % 10 === 0) { // Cada 10 mediciones
        const now = Date.now();
        
        // Evitar spam de feedback de calidad
        if ((now - this.lastQualityFeedback) > 15000) { // 15 segundos
          if (this.sessionData.avgQuality >= 90) {
            this.showSuccessToast('⭐ Técnica excelente mantenida');
          } else if (this.sessionData.avgQuality >= 75) {
            this.showSuccessToast('👍 Buena técnica general');
          } else if (this.sessionData.avgQuality < 60) {
            this.showWarningToast('⚠️ Revisa tu postura');
          }
          this.lastQualityFeedback = now;
        }
      }
    }
  }

  onCoachingTip(tip: string) {
    // Los tips tienen un cooldown más largo para no saturar
    this.showCoachingToast(tip);
  }

  // ✅ NUEVO MÉTODO PARA MANEJAR EL RETROCESO
  async onBackToExercises() {
    console.log('🔙 Evento de retroceso recibido');
    
    // Si hay repeticiones, preguntar antes de salir
    if (this.sessionData.repetitions > 0) {
      const alert = await this.alertController.create({
        header: '🔙 Volver a Ejercicios',
        message: `¿Quieres guardar tu progreso actual?\n\n• ${this.sessionData.repetitions} repeticiones\n• ${this.sessionData.avgQuality}% calidad promedio`,
        buttons: [
          {
            text: 'Descartar y Volver',
            role: 'destructive',
            handler: () => {
              this.discardAndGoBack();
            }
          },
          {
            text: 'Guardar y Volver',
            handler: () => {
              this.saveAndGoBack();
            }
          },
          {
            text: 'Cancelar',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
    } else {
      // Si no hay progreso, volver directamente
      this.goBackDirectly();
    }
  }

  // 🗑️ DESCARTAR Y VOLVER
  private discardAndGoBack(): void {
    this.showCamera = false;
    this.resetSessionData();
    this.showWarningToast('Sesión descartada');
  }

  // 💾 GUARDAR Y VOLVER
  private async saveAndGoBack(): Promise<void> {
    try {
      await this.saveSession();
      this.showCamera = false;
      this.showSuccessToast('¡Progreso guardado correctamente!');
    } catch (error) {
      console.error('❌ Error guardando:', error);
      this.showErrorToast('Error al guardar. Volviendo sin guardar.');
      this.showCamera = false;
    }
  }

  // 🔙 VOLVER DIRECTAMENTE
  private goBackDirectly(): void {
    this.showCamera = false;
    this.resetSessionData();
  }

  // 💾 GUARDAR SESIÓN
  private async saveSession() {
    try {
      // Calcular duración final
      if (this.sessionData.startTime) {
        const duration = (Date.now() - this.sessionData.startTime.getTime()) / (1000 * 60);
        this.sessionData.duration = Math.round(duration * 10) / 10; // Redondear a 1 decimal
      }
      
      // Actualizar estadísticas del día
      this.todayStats.repetitions += this.sessionData.repetitions;
      this.todayStats.duration += this.sessionData.duration;
      
      // Recalcular promedio de calidad del día
      if (this.sessionData.avgQuality > 0) {
        this.todayStats.avgQuality = Math.round(
          (this.todayStats.avgQuality + this.sessionData.avgQuality) / 2
        );
      }
      
      // TODO: Aquí se implementaría el guardado en Firestore
      // await this.saveSessionToFirebase(this.sessionData);
      
      await this.showSuccessToast('¡Sesión guardada correctamente!');
      
      // Mostrar resumen
      await this.showSessionSummary();
      
      this.showCamera = false;
      
    } catch (error) {
      console.error('❌ Error guardando sesión:', error);
      await this.showErrorToast('Error al guardar la sesión');
    }
  }

  // 📋 MOSTRAR RESUMEN DE SESIÓN
  private async showSessionSummary() {
    const alert = await this.alertController.create({
      header: '🎉 ¡Sesión Completada!',
      message: `
        📊 Resumen de tu entrenamiento:
        
        ⏱️ Duración: ${this.sessionData.duration} minutos
        🔢 Repeticiones: ${this.sessionData.repetitions}
        ⭐ Calidad promedio: ${this.sessionData.avgQuality}%
        ⚠️ Errores totales: ${this.sessionData.totalErrors}
        
        ¡Excelente trabajo! 💪
      `,
      buttons: [
        {
          text: 'Continuar',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  // 🍞 MÉTODO LEGACY PARA COMPATIBILIDAD
  private async showToast(message: string, color: string): Promise<void> {
    // Usar el nuevo sistema inteligente
    await this.showSmartToast(message, color);
  }

  // 🔧 UTILIDADES

  // Método para trackBy en ngFor (optimización)
  trackByExercise(index: number, exercise: any): string {
    return exercise.id || exercise.name || index;
  }

  // TrackBy para errores
  trackByErrorType(index: number, error: PostureError): string {
    return `${error.type}_${error.severity}_${index}`;
  }

  // Formatear tiempo
  formatTime(minutes: number): string {
    if (minutes < 1) return '< 1 min';
    return `${Math.floor(minutes)} min`;
  }

  // Obtener color según calidad
  getQualityColor(quality: number): string {
    if (quality >= 90) return 'success';
    if (quality >= 75) return 'warning';
    if (quality >= 60) return 'medium';
    return 'danger';
  }

  // Obtener emoji según calidad
  getQualityEmoji(quality: number): string {
    if (quality >= 90) return '⭐';
    if (quality >= 75) return '👍';
    if (quality >= 60) return '👌';
    return '⚠️';
  }

  // 📊 MÉTODOS FALTANTES DEL TEMPLATE

  // Obtener nombre del ejercicio
  getExerciseName(exerciseType: ExerciseType): string {
    const exerciseNames: { [key in ExerciseType]: string } = {
      [ExerciseType.SQUATS]: 'Sentadillas',
      [ExerciseType.PUSHUPS]: 'Flexiones',
      [ExerciseType.PLANK]: 'Plancha',
      [ExerciseType.LUNGES]: 'Estocadas',
      [ExerciseType.BICEP_CURLS]: 'Curl de Bíceps',
      [ExerciseType.DEADLIFT]: 'Peso Muerto',
      [ExerciseType.BENCH_PRESS]: 'Press de Banca',
      [ExerciseType.SHOULDER_PRESS]: 'Press de Hombros'
    };
    
    return exerciseNames[exerciseType] || 'Ejercicio';
  }

  // Mostrar estadísticas detalladas
  async showDetailedStats(): Promise<void> {
    const alert = await this.alertController.create({
      header: '📊 Estadísticas Detalladas',
      message: `
        <div style="text-align: left;">
          <h4>Hoy:</h4>
          <p>⏱️ Tiempo total: ${this.todayStats.duration} min</p>
          <p>🔢 Repeticiones: ${this.todayStats.repetitions}</p>
          <p>⭐ Calidad promedio: ${this.todayStats.avgQuality}%</p>
          
          <h4>Sesión actual:</h4>
          <p>⏱️ Duración: ${this.sessionData.duration} min</p>
          <p>🔢 Repeticiones: ${this.sessionData.repetitions}</p>
          <p>⭐ Calidad: ${this.sessionData.avgQuality}%</p>
          <p>⚠️ Errores: ${this.sessionData.totalErrors}</p>
        </div>
      `,
      buttons: [
        {
          text: 'Ver Historial',
          handler: () => {
            this.showHistoryStats();
          }
        },
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });
    
    await alert.present();
  }

  // Mostrar historial de estadísticas
  private async showHistoryStats(): Promise<void> {
    // TODO: Implementar carga de historial desde Firestore
    const alert = await this.alertController.create({
      header: '📈 Historial',
      message: `
        <div style="text-align: left;">
          <h4>Esta semana:</h4>
          <p>🗓️ Días entrenados: 0</p>
          <p>⏱️ Tiempo total: 0 min</p>
          <p>🔢 Repeticiones totales: 0</p>
          
          <h4>Este mes:</h4>
          <p>🗓️ Días entrenados: 0</p>
          <p>⏱️ Tiempo total: 0 min</p>
          <p>🔢 Repeticiones totales: 0</p>
          
          <p><em>Conecta tu cuenta para ver estadísticas detalladas</em></p>
        </div>
      `,
      buttons: ['Cerrar']
    });
    
    await alert.present();
  }

  // Salir de la cámara
  exitCamera(): void {
    console.log('🚪 Saliendo de la cámara...');
    this.stopExercise();
  }
}