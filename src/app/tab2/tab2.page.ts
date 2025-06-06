// src/app/tab2/tab2.page.ts
// REEMPLAZA TODO EL CONTENIDO

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/user.interface';
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
    errors: [] as PostureError[]
  };

  // Estadísticas del día
  todayStats = {
    duration: 0,
    repetitions: 0,
    avgQuality: 0
  };

  // Para almacenar puntuaciones de calidad
  private qualityScores: number[] = [];

  constructor(
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    // Suscribirse al usuario actual
    this.authService.user$.subscribe(user => {
      this.user = user;
    });
    
    // Cargar estadísticas del día
    this.loadTodayStats();
  }

  ngOnDestroy() {
    // Limpiar recursos si es necesario
  }

  // 🏋️ INICIAR EJERCICIO CON CÁMARA
  async startExercise(exerciseType: string) {
    console.log('🎯 === startExercise LLAMADO ===');
    console.log('🎯 Tipo de ejercicio:', exerciseType);
  
    const exerciseMap: { [key: string]: ExerciseType } = {
      'squats': ExerciseType.SQUATS,
      'pushups': ExerciseType.PUSHUPS,
      'plank': ExerciseType.PLANK,
      'lunges': ExerciseType.LUNGES,
      'bicep_curls': ExerciseType.BICEP_CURLS
    };
  
    const exercise = exerciseMap[exerciseType];
    
    console.log('🎯 Ejercicio mapeado:', exercise);
    
    if (!exercise) {
      console.log('❌ Ejercicio no disponible:', exerciseType);
      await this.showToast('Ejercicio no disponible aún', 'warning');
      return;
    }
  
    // Solicitar permisos de cámara
    try {
      console.log('📷 Solicitando permisos de cámara...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Detener inmediatamente, solo verificamos permisos
      
      console.log('✅ Permisos de cámara concedidos');
      console.log('📝 Configurando ejercicio y mostrando cámara...');
      
      this.selectedExercise = exercise;
      this.resetSessionData();
      this.showCamera = true;
      
      console.log('🎬 Estado después de cambios:');
      console.log('  - selectedExercise:', this.selectedExercise);
      console.log('  - showCamera:', this.showCamera);
      
      await this.showToast(`Iniciando ${this.getExerciseName(exercise)}`, 'success');
      
    } catch (error) {
      console.error('❌ Error accediendo a la cámara:', error);
      await this.showCameraPermissionAlert();
    }
    
    console.log('🏁 === FIN DE startExercise ===');
  }

  // 🚪 SALIR DE LA CÁMARA
  async exitCamera() {
    if (this.sessionData.repetitions > 0) {
      const alert = await this.alertController.create({
        header: 'Finalizar Sesión',
        message: `¿Quieres guardar tu progreso? Has completado ${this.sessionData.repetitions} repeticiones.`,
        buttons: [
          {
            text: 'Descartar',
            role: 'cancel',
            handler: () => {
              this.showCamera = false;
              this.resetSessionData();
            }
          },
          {
            text: 'Guardar',
            handler: () => {
              this.saveSession();
              this.showCamera = false;
            }
          }
        ]
      });
      await alert.present();
    } else {
      this.showCamera = false;
      this.resetSessionData();
    }
  }

  // 📊 EVENTOS DE LA CÁMARA

  onPoseDetected(pose: PoseKeypoints) {
    // Pose detectada - se podría usar para analytics
    console.log('🎯 Pose detectada');
  }

  onErrorDetected(errors: PostureError[]) {
    this.sessionData.errors = errors;
    this.sessionData.totalErrors += errors.length;
    
    // Mostrar toast para errores críticos
    const criticalErrors = errors.filter(error => error.severity >= 8);
    if (criticalErrors.length > 0) {
      this.showToast(criticalErrors[0].description, 'danger');
    }
  }

  onRepetitionComplete(repetitionCount: number) {
    this.sessionData.repetitions = repetitionCount;
    
    // Feedback háptico si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
    
    // Mensaje de aliento
    if (repetitionCount % 5 === 0) {
      this.showToast(`¡${repetitionCount} repeticiones! ¡Sigue así!`, 'success');
    }
  }

  onQualityScore(score: number) {
    this.qualityScores.push(score);
    
    // Calcular promedio de calidad
    const sum = this.qualityScores.reduce((a, b) => a + b, 0);
    this.sessionData.avgQuality = Math.round(sum / this.qualityScores.length);
  }

  // 💾 GUARDAR SESIÓN
  private async saveSession() {
    // Aquí se implementaría el guardado en Firestore
    // Por ahora solo actualizamos las estadísticas locales
    
    this.todayStats.repetitions += this.sessionData.repetitions;
    this.todayStats.avgQuality = this.sessionData.avgQuality;
    
    // Calcular duración de la sesión
    if (this.sessionData.startTime) {
      const duration = (Date.now() - this.sessionData.startTime.getTime()) / (1000 * 60); // minutos
      this.todayStats.duration += Math.round(duration);
    }
    
    await this.showToast('Sesión guardada correctamente', 'success');
    
    // TODO: Guardar en Firebase
    // await this.saveToFirebase();
  }

  // 🔄 RESETEAR DATOS DE SESIÓN
  private resetSessionData() {
    this.sessionData = {
      repetitions: 0,
      totalErrors: 0,
      avgQuality: 0,
      startTime: new Date(),
      errors: []
    };
    this.qualityScores = [];
  }

  // 📈 CARGAR ESTADÍSTICAS DEL DÍA
  private loadTodayStats() {
    // TODO: Cargar desde Firebase
    // Por ahora usar datos de ejemplo
    this.todayStats = {
      duration: 0,
      repetitions: 0,
      avgQuality: 0
    };
  }

  // 🏷️ OBTENER NOMBRE DEL EJERCICIO - ✅ AHORA ES PÚBLICO
  public getExerciseName(exercise: ExerciseType): string {
    const names = {
      [ExerciseType.SQUATS]: 'Sentadillas',
      [ExerciseType.PUSHUPS]: 'Flexiones',
      [ExerciseType.PLANK]: 'Plancha',
      [ExerciseType.LUNGES]: 'Estocadas',
      [ExerciseType.BICEP_CURLS]: 'Curl de Bíceps',
      [ExerciseType.DEADLIFT]: 'Peso Muerto',
      [ExerciseType.BENCH_PRESS]: 'Press de Banca',
      [ExerciseType.SHOULDER_PRESS]: 'Press de Hombros'
    };
    return names[exercise] || 'Ejercicio';
  }

  // 🔍 TRACK BY PARA ERRORES - ✅ AHORA ES PÚBLICO
  public trackByErrorType(index: number, error: PostureError): string {
    return error.type;
  }

  // 📱 MOSTRAR TOAST
  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  // 📷 ALERTA DE PERMISOS DE CÁMARA
  private async showCameraPermissionAlert() {
    const alert = await this.alertController.create({
      header: 'Permisos de Cámara',
      subHeader: 'Acceso requerido',
      message: 'FitNova necesita acceso a tu cámara para detectar tu postura en tiempo real. Por favor, permite el acceso cuando te lo solicite el navegador.',
      buttons: [
        {
          text: 'Entendido',
          role: 'cancel'
        },
        {
          text: 'Configuración',
          handler: () => {
            // Redirigir a configuración del navegador
            window.open('chrome://settings/content/camera', '_blank');
          }
        }
      ]
    });
    await alert.present();
  }

  // 📊 MOSTRAR ESTADÍSTICAS DETALLADAS
  async showDetailedStats() {
    const alert = await this.alertController.create({
      header: 'Estadísticas Detalladas',
      message: `
        <strong>Sesión Actual:</strong><br>
        • Repeticiones: ${this.sessionData.repetitions}<br>
        • Calidad promedio: ${this.sessionData.avgQuality}%<br>
        • Errores detectados: ${this.sessionData.totalErrors}<br><br>
        
        <strong>Hoy:</strong><br>
        • Tiempo total: ${this.todayStats.duration} min<br>
        • Repeticiones totales: ${this.todayStats.repetitions}<br>
        • Calidad promedio: ${this.todayStats.avgQuality}%
      `,
      buttons: ['Cerrar']
    });
    await alert.present();
  }
}