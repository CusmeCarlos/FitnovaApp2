// src/app/tab2/tab2.page.ts
// ✅ PÁGINA PRINCIPAL CORREGIDA PARA EXAMEN

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
      description: 'Ejercicio fundamental para piernas y glúteos'
    },
    { 
      type: ExerciseType.PUSHUPS, 
      name: 'Flexiones', 
      icon: 'body-outline',
      description: 'Fortalecimiento del tren superior'
    },
    { 
      type: ExerciseType.PLANK, 
      name: 'Plancha', 
      icon: 'remove-outline',
      description: 'Ejercicio isométrico para el core'
    },
    { 
      type: ExerciseType.LUNGES, 
      name: 'Estocadas', 
      icon: 'walk-outline',
      description: 'Trabajo unilateral de piernas'
    }
  ];

  // ✅ ESTADÍSTICAS DE SESIÓN
  sessionStats = {
    duration: 0,
    errorsDetected: 0,
    correctionsGiven: 0,
    averageQuality: 0
  };
  // ✅ PROPIEDADES FALTANTES PARA EL TEMPLATE
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
  errors: [] as PostureError[]
};

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
  }

  ngOnDestroy() {
    console.log('🧹 Tab2Page ngOnDestroy');
    this.stopTraining();
  }

  // 🚀 INICIAR ENTRENAMIENTO
  async startTraining(): Promise<void> {
    try {
      console.log('🚀 Iniciando entrenamiento...');
      
      if (!this.cameraComponent) {
        console.error('❌ Componente de cámara no disponible');
        this.showToast('Error: Componente de cámara no disponible', 'danger');
        return;
      }

      // Configurar componente de cámara
      this.cameraComponent.exerciseType = this.currentExercise;
      this.cameraComponent.enableAudio = this.audioEnabled;
      this.cameraComponent.enableErrorDetection = this.detectionEnabled;
      this.cameraComponent.showSkeleton = this.skeletonVisible;

      // Iniciar cámara
      await this.cameraComponent.startCamera();

      // Marcar como activo
      this.isTrainingActive = true;
      this.sessionStartTime = Date.now();
      this.resetSessionStats();

      console.log('✅ Entrenamiento iniciado');
      this.showToast('Entrenamiento iniciado correctamente', 'success');

    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      this.showToast('Error iniciando entrenamiento. Verifica permisos de cámara.', 'danger');
    }
  }

  // 🛑 PARAR ENTRENAMIENTO
  async stopTraining(): Promise<void> {
    try {
      console.log('🛑 Parando entrenamiento...');

      if (this.cameraComponent) {
        await this.cameraComponent.stopCamera();
      }

      this.isTrainingActive = false;
      this.calculateSessionDuration();

      console.log('✅ Entrenamiento parado');
      this.showToast('Entrenamiento finalizado', 'warning');

    } catch (error) {
      console.error('❌ Error parando entrenamiento:', error);
    }
  }

  // 🏋️ CAMBIAR EJERCICIO
  changeExercise(exerciseType: ExerciseType): void {
    console.log(`🏋️ Cambiando ejercicio a: ${exerciseType}`);
    
    this.currentExercise = exerciseType;
    
    if (this.cameraComponent && this.isTrainingActive) {
      this.cameraComponent.setExerciseType(exerciseType);
    }

    const exercise = this.availableExercises.find(ex => ex.type === exerciseType);
    this.showToast(`Ejercicio cambiado a: ${exercise?.name}`, 'primary');
  }

  // 🔄 RESET CONTADOR
  resetRepetitions(): void {
    console.log('🔄 Reseteando repeticiones');
    
    if (this.cameraComponent) {
      this.cameraComponent.resetRepetitions();
    }
    
    this.totalRepetitions = 0;
    this.sessionStats.errorsDetected = 0;
    this.sessionStats.correctionsGiven = 0;
    
    this.showToast('Contador reseteado', 'medium');
  }

  // 🎤 TOGGLE AUDIO
  toggleAudio(): void {
    this.audioEnabled = !this.audioEnabled;
    console.log(`🔊 Audio ${this.audioEnabled ? 'activado' : 'desactivado'}`);
    
    if (this.cameraComponent) {
      this.cameraComponent.toggleAudio();
    }
    
    this.showToast(
      `Audio ${this.audioEnabled ? 'activado' : 'desactivado'}`, 
      this.audioEnabled ? 'success' : 'medium'
    );
  }

  // 🔍 TOGGLE DETECCIÓN
  toggleDetection(): void {
    this.detectionEnabled = !this.detectionEnabled;
    console.log(`🔍 Detección ${this.detectionEnabled ? 'activada' : 'desactivada'}`);
    
    if (this.cameraComponent) {
      this.cameraComponent.toggleErrorDetection();
    }
    
    this.showToast(
      `Detección de errores ${this.detectionEnabled ? 'activada' : 'desactivada'}`, 
      this.detectionEnabled ? 'success' : 'medium'
    );
  }

  // 🎨 TOGGLE ESQUELETO
  toggleSkeleton(): void {
    this.skeletonVisible = !this.skeletonVisible;
    console.log(`🎨 Esqueleto ${this.skeletonVisible ? 'visible' : 'oculto'}`);
    
    if (this.cameraComponent) {
      this.cameraComponent.toggleSkeleton();
    }
    
    this.showToast(
      `Esqueleto ${this.skeletonVisible ? 'visible' : 'oculto'}`, 
      this.skeletonVisible ? 'success' : 'medium'
    );
  }

  // 🎤 PROBAR AUDIO
  testAudio(): void {
    console.log('🎤 Probando audio...');
    
    if (this.cameraComponent) {
      this.cameraComponent.testAudio();
    }
    
    this.showToast('Prueba de audio ejecutada', 'tertiary');
  }

  // 📊 EVENTOS DEL COMPONENTE DE CÁMARA

  // Manejar pose detectada
  onPoseDetected(pose: PoseKeypoints): void {
    // Este evento se dispara cada frame, no necesitamos hacer nada específico
    // Solo para debug si es necesario
  }

  // Manejar error detectado
  onErrorDetected(errors: PostureError[]): void {
    console.log('🚨 Errores detectados:', errors.length);
    
    this.sessionStats.errorsDetected += errors.length;
    this.sessionStats.correctionsGiven += errors.length;
    
    // Mostrar toast solo para errores críticos (severity > 7)
    const criticalErrors = errors.filter(error => error.severity > 7);
    if (criticalErrors.length > 0) {
      const errorTypes = criticalErrors.map(error => error.type).join(', ');
      this.showToast(`⚠️ Errores críticos detectados: ${errorTypes}`, 'danger');
    }
  }

  // Manejar repetición completada
  onRepetitionCounted(count: number): void {
    console.log(`🔢 Repetición completada: ${count}`);
    this.totalRepetitions = count;
    
    // Mostrar motivación cada 5 repeticiones
    if (count > 0 && count % 5 === 0) {
      this.showToast(`🎉 ¡Excelente! ${count} repeticiones completadas`, 'success');
    }
  }

  // 📊 MÉTODOS DE ESTADÍSTICAS

  // Reset estadísticas de sesión
  private resetSessionStats(): void {
    this.sessionStats = {
      duration: 0,
      errorsDetected: 0,
      correctionsGiven: 0,
      averageQuality: 0
    };
    this.totalRepetitions = 0;
  }

  // Calcular duración de sesión
  private calculateSessionDuration(): void {
    if (this.sessionStartTime) {
      this.sessionStats.duration = Math.round((Date.now() - this.sessionStartTime) / 1000);
    }
  }

  // Obtener estadísticas formateadas
  getFormattedDuration(): string {
    const minutes = Math.floor(this.sessionStats.duration / 60);
    const seconds = this.sessionStats.duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // 📱 MÉTODOS DE UI

  // Obtener nombre del ejercicio actual
  getCurrentExerciseName(): string {
    const exercise = this.availableExercises.find(ex => ex.type === this.currentExercise);
    return exercise?.name || 'Desconocido';
  }

  // Obtener icono del ejercicio actual
  getCurrentExerciseIcon(): string {
    const exercise = this.availableExercises.find(ex => ex.type === this.currentExercise);
    return exercise?.icon || 'fitness-outline';
  }

  // Obtener descripción del ejercicio actual
  getCurrentExerciseDescription(): string {
    const exercise = this.availableExercises.find(ex => ex.type === this.currentExercise);
    return exercise?.description || '';
  }

  // Verificar si hay estadísticas de cámara disponibles
  getCameraStats(): any {
    return this.cameraComponent ? this.cameraComponent.getCurrentStats() : null;
  }

  // 🍞 MOSTRAR TOAST
  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  // 📋 MOSTRAR INFO DEL EJERCICIO
  async showExerciseInfo(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.getCurrentExerciseName(),
      subHeader: 'Información del ejercicio',
      message: `
        <p><strong>Descripción:</strong><br>
        ${this.getCurrentExerciseDescription()}</p>
        
        <p><strong>Beneficios:</strong><br>
        ${this.getExerciseBenefits()}</p>
        
        <p><strong>Consejos:</strong><br>
        ${this.getExerciseTips()}</p>
      `,
      buttons: ['Entendido']
    });

    await alert.present();
  }

  // Obtener beneficios del ejercicio
  private getExerciseBenefits(): string {
    const benefits = {
      [ExerciseType.SQUATS]: 'Fortalece piernas, glúteos y core. Mejora la funcionalidad en actividades diarias.',
      [ExerciseType.PUSHUPS]: 'Desarrolla pecho, hombros, tríceps y core. Mejora la fuerza del tren superior.',
      [ExerciseType.PLANK]: 'Fortalece toda la musculatura del core. Mejora la estabilidad y postura.',
      [ExerciseType.LUNGES]: 'Trabajo unilateral que mejora equilibrio y corrige asimetrías musculares.',
      [ExerciseType.BICEP_CURLS]: 'Fortalece bíceps y mejora la fuerza de brazos.',
      [ExerciseType.DEADLIFTS]: 'Ejercicio completo que fortalece toda la cadena posterior.',
      [ExerciseType.OVERHEAD_PRESS]: 'Desarrolla hombros y estabilidad del core.'
    };
    return benefits[this.currentExercise] || 'Ejercicio beneficial para la salud general.';
  }

  // Obtener consejos del ejercicio
  private getExerciseTips(): string {
    const tips = {
      [ExerciseType.SQUATS]: 'Mantén los pies separados al ancho de hombros. Baja como si te sentaras en una silla.',
      [ExerciseType.PUSHUPS]: 'Mantén el cuerpo recto como una tabla. Controla la bajada y subida.',
      [ExerciseType.PLANK]: 'Mantén la línea desde cabeza hasta talones. Respira normalmente.',
      [ExerciseType.LUNGES]: 'Da pasos amplios. Mantén el peso en el talón del pie delantero.',
      [ExerciseType.BICEP_CURLS]: 'Mantén codos fijos pegados al torso. Controla el movimiento.',
      [ExerciseType.DEADLIFTS]: 'Mantén la espalda recta y levanta con las piernas.',
      [ExerciseType.OVERHEAD_PRESS]: 'Mantén el core activado y empuja verticalmente.'
    };
    return tips[this.currentExercise] || 'Ejecuta el movimiento de forma controlada.';
  }

  // 🚪 CERRAR SESIÓN
  async logout(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar Sesión',
          handler: async () => {
            await this.stopTraining();
            await this.auth.logout();
            this.router.navigate(['/auth/login']);
          }
        }
      ]
    });

    await alert.present();
  }
  // ✅ MÉTODOS FALTANTES PARA EL TEMPLATE
startExercise(exerciseType: string): void {
  this.selectedExercise = exerciseType as ExerciseType;
  this.showCamera = true;
  this.startTraining();
}

exitCamera(): void {
  this.showCamera = false;
  this.stopTraining();
}

getExerciseName(exercise: ExerciseType): string {
  const exercise_obj = this.availableExercises.find(ex => ex.type === exercise);
  return exercise_obj?.name || 'Ejercicio';
}

showDetailedStats(): void {
  // Implementar modal o navegación a estadísticas detalladas
  console.log('Mostrar estadísticas detalladas');
}


trackByErrorType(index: number, error: PostureError): string {
  return error.type;
}
}