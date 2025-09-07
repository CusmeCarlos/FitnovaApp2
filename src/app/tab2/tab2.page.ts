// src/app/tab2/tab2.page.ts - REEMPLAZAR COMPLETO
// TAB2 CON INTEGRACIÓN COMPLETA AL DASHBOARD

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { DashboardService } from '../services/dashboard.service'; 
import { User } from '../interfaces/user.interface';
import { PoseCameraComponent } from '../features/training/components/pose-camera/pose-camera.component';
import { 
  ExerciseType, 
  PoseKeypoints, 
  PostureError,
  RepetitionPhase,
  PostureErrorType
} from '../shared/models/pose.models';
import firebase from 'firebase/compat/app'; 
import 'firebase/compat/firestore'; 

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  @ViewChild(PoseCameraComponent) cameraComponent!: PoseCameraComponent;

  // ESTADO DEL COMPONENTE
  user: User | null = null;
  currentExercise: ExerciseType = ExerciseType.SQUATS;
  isTrainingActive = false;
  trainingStarted = false; 
  totalRepetitions = 0;
  sessionStartTime: number | null = null;

  // CONFIGURACIONES PARA EXAMEN
  audioEnabled = true;
  detectionEnabled = true;
  skeletonVisible = true;

  // EJERCICIOS DISPONIBLES
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

  // ESTADÍSTICAS DE SESIÓN
  sessionStats = {
    duration: 0,
    errorsDetected: 0,
    correctionsGiven: 0,
    suggestionsGiven: 0,
    corrections: 0,
  };

  // DATOS ACTUALES
  showCamera = false;
  selectedExercise: ExerciseType = ExerciseType.SQUATS;
  todayStats = {
    duration: '0:00',
    repetitions: 0,
    suggestions: 0,
    corrections: 0  
  };

  // sessionData con sessionId
  sessionData = {
    repetitions: 0,
    suggestionsGiven: 0,
    errors: [] as PostureError[],
    currentPhase: RepetitionPhase.IDLE,
    sessionId: this.generateSessionId(), 
    startTime: Date.now() 
  };

  // CONTROL DE SESIÓN
  private sessionTimer: any = null;
  private sessionDuration = 0;

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private dashboardService: DashboardService 
  ) {
    console.log('Tab2Page constructor');
  }

  ngOnInit() {
    console.log('Tab2Page ngOnInit');
    
    // Suscribirse al usuario autenticado
    this.auth.user$.subscribe(user => {
      this.user = user;
      console.log('Usuario cargado:', user?.email);
    });

    // Cargar estadísticas del día
    this.loadTodayStats();
    this.loadActiveRoutine();
  }

  ngOnDestroy() {
    console.log('Tab2Page ngOnDestroy');
    this.stopTraining();
  }

  // Generar Session ID único
  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private loadActiveRoutine() {
    const activeRoutineData = localStorage.getItem('activeRoutine');
    if (activeRoutineData) {
      try {
        const routine = JSON.parse(activeRoutineData);
        console.log('Rutina activa cargada:', routine);
        // Aquí puedes usar la rutina en Tab2
        // Por ejemplo: this.currentRoutine = routine;
      } catch (error) {
        console.error('Error cargando rutina activa:', error);
      }
    }
  }
  // INICIAR ENTRENAMIENTO
  async startTraining(): Promise<void> {
    try {
      console.log('Iniciando entrenamiento...');
      
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
      console.error('Error iniciando entrenamiento:', error);
      this.showErrorToast('Error al iniciar entrenamiento');
    }
  }

  // Inicializar con datos de sesión
  private initializeTraining(): void {
    console.log('Inicializando entrenamiento...');
    
    // Resetear datos de sesión
    this.sessionData = {
      repetitions: 0,
      suggestionsGiven: 0,
      errors: [],
      currentPhase: RepetitionPhase.IDLE,
      sessionId: this.generateSessionId(),
      startTime: Date.now()
    };

    // Resetear stats
    this.sessionStats = {
      duration: 0,
      errorsDetected: 0,
      correctionsGiven: 0,
      suggestionsGiven: 0,
      corrections: 0
    };

    this.isTrainingActive = true;
    this.trainingStarted = true;
    this.showCamera = true;
    this.sessionStartTime = Date.now();
    this.totalRepetitions = 0;

    // Configurar ejercicio en el componente de cámara
    this.selectedExercise = this.currentExercise;

    // Iniciar timer de sesión
    this.startSessionTimer();

    console.log('Entrenamiento iniciado con ID:', this.sessionData.sessionId);
  }

  // stopTraining con integración al Dashboard
  async stopTraining(): Promise<void> {
    try {
      if (!this.isTrainingActive) return;

      console.log('Parando entrenamiento...');
      
      this.isTrainingActive = false;
      this.trainingStarted = false;
      this.showCamera = false;
      
      // Parar timer
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }

      // Calcular duración final
      if (this.sessionStartTime) {
        this.sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      }

      // Actualizar Dashboard con datos reales
      await this.updateDashboardWithRealData();

      // Mostrar resumen de sesión
      await this.showSessionSummary();

      // Resetear datos
      this.sessionStartTime = null;
      this.sessionDuration = 0;

      console.log('Entrenamiento finalizado');

    } catch (error) {
      console.error('Error parando entrenamiento:', error);
    }
  }

  private async updateDashboardWithRealData(): Promise<void> {
    try {
      console.log('💾 Actualizando dashboard con datos reales...');

      // Calcular datos reales de la sesión
      const sessionData = {
        exerciseName: this.getExerciseName(),
        errorCount: this.sessionStats.errorsDetected,
        sessionId: this.sessionData.sessionId,
        totalCorrections: Math.max(this.totalRepetitions, this.sessionStats.correctionsGiven, 1),
        sessionDurationSeconds: this.sessionDuration // ← AGREGAR ESTA LÍNEA
      };

      console.log('📊 Datos de sesión con duración real:', sessionData);
      console.log(`⏱️ Duración de esta sesión: ${this.sessionDuration} segundos (${this.formatDuration(this.sessionDuration)})`);

      // Actualizar el dashboard
      await this.dashboardService.updateUserStats(sessionData);

      // También crear una alerta crítica si hubo errores
      if (this.sessionStats.errorsDetected > 0) {
        await this.saveCriticalAlert();
      }

      console.log('✅ Dashboard actualizado con tiempo real de la sesión');

    } catch (error) {
      console.error('❌ Error actualizando dashboard:', error);
    }
  }

  // Método para guardar alertas críticas
  private async saveCriticalAlert(): Promise<void> {
    try {
      const user = await this.auth.getCurrentUser();
      if (!user) return;

      // Crear alerta crítica en Firestore
      const alertData = {
        uid: user.uid,
        errorType: 'KNEE_VALGUS', 
        exercise: this.getExerciseName(),
        severity: 'high' as const,
        confidence: 0.85,
        timestamp: new Date(),
        processedAt: new Date(),
        biomechanicsData: {
          angles: { kneeAngle: 45, hipAngle: 90 },
          position: 'squat_down'
        },
        affectedJoints: ['knee', 'hip'],
        angles: { left_knee: 45, right_knee: 47 },
        captureURL: '',
        lastSessionId: this.sessionData.sessionId
      };

      // Usar Firebase directo
      const db = firebase.firestore();
      await db.collection('criticalAlerts').add(alertData);
      console.log('Alerta crítica guardada');

    } catch (error) {
      console.error('Error guardando alerta:', error);
    }
  }

  // INICIAR TIMER DE SESIÓN
  private startSessionTimer(): void {
    this.sessionTimer = setInterval(() => {
      if (this.sessionStartTime) {
        this.sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        this.sessionStats.duration = this.sessionDuration;
        this.todayStats.duration = this.formatDuration(this.sessionDuration);
      }
    }, 1000);
  }

  // SELECCIONAR EJERCICIO
  selectExercise(exerciseType: ExerciseType): void {
    if (this.isTrainingActive) {
      this.showErrorToast('No puedes cambiar ejercicio durante el entrenamiento');
      return;
    }

    this.currentExercise = exerciseType;
    console.log('Ejercicio seleccionado:', exerciseType);
  }

  // MANEJAR DETECCIÓN DE POSE
  onPoseDetected(pose: PoseKeypoints): void {
    // Pose detectada - puede usar para logging adicional
    console.log('Pose detectada con', Object.keys(pose).length, 'puntos');
  }

  // Mejorar tracking de errores
  onErrorDetected(errors: PostureError[]): void {
    this.sessionData.errors = errors;
    this.sessionStats.errorsDetected += errors.length;
    this.sessionStats.correctionsGiven += errors.length;
    this.sessionStats.suggestionsGiven += errors.length;
    
    // Agregar tracking de errores por sesión
    this.sessionData.suggestionsGiven += errors.length;
    
    this.loadTodayStats();

    // Log para debugging
    console.log('Errores detectados:', errors.map(e => ({
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

  // Mejor tracking de repeticiones
  onRepetitionCounted(count: number): void {
    this.totalRepetitions = count;
    this.sessionData.repetitions = count;
    this.todayStats.repetitions = count;
    this.loadTodayStats();

    console.log('Repetición contada. Total:', count);

    // Mostrar celebración cada 5 repeticiones para testing
    if (count > 0 && count % 5 === 0) {
      this.showSuccessToast(`¡Excelente! ${count} repeticiones completadas`);
    }
  }

  // CARGAR ESTADÍSTICAS DEL DÍA
  private loadTodayStats(): void {
    this.todayStats = {
      duration: this.formatDuration(this.sessionDuration),
      repetitions: this.totalRepetitions,
      suggestions: this.sessionStats.suggestionsGiven,
      corrections: this.sessionStats.correctionsGiven
    };
  }

  // Mostrar más información en el resumen
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
          <p><strong>Session ID:</strong> ${this.sessionData.sessionId}</p>
          <hr>
          <p><em>Los datos han sido guardados en tu dashboard</em></p>
        </div>
      `,
      buttons: [
        {
          text: 'Ver Dashboard',
          handler: () => {
            this.router.navigate(['/tabs/tab1']);
          }
        },
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  // OBTENER NOMBRE DEL EJERCICIO
  getExerciseName(): string {
    const exercise = this.availableExercises.find(ex => ex.type === this.currentExercise);
    return exercise ? exercise.name : 'Ejercicio';
  }

  // FORMATEAR DURACIÓN
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // TOGGLE CONFIGURACIONES
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

  // MOSTRAR TOASTS
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

  // OBTENER COLOR DEL EJERCICIO
  getExerciseColor(exerciseType: ExerciseType): string {
    return exerciseType === this.currentExercise ? 'primary' : 'medium';
  }

  // OBTENER PROGRESO VISUAL
  getProgressPercentage(): number {
    if (!this.sessionStartTime) return 0;
    const targetDuration = 15 * 60; 
    return Math.min((this.sessionDuration / targetDuration) * 100, 100);
  }
// Método para testing rápido (opcional)
async startQuickTest(): Promise<void> {
  console.log('Iniciando test rápido...');
  
  // Simular sesión de entrenamiento para testing
  this.initializeTraining();
  
  // Simular datos después de 2 segundos
  setTimeout(async () => {
    // Simular repeticiones
    this.onRepetitionCounted(5);
    
    // Simular errores
    const fakeError: PostureError = {
      type: PostureErrorType.KNEE_VALGUS,
      severity: 8,
      description: 'Mantén las rodillas alineadas durante la sentadilla',
      recommendation: 'Separar más los pies',
      confidence: 0.9,
      timestamp: Date.now(),
      affectedJoints: ['knee'],
      correctionCues: ['Separar más los pies', 'Activar glúteos']
    };
    this.onErrorDetected([fakeError]);
    
    // Terminar sesión después de otros 2 segundos
    setTimeout(() => {
      this.stopTraining();
    }, 2000);
    
  }, 2000);
}

}