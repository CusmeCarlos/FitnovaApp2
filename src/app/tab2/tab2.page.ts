// src/app/tab2/tab2.page.ts
// ✅ PÁGINA PRINCIPAL CORREGIDA - INCREMENTO 2

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
  }

  ngOnDestroy() {
    this.clearSessionTimer();
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
      'bicep_curls': ExerciseType.BICEP_CURLS
    };

    const exercise = exerciseMap[exerciseType];
    
    if (!exercise) {
      console.log('❌ Ejercicio no disponible:', exerciseType);
      await this.showToast('Ejercicio no disponible aún', 'warning');
      return;
    }

    try {
      console.log('📷 Verificando permisos de cámara...');
      
      // Verificar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      // Detener inmediatamente, solo verificamos permisos
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Permisos concedidos');
      
      // Configurar ejercicio
      this.selectedExercise = exercise;
      this.resetSessionData();
      this.showCamera = true;
      
      console.log('🎬 Mostrando vista de cámara');
      console.log('📊 Estado final:', {
        selectedExercise: this.selectedExercise,
        showCamera: this.showCamera
      });
      
      await this.showToast(`Iniciando ${this.getExerciseName(exercise)}`, 'success');
      
    } catch (error) {
      console.error('❌ Error accediendo a la cámara:', error);
      await this.showCameraPermissionAlert();
    }
  }

  // 🚪 SALIR DE LA CÁMARA
  async exitCamera() {
    console.log('🚪 Saliendo de cámara...');
    
    this.clearSessionTimer();
    
    if (this.sessionData.repetitions > 0) {
      const alert = await this.alertController.create({
        header: 'Finalizar Sesión',
        message: `¿Quieres guardar tu progreso?\n\nHas completado:\n• ${this.sessionData.repetitions} repeticiones\n• ${this.sessionData.duration} minutos\n• ${this.sessionData.avgQuality}% calidad promedio`,
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

  // 📊 EVENTOS DE LA CÁMARA

  onPoseDetected(pose: PoseKeypoints) {
    // Pose detectada - se podría usar para analytics futuro
    // console.log('🎯 Pose detectada');
  }

  onErrorDetected(errors: PostureError[]) {
    this.sessionData.errors = errors;
    this.sessionData.totalErrors += errors.length;
    
    // Mostrar toast para errores críticos (severidad >= 8)
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
    
    // Mensaje de aliento cada 5 repeticiones
    if (repetitionCount % 5 === 0 && repetitionCount > 0) {
      this.showToast(`¡${repetitionCount} repeticiones! ¡Excelente trabajo!`, 'success');
    }
  }

  onQualityScore(score: number) {
    this.qualityScores.push(score);
    
    // Calcular promedio de calidad
    if (this.qualityScores.length > 0) {
      const sum = this.qualityScores.reduce((a, b) => a + b, 0);
      this.sessionData.avgQuality = Math.round(sum / this.qualityScores.length);
    }
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
      
      await this.showToast('¡Sesión guardada correctamente!', 'success');
      
      // Mostrar resumen
      await this.showSessionSummary();
      
      this.showCamera = false;
      
    } catch (error) {
      console.error('❌ Error guardando sesión:', error);
      await this.showToast('Error al guardar la sesión', 'danger');
    }
  }

  // 📋 MOSTRAR RESUMEN DE SESIÓN
  private async showSessionSummary() {
    const alert = await this.alertController.create({
      header: '🎉 ¡Sesión Completada!',
      message: `
        <div style="text-align: left; line-height: 1.6;">
          <strong>📊 Resumen:</strong><br>
          • Ejercicio: ${this.getExerciseName(this.selectedExercise)}<br>
          • Repeticiones: ${this.sessionData.repetitions}<br>
          • Duración: ${this.sessionData.duration} min<br>
          • Calidad promedio: ${this.sessionData.avgQuality}%<br>
          • Errores detectados: ${this.sessionData.totalErrors}<br><br>
          
          <strong>🏆 Estadísticas de hoy:</strong><br>
          • Total repeticiones: ${this.todayStats.repetitions}<br>
          • Tiempo total: ${this.todayStats.duration} min<br>
          • Calidad promedio: ${this.todayStats.avgQuality}%
        </div>
      `,
      buttons: [
        {
          text: 'Continuar',
          role: 'cancel'
        },
        {
          text: 'Entrenar de nuevo',
          handler: () => {
            this.startExercise(this.selectedExercise);
          }
        }
      ]
    });
    await alert.present();
  }

  // 🔄 RESETEAR DATOS DE SESIÓN
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
    
    // Iniciar timer de duración
    this.startSessionTimer();
  }

  // ⏱️ INICIAR TIMER DE SESIÓN
  private startSessionTimer() {
    this.clearSessionTimer();
    
    this.sessionTimer = setInterval(() => {
      if (this.sessionData.startTime) {
        const duration = (Date.now() - this.sessionData.startTime.getTime()) / (1000 * 60);
        this.sessionData.duration = Math.round(duration * 10) / 10;
      }
    }, 1000);
  }

  // 🛑 LIMPIAR TIMER
  private clearSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  // 📈 CARGAR ESTADÍSTICAS DEL DÍA
  private loadTodayStats() {
    // TODO: Cargar desde Firebase/localStorage
    // Por ahora usar datos de ejemplo o valores por defecto
    const savedStats = localStorage.getItem('fitnova_today_stats');
    
    if (savedStats) {
      try {
        this.todayStats = JSON.parse(savedStats);
      } catch (error) {
        console.error('Error cargando estadísticas:', error);
        this.resetTodayStats();
      }
    } else {
      this.resetTodayStats();
    }
  }

  // 🔄 RESETEAR ESTADÍSTICAS DEL DÍA
  private resetTodayStats() {
    this.todayStats = {
      duration: 0,
      repetitions: 0,
      avgQuality: 0
    };
    this.saveTodayStats();
  }

  // 💾 GUARDAR ESTADÍSTICAS DEL DÍA
  private saveTodayStats() {
    try {
      localStorage.setItem('fitnova_today_stats', JSON.stringify(this.todayStats));
    } catch (error) {
      console.error('Error guardando estadísticas:', error);
    }
  }

  // 🏷️ OBTENER NOMBRE DEL EJERCICIO
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

  // 🔍 TRACK BY PARA ERRORES
  public trackByErrorType(index: number, error: PostureError): string {
    return error.type;
  }

  // 📱 MOSTRAR TOAST
  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  // 📷 ALERTA DE PERMISOS DE CÁMARA
  private async showCameraPermissionAlert() {
    const alert = await this.alertController.create({
      header: 'Permisos de Cámara Requeridos',
      subHeader: 'Acceso necesario para la detección de postura',
      message: 'FitNova necesita acceso a tu cámara para analizar tu postura en tiempo real y brindarte retroalimentación inmediata.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Configuración',
          handler: () => {
            // En algunos navegadores se puede abrir la configuración
            if (navigator.userAgent.includes('Chrome')) {
              window.open('chrome://settings/content/camera', '_blank');
            }
          }
        },
        {
          text: 'Reintentar',
          handler: () => {
            // Intentar de nuevo después de un momento
            setTimeout(() => {
              this.startExercise(this.selectedExercise);
            }, 1000);
          }
        }
      ]
    });
    await alert.present();
  }

  // 📊 MOSTRAR ESTADÍSTICAS DETALLADAS
  async showDetailedStats() {
    const alert = await this.alertController.create({
      header: '📊 Estadísticas Detalladas',
      message: `
        <div style="text-align: left; line-height: 1.6;">
          <strong>🏃 Sesión Actual:</strong><br>
          • Ejercicio: ${this.showCamera ? this.getExerciseName(this.selectedExercise) : 'Ninguno'}<br>
          • Repeticiones: ${this.sessionData.repetitions}<br>
          • Duración: ${this.sessionData.duration} min<br>
          • Calidad promedio: ${this.sessionData.avgQuality}%<br>
          • Errores detectados: ${this.sessionData.totalErrors}<br><br>
          
          <strong>📅 Estadísticas de hoy:</strong><br>
          • Tiempo total: ${this.todayStats.duration} min<br>
          • Repeticiones totales: ${this.todayStats.repetitions}<br>
          • Calidad promedio: ${this.todayStats.avgQuality}%<br><br>
          
          <strong>🎯 Consejos:</strong><br>
          • Mantén una postura correcta<br>
          • Respira de forma controlada<br>
          • Enfócate en la calidad sobre cantidad
        </div>
      `,
      buttons: [
        {
          text: 'Cerrar'
        },
        {
          text: 'Resetear día',
          handler: () => {
            this.resetTodayStats();
            this.showToast('Estadísticas del día reseteadas', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  // 🎯 OBTENER CONSEJO ALEATORIO PARA EL EJERCICIO ACTUAL
  public getCurrentCoachingTip(): string {
    const tips: { [key in ExerciseType]?: string[] } = {
      [ExerciseType.SQUATS]: [
        'Mantén el pecho erguido y la mirada al frente',
        'Baja como si te fueras a sentar en una silla',
        'Los talones siempre en el suelo',
        'Las rodillas deben seguir la dirección de los pies',
        'Inicia el movimiento empujando las caderas hacia atrás'
      ],
      [ExerciseType.PUSHUPS]: [
        'Forma una línea recta desde cabeza hasta talones',
        'Los codos a 45° del cuerpo, no muy abiertos',
        'Baja hasta que el pecho casi toque el suelo',
        'Mantén el core contraído durante todo el movimiento',
        'Respira: inhala al bajar, exhala al subir'
      ],
      [ExerciseType.PLANK]: [
        'Mantén una línea recta desde cabeza hasta talones',
        'Contrae el core como si fueras a recibir un golpe',
        'Respira normalmente, no contengas la respiración',
        'Los codos directamente bajo los hombros',
        'Aprieta los glúteos para mantener la posición'
      ],
      [ExerciseType.LUNGES]: [
        'Da un paso lo suficientemente largo',
        'Baja la rodilla trasera hacia el suelo',
        'Mantén el torso erguido',
        'El peso debe estar en el talón del pie delantero'
      ],
      [ExerciseType.BICEP_CURLS]: [
        'Mantén los codos pegados al cuerpo',
        'Controla el movimiento tanto al subir como al bajar',
        'No uses impulso, usa solo los bíceps',
        'Mantén las muñecas rectas'
      ]
    };

    const exerciseTips = tips[this.selectedExercise] || ['¡Sigue así! Estás haciendo un gran trabajo.'];
    const randomIndex = Math.floor(Math.random() * exerciseTips.length);
    return exerciseTips[randomIndex];
  }
}