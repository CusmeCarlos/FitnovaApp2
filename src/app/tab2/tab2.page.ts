// src/app/tab2/tab2.page.ts
// ✅ PÁGINA PRINCIPAL CORREGIDA PARA EXAMEN CON INTEGRACIÓN COMPLETA

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/user.interface';
import { PoseCameraComponent } from '../features/training/components/pose-camera/pose-camera.component';
import { 
  ExerciseType, 
  PoseKeypoints, 
  PostureError,
  RepetitionPhase
} from '../shared/models/pose.models';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  @ViewChild(PoseCameraComponent) cameraComponent!: PoseCameraComponent;

  // ✅ ESTADO DEL COMPONENTE
  user: User | null = null;
  currentExercise: ExerciseType = ExerciseType.SQUATS;
  isTrainingActive = false;
  totalRepetitions = 0;
  sessionStartTime: number | null = null;

  // ✅ CONFIGURACIONES PARA EXAMEN
  audioEnabled = true;
  detectionEnabled = true;
  skeletonVisible = true;

  // ✅ EJERCICIOS DISPONIBLES
  availableExercises = [
    { 
      type: ExerciseType.SQUATS, 
      name: 'Sentadillas', 
      icon: 'fitness-outline',
      description: 'Ejercicio fundamental para piernas y glúteos',
      difficulty: 'Principiante'
    },
    { 
      type: ExerciseType.PUSHUPS, 
      name: 'Flexiones', 
      icon: 'body-outline',
      description: 'Fortalecimiento del tren superior',
      difficulty: 'Intermedio'
    },
    { 
      type: ExerciseType.PLANK, 
      name: 'Plancha', 
      icon: 'remove-outline',
      description: 'Ejercicio isométrico para el core',
      difficulty: 'Principiante'
    },
    { 
      type: ExerciseType.LUNGES, 
      name: 'Estocadas', 
      icon: 'walk-outline',
      description: 'Trabajo unilateral de piernas',
      difficulty: 'Intermedio'
    }
  ];

  // ✅ ESTADÍSTICAS DE SESIÓN
  sessionStats = {
    duration: 0,
    errorsDetected: 0,
    correctionsGiven: 0,
    averageQuality: 0
  };

  // ✅ DATOS ACTUALES
  showCamera = false;
  selectedExercise: ExerciseType = ExerciseType.SQUATS;
  todayStats = {
    duration: '0:00',
    repetitions: 0,
    avgQuality: 0
  };
  sessionData = {
    repetitions: 0,
    avgQuality: 0,
    errors: [] as PostureError[],
    currentPhase: RepetitionPhase.IDLE
  };

  // ✅ CONTROL DE SESIÓN
  private sessionTimer: any = null;
  private sessionDuration = 0;

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    console.log('🎬 Tab2Page constructor');
  }

  ngOnInit() {
    console.log('🚀 Tab2Page ngOnInit');
    
    // Suscribirse al usuario autenticado
    this.auth.user$.subscribe(user => {
      this.user = user;
      console.log('👤 Usuario cargado:', user?.email);
    });

    // Cargar estadísticas del día
    this.loadTodayStats();
  }

  ngOnDestroy() {
    console.log('🧹 Tab2Page ngOnDestroy');
    this.stopTraining();
  }

  // 🚀 INICIAR ENTRENAMIENTO
  async startTraining(): Promise<void> {
    try {
      console.log('🚀 Iniciando entrenamiento...');
      
      // Mostrar alerta de confirmación
      const alert = await this.alertController.create({
        header: 'Iniciar Entrenamiento',
        message: `¿Estás listo para entrenar ${this.getExerciseName()}?`,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Comenzar',
            handler: () => {
              this.initializeTraining();
            }
          }
        ]
      });

      await alert.present();

    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      this.showErrorToast('Error al iniciar entrenamiento');
    }
  }

  // 🎯 INICIALIZAR ENTRENAMIENTO
  private initializeTraining(): void {
    this.isTrainingActive = true;
    this.showCamera = true;
    this.sessionStartTime = Date.now();
    this.totalRepetitions = 0;
    this.sessionStats = {
      duration: 0,
      errorsDetected: 0,
      correctionsGiven: 0,
      averageQuality: 0
    };

    // Configurar ejercicio en el componente de cámara
    this.selectedExercise = this.currentExercise;

    // Iniciar timer de sesión
    this.startSessionTimer();

    console.log('✅ Entrenamiento iniciado:', {
      exercise: this.currentExercise,
      startTime: this.sessionStartTime
    });
  }

  // ⏹️ PARAR ENTRENAMIENTO
  async stopTraining(): Promise<void> {
    try {
      if (!this.isTrainingActive) return;

      console.log('⏹️ Parando entrenamiento...');
      
      this.isTrainingActive = false;
      this.showCamera = false;
      
      // Parar timer
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }

      // Mostrar resumen de sesión
      await this.showSessionSummary();

      // Resetear datos
      this.sessionStartTime = null;
      this.sessionDuration = 0;

      console.log('✅ Entrenamiento finalizado');

    } catch (error) {
      console.error('❌ Error parando entrenamiento:', error);
    }
  }

  // ⏰ INICIAR TIMER DE SESIÓN
  private startSessionTimer(): void {
    this.sessionTimer = setInterval(() => {
      if (this.sessionStartTime) {
        this.sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        this.sessionStats.duration = this.sessionDuration;
        this.todayStats.duration = this.formatDuration(this.sessionDuration);
      }
    }, 1000);
  }

  // 🎯 SELECCIONAR EJERCICIO
  selectExercise(exerciseType: ExerciseType): void {
    if (this.isTrainingActive) {
      this.showErrorToast('No puedes cambiar ejercicio durante el entrenamiento');
      return;
    }

    this.currentExercise = exerciseType;
    console.log('🎯 Ejercicio seleccionado:', exerciseType);
  }

  // 🧠 MANEJAR DETECCIÓN DE POSE
  onPoseDetected(pose: PoseKeypoints): void {
    // Pose detectada - puede usar para logging adicional
    console.log('👁️ Pose detectada con', Object.keys(pose).length, 'puntos');
  }

  // 🚨 MANEJAR ERRORES DETECTADOS
  onErrorDetected(errors: PostureError[]): void {
    this.sessionData.errors = errors;
    this.sessionStats.errorsDetected += errors.length;
    this.sessionStats.correctionsGiven += errors.length;

    // Log para debugging
    console.log('🚨 Errores detectados:', errors.map(e => ({
      type: e.type,
      severity: e.severity,
      description: e.description
    })));

    // Mostrar toast para errores críticos
    const criticalErrors = errors.filter(e => e.severity >= 7);
    if (criticalErrors.length > 0) {
      this.showErrorToast(`¡Atención! ${criticalErrors[0].description}`);
    }
  }

  // 🔢 MANEJAR REPETICIÓN CONTADA
  onRepetitionCounted(count: number): void {
    this.totalRepetitions = count;
    this.sessionData.repetitions = count;
    this.todayStats.repetitions = count;

    console.log('🎉 Repetición contada. Total:', count);

    // Mostrar celebración cada 10 repeticiones
    if (count > 0 && count % 10 === 0) {
      this.showSuccessToast(`¡Excelente! ${count} repeticiones completadas`);
    }
  }

  // 📊 CARGAR ESTADÍSTICAS DEL DÍA
  private loadTodayStats(): void {
    // En una implementación real, cargarías esto de Firebase
    this.todayStats = {
      duration: '0:00',
      repetitions: 0,
      avgQuality: 0
    };
  }

  // 📋 MOSTRAR RESUMEN DE SESIÓN
  private async showSessionSummary(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Sesión Completada',
      message: `
        <div style="text-align: center;">
          <h3>¡Gran trabajo!</h3>
          <p><strong>Ejercicio:</strong> ${this.getExerciseName()}</p>
          <p><strong>Duración:</strong> ${this.formatDuration(this.sessionDuration)}</p>
          <p><strong>Repeticiones:</strong> ${this.totalRepetitions}</p>
          <p><strong>Errores corregidos:</strong> ${this.sessionStats.errorsDetected}</p>
        </div>
      `,
      buttons: ['OK']
    });

    await alert.present();
  }

  // 🏃 OBTENER NOMBRE DEL EJERCICIO
  getExerciseName(): string {
    const exercise = this.availableExercises.find(ex => ex.type === this.currentExercise);
    return exercise ? exercise.name : 'Ejercicio';
  }

  // ⏰ FORMATEAR DURACIÓN
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // 🎛️ TOGGLE CONFIGURACIONES
  toggleAudio(): void {
    this.audioEnabled = !this.audioEnabled;
    if (this.cameraComponent) {
      this.cameraComponent.enableAudio = this.audioEnabled;
    }
  }

  toggleDetection(): void {
    this.detectionEnabled = !this.detectionEnabled;
    if (this.cameraComponent) {
      this.cameraComponent.enableErrorDetection = this.detectionEnabled;
    }
  }

  toggleSkeleton(): void {
    this.skeletonVisible = !this.skeletonVisible;
    if (this.cameraComponent) {
      this.cameraComponent.showSkeleton = this.skeletonVisible;
    }
  }

  // 📱 MOSTRAR TOASTS
  private async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }

  // 🎯 OBTENER COLOR DEL EJERCICIO
  getExerciseColor(exerciseType: ExerciseType): string {
    return exerciseType === this.currentExercise ? 'primary' : 'medium';
  }

  // 📊 OBTENER PROGRESO VISUAL
  getProgressPercentage(): number {
    if (!this.sessionStartTime) return 0;
    const targetDuration = 15 * 60; // 15 minutos objetivo
    return Math.min((this.sessionDuration / targetDuration) * 100, 100);
  }
}