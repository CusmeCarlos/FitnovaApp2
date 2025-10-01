// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ COMPONENTE COMPLETO CON TODOS LOS SERVICIOS INTEGRADOS

import { 
  Component, 
  ElementRef, 
  ViewChild, 
  OnInit, 
  OnDestroy, 
  Input, 
  Output, 
  EventEmitter,
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subscription, timer } from 'rxjs';

import { PoseDetectionEngine } from '../../../../core/pose-engine/pose-detection.engine';
import { BiomechanicsAnalyzer, ReadinessState } from '../../../../core/pose-engine/biomechanics.analyzer';
import { AudioService } from '../../../../services/audio.service';
import { CaptureService } from '../../../../services/capture.service'; // ✅ NUEVO
import { NotificationService } from '../../../../services/notification.service'; // ✅ NUEVO
import { FCMService } from '../../../../services/fcm.service'; // ✅ NUEVO FCM SERVICE
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  ExerciseType,
  RepetitionPhase, 
  PostureErrorType
} from '../../../../shared/models/pose.models';
import { CloudFunctionsService } from 'src/app/services/cloud-functions.service';

@Component({
  selector: 'app-pose-camera',
  templateUrl: './pose-camera.component.html',
  styleUrls: ['./pose-camera.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoseCameraComponent implements OnInit, AfterViewInit, OnDestroy {
  
  @ViewChild('videoElement', { static: true }) videoElementRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: true }) canvasElementRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayElement', { static: true }) overlayElementRef!: ElementRef<HTMLCanvasElement>;

  // ✅ INPUTS Y OUTPUTS
  @Input() exerciseType: ExerciseType = ExerciseType.SQUATS;
  @Input() enableErrorDetection = true;
  @Input() showSkeleton = true;
  @Input() enableAudio = true;
  
  @Output() poseDetected = new EventEmitter<PoseKeypoints>();
  @Output() errorDetected = new EventEmitter<PostureError[]>();
  @Output() repetitionCounted = new EventEmitter<number>();

  // ✅ ESTADO DEL COMPONENTE
  isLoading = true;
  isInitialized = false;
  error: string | null = null;
  fps = 0;

  // ✅ DATOS ACTUALES
  currentPose: PoseKeypoints | null = null;
  currentAngles: BiomechanicalAngles | null = null;
  currentErrors: PostureError[] = [];
  repetitionCount = 0;
  currentPhase: RepetitionPhase = RepetitionPhase.IDLE;
  currentQualityScore = 0;

  // ✅ ESTADOS DE PREPARACIÓN
  currentReadinessState: ReadinessState = ReadinessState.NOT_READY;
  readinessMessage = '';

  // ✅ NUEVAS PROPIEDADES PARA SERVICIOS INTEGRADOS
  private currentSessionId: string | null = null;
  private hasSessionStarted = false;
  private criticalErrorsSent = new Set<string>(); // Para evitar spam de notificaciones

  // ✅ ESTADO DE AUDIO (PARA TEMPLATE)
  get isPlayingAudio(): boolean {
    return this.audioService.isCurrentlyPlaying();
  }

  // ✅ CONTEXTOS DE CANVAS
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  // ✅ SUBSCRIPCIONES
  private subscriptions: Subscription[] = [];

  // ✅ CONTROL DE INICIALIZACIÓN
  private initializationTimer: any = null;
  initializationAttempts = 0;
  readonly maxInitializationAttempts = 10;

  // ✅ SISTEMA DE COLORES PARA ERRORES
  errorColors = {
    good: '#22c55e',      // VERDE - Buena forma
    warning: '#f59e0b',   // NARANJA - Errores moderados  
    critical: '#ef4444',  // ROJO - Errores críticos
    preparing: '#3b82f6'  // AZUL - Preparándose
  };

  constructor(
    private poseEngine: PoseDetectionEngine,
    private biomechanicsAnalyzer: BiomechanicsAnalyzer,
    private audioService: AudioService,
    private captureService: CaptureService, // ✅ NUEVO
    private notificationService: NotificationService, // ✅ NUEVO
    private cloudFunctions: CloudFunctionsService, // ✅ NUEVO
    private fcmService: FCMService, // ✅ NUEVO FCM SERVICE
    private cdr: ChangeDetectorRef
  ) {
    console.log('🎬 PoseCameraComponent constructor con todos los servicios');
  }

  async ngOnInit() {
    console.log('🚀 PoseCameraComponent ngOnInit');
    this.setupSubscriptions();
    
    // ✅ CONFIGURAR SERVICIOS CON FCM
    this.audioService.setEnabled(this.enableAudio);
    await this.initializeServices();
  }

  ngAfterViewInit() {
    console.log('🔄 PoseCameraComponent ngAfterViewInit');
    
    // Configurar contextos de canvas
    this.canvasCtx = this.canvasElementRef.nativeElement.getContext('2d');
    this.overlayCtx = this.overlayElementRef.nativeElement.getContext('2d');
    
    // Iniciar cámara automáticamente
    this.startCamera();
  }

  ngOnDestroy() {
    console.log('🧹 PoseCameraComponent ngOnDestroy');
    this.cleanup();
  }

  // ✅ INICIALIZAR SERVICIOS CON FCM SIMPLE
  private async initializeServices(): Promise<void> {
    try {
      // ✅ INICIALIZAR FCM BÁSICO
      await this.fcmService.initialize();
      console.log('🔔 FCM Service inicializado correctamente');
    } catch (error) {
      console.error('🛑 Error inicializando servicios:', error);
    }
  }

  // 📡 CONFIGURAR SUBSCRIPCIONES
  private setupSubscriptions(): void {
    // Configurar analizador
    this.biomechanicsAnalyzer.setCurrentExercise(this.exerciseType);

    // Suscribirse a pose
    this.subscriptions.push(
      this.poseEngine.pose$.subscribe(pose => {
        this.currentPose = pose;
        if (pose) {
          this.poseDetected.emit(pose);
          this.drawSkeleton(pose);
        }
        this.cdr.detectChanges();
      })
    );

    // Suscribirse a ángulos y hacer análisis
    this.subscriptions.push(
      this.poseEngine.angles$.subscribe(angles => {
        this.currentAngles = angles;
        
        if (angles && this.currentPose && this.enableErrorDetection) {
          this.analyzeMovementWithStates(this.currentPose, angles);
        }
        
        this.cdr.detectChanges();
      })
    );

    // Suscribirse a FPS
    this.subscriptions.push(
      this.poseEngine.fps$.subscribe(fps => {
        this.fps = fps;
        this.cdr.detectChanges();
      })
    );

    // Suscribirse a estado
    this.subscriptions.push(
      this.poseEngine.status$.subscribe(status => {
        console.log('📊 Estado del engine:', status);
        if (status === 'error') {
          this.error = 'Error en el motor de detección';
          this.isLoading = false;
        }
        this.cdr.detectChanges();
      })
    );
  }

  // 🧠 ANÁLIZAR MOVIMIENTO CON ESTADOS DE PREPARACIÓN (INTEGRACIÓN COMPLETA)
  private analyzeMovementWithStates(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    try {
      const analysis = this.biomechanicsAnalyzer.analyzeMovement(pose, angles);
      
      // ✅ ACTUALIZAR ESTADO DE PREPARACIÓN
      const prevReadinessState = this.currentReadinessState;
      this.currentReadinessState = this.biomechanicsAnalyzer.getReadinessState();
      this.readinessMessage = this.biomechanicsAnalyzer.getReadinessMessage();
      
      console.log('📊 Análisis:', {
        readinessState: this.currentReadinessState,
        errorsCount: analysis.errors.length,
        phase: analysis.phase,
        repetitions: analysis.repetitionCount,
        quality: analysis.qualityScore
      });

      // ✅ MANEJAR CAMBIOS DE ESTADO DE PREPARACIÓN
      this.handleReadinessStateChange(prevReadinessState, this.currentReadinessState);

      // ✅ ACTUALIZAR DATOS GENERALES
      const previousCount = this.repetitionCount;
      this.repetitionCount = analysis.repetitionCount;
      this.currentPhase = analysis.phase;
      this.currentQualityScore = analysis.qualityScore;
      
      // ✅ DETECTAR NUEVA REPETICIÓN
      if (this.repetitionCount > previousCount && this.currentReadinessState === ReadinessState.EXERCISING) {
        console.log(`🎉 ¡NUEVA REPETICIÓN! Total: ${this.repetitionCount}`);
        this.repetitionCounted.emit(this.repetitionCount);
        
        // ✅ AUDIO DE REPETICIÓN
        if (this.repetitionCount % 5 === 0) {
          this.audioService.speakSuccess(`¡Excelente! ${this.repetitionCount} repeticiones completadas`);
        }
      }

      // ✅ INTEGRACIÓN COMPLETA: CAPTURA + NOTIFICACIONES + CLOUD FUNCTIONS
      this.handleCriticalErrorsIntegration(analysis.errors);

      // ✅ PROCESAR SEGÚN ESTADO
      if (this.currentReadinessState === ReadinessState.EXERCISING) {
        this.processExerciseErrors(analysis.errors, previousCount);
      } else {
        this.processReadinessErrors(analysis.errors);
        this.clearErrorOverlay();
      }

    } catch (error) {
      console.error('❌ Error en análisis biomecánico:', error);
    }
  }

  // ✅ NUEVO: INTEGRACIÓN COMPLETA DE SERVICIOS PARA ERRORES CRÍTICOS
  private async handleCriticalErrorsIntegration(errors: PostureError[]): Promise<void> {
    // Solo procesar si hay sesión activa
    if (!this.currentSessionId || !this.hasSessionStarted) return;
    
    // Buscar errores críticos (severity >= 7)
    const criticalErrors = errors.filter(error => error.severity >= 7);
    
    if (criticalErrors.length > 0) {
      const mostCritical = criticalErrors.reduce((prev, current) => 
        current.severity > prev.severity ? current : prev
      );
      
      console.log(`🚨 Error crítico detectado: ${mostCritical.type} (severity: ${mostCritical.severity})`);
      
      // 1️⃣ CAPTURA AUTOMÁTICA
      await this.handleCriticalErrorCapture(mostCritical);
      
      // 2️⃣ NOTIFICACIÓN AL ENTRENADOR
      await this.handleCriticalErrorNotification(mostCritical);
      
      // 3️⃣ PROCESAMIENTO CON CLOUD FUNCTIONS
      await this.handleCriticalErrorProcessing(mostCritical);
    }
  }

  // ✅ CAPTURA AUTOMÁTICA DE ERRORES CRÍTICOS
  private async handleCriticalErrorCapture(error: PostureError): Promise<void> {
    if (!this.captureService.canCaptureError(error.type)) {
      console.log('📸 Error ya capturado o límite alcanzado para:', error.type);
      return;
    }

    try {
      const canvas = this.canvasElementRef.nativeElement;
      
      const success = await this.captureService.captureErrorIfNeeded(
        canvas,
        error.type,
        error.severity.toString(),
        {
          affectedJoints: error.affectedJoints,
          confidence: error.confidence,
          recommendation: error.recommendation,
          timestamp: error.timestamp,
          exerciseType: this.exerciseType,
          currentPhase: this.currentPhase
        }
      );
      
      if (success) {
        console.log('📸 ¡Captura automática realizada exitosamente!');
        this.showCaptureNotification();
      }
      
    } catch (error) {
      console.error('🛑 Error durante captura automática:', error);
    }
  }

  // ✅ NUEVO: NOTIFICACIÓN AL ENTRENADOR
  private async handleCriticalErrorNotification(error: PostureError): Promise<void> {
    const errorKey = `${error.type}_${this.currentSessionId}`;
    
    // Evitar spam: solo una notificación por tipo de error por sesión
    if (this.criticalErrorsSent.has(errorKey)) return;
    
    try {
      const success = await this.notificationService.sendCriticalAlert(
        error.type,
        this.exerciseType,
        'critical', // Severidad
        this.currentSessionId!,
        undefined, // captureURL (opcional)
        {
          description: error.description,
          severity: error.severity,
          biomechanicsData: {
            affectedJoints: error.affectedJoints,
            confidence: error.confidence
          },
          deviceInfo: {
            timestamp: error.timestamp,
            exerciseType: this.exerciseType,
            currentPhase: this.currentPhase
          }
        }
      );

      if (success) {
        this.criticalErrorsSent.add(errorKey);
        console.log('🔔 Notificación enviada al entrenador');
        
        // ✅ MOSTRAR NOTIFICACIÓN LOCAL AL USUARIO TAMBIÉN
        this.fcmService.showLocalNotification(
          'Error Crítico Detectado',
          `${error.description} - Entrenador notificado`
        );
      }
      
    } catch (error) {
      console.error('🛑 Error enviando notificación:', error);
    }
  }

  // ✅ NUEVO: PROCESAMIENTO CON CLOUD FUNCTIONS
  private async handleCriticalErrorProcessing(error: PostureError): Promise<void> {
    try {
      const processResult = await this.cloudFunctions.processBiomechanicsAnalysis({
        errorType: error.type,
        severity: error.severity,
        sessionId: this.currentSessionId!,
        exerciseType: this.exerciseType,
        biomechanicsData: {
          affectedJoints: error.affectedJoints,
          confidence: error.confidence,
          timestamp: error.timestamp
        }
      });

      if (processResult.success) {
        console.log('☁️ Error procesado por Cloud Functions:', processResult.data);
        
        // Opcional: Mostrar recomendaciones personalizadas del backend
        if (processResult.data?.personalizedRecommendation) {
          this.audioService.speak(processResult.data.personalizedRecommendation, 'info', 'normal');
        }
      }
      
    } catch (error) {
      console.error('🛑 Error en Cloud Functions:', error);
    }
  }

  // ✅ NOTIFICACIÓN VISUAL DE CAPTURA
  private showCaptureNotification(): void {
    const overlay = this.overlayElementRef.nativeElement;
    const ctx = overlay.getContext('2d');
    
    if (ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(overlay.width - 60, 10, 50, 20);
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.fillText('📸', overlay.width - 50, 25);
      ctx.restore();
      
      setTimeout(() => {
        if (ctx) {
          ctx.clearRect(overlay.width - 60, 10, 50, 20);
        }
      }, 1000);
    }
  }

  // 🏃 PROCESAR ERRORES DURANTE EJERCICIO
  private processExerciseErrors(errors: PostureError[], previousCount: number): void {
    const newErrors = this.filterNewErrors(errors);
    
    if (newErrors.length > 0) {
      console.log('🚨 Errores reales detectados:', newErrors.map(e => e.description));
      this.currentErrors = newErrors;
      this.errorDetected.emit(newErrors);
      
      // ✅ AUDIO PARA ERRORES (SOLO SI NO HAY REPETICIÓN NUEVA)
      if (this.repetitionCount === previousCount) {
        const mostSevereError = this.getMostSevereError(newErrors);
        if (mostSevereError) {
          if (mostSevereError.severity >= 7) {
            this.audioService.speakCritical(mostSevereError.recommendation);
          } else if (mostSevereError.severity >= 5) {
            this.audioService.speakError(mostSevereError.recommendation);
          } else {
            this.audioService.speak(mostSevereError.recommendation, 'info', 'normal');
          }
        }
      }
      
      this.drawErrorOverlay(newErrors);
      
    } else {
      this.currentErrors = [];
      
      if (this.repetitionCount > previousCount) {
        const goodMessage = this.biomechanicsAnalyzer.generatePositiveMessage();
        this.audioService.speakSuccess(goodMessage);
        this.drawGoodFormOverlay();
      } else {
        this.clearErrorOverlay();
      }
    }
  }

  // 🚦 MANEJAR CAMBIOS DE ESTADO DE PREPARACIÓN
  private handleReadinessStateChange(prevState: ReadinessState, newState: ReadinessState): void {
    if (prevState !== newState) {
      console.log(`🚦 Cambio de estado: ${prevState} → ${newState}`);
      
      switch (newState) {
        case ReadinessState.NOT_READY:
          this.drawPreparationOverlay('Posiciónate para el ejercicio', this.errorColors.preparing);
          this.audioService.speakReadiness('Posiciónate para hacer el ejercicio');
          break;
          
        case ReadinessState.GETTING_READY:
          this.drawPreparationOverlay('Mantén la posición...', this.errorColors.warning);
          break;
          
        case ReadinessState.READY_TO_START:
          this.drawPreparationOverlay('¡LISTO PARA EMPEZAR!', this.errorColors.good);
          this.audioService.speakReadiness('¡Listo para empezar! Comienza el ejercicio');
          break;
          
        case ReadinessState.EXERCISING:
          this.clearPreparationOverlay();
          this.audioService.speakReadiness('¡Perfecto! Continúa con el ejercicio');
          break;
      }
    }
  }

  // 🚦 PROCESAR ERRORES DE PREPARACIÓN
  private processReadinessErrors(errors: PostureError[]): void {
    if (errors.length > 0) {
      this.currentErrors = errors;
      this.errorDetected.emit(errors);
      
      const positionError = errors[0];
      if (positionError) {
        this.audioService.speakReadiness(positionError.recommendation);
      }
    } else {
      this.currentErrors = [];
    }
  }

  // 🔍 FILTRAR ERRORES NUEVOS
  private filterNewErrors(errors: PostureError[]): PostureError[] {
    if (errors.length === 0) return [];
    
    const now = Date.now();
    const ERROR_DISPLAY_DURATION = 5000;
    
    this.currentErrors = this.currentErrors.filter(error => 
      (now - error.timestamp) < ERROR_DISPLAY_DURATION
    );
    
    if (this.currentErrors.length > 0) {
      console.log('⏸️ Ya hay error mostrándose, esperando...');
      return [];
    }
    
    const mostSevereError = this.getMostSevereError(errors);
    return mostSevereError ? [mostSevereError] : [];
  }

  // 🚨 OBTENER ERROR MÁS SEVERO
  private getMostSevereError(errors: PostureError[]): PostureError | null {
    if (errors.length === 0) return null;
    
    return errors.reduce((prev, current) => 
      (current.severity > prev.severity) ? current : prev
    );
  }

  // 🎨 DIBUJAR ESQUELETO SIN ESPEJO
  private drawSkeleton(pose: PoseKeypoints): void {
    if (!this.canvasCtx || !this.showSkeleton) return;

    const canvas = this.canvasElementRef.nativeElement;
    this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    this.canvasCtx.lineWidth = 3;
    this.canvasCtx.strokeStyle = '#00ff88';
    this.canvasCtx.fillStyle = '#00ff88';

    if (window.drawConnectors && window.POSE_CONNECTIONS) {
      const landmarks = this.convertPoseToLandmarks(pose);
      
      this.canvasCtx.save();
      window.drawConnectors(this.canvasCtx, landmarks, window.POSE_CONNECTIONS, {
        color: '#00ff88',
        lineWidth: 3
      });
      this.canvasCtx.restore();
    }

    this.drawKeyPoints(pose);
  }

  // 🔄 CONVERTIR POSE A LANDMARKS DE MEDIAPIPE
  private convertPoseToLandmarks(pose: PoseKeypoints): any[] {
    const landmarkOrder = [
      'nose',
      'left_eye_inner', 'left_eye', 'left_eye_outer',
      'right_eye_inner', 'right_eye', 'right_eye_outer',
      'left_ear', 'right_ear',
      'mouth_left', 'mouth_right',
      'left_shoulder', 'right_shoulder',
      'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist',
      'left_pinky', 'right_pinky',
      'left_index', 'right_index',
      'left_thumb', 'right_thumb',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle',
      'left_heel', 'right_heel',
      'left_foot_index', 'right_foot_index'
    ];

    return landmarkOrder.map(name => {
      const point = pose[name as keyof PoseKeypoints];
      return point || { x: 0, y: 0, z: 0, visibility: 0 };
    });
  }

  // 🎯 DIBUJAR PUNTOS CLAVE
  private drawKeyPoints(pose: PoseKeypoints): void {
    if (!this.canvasCtx) return;

    const canvas = this.canvasElementRef.nativeElement;
    const keyPoints = [
      'left_shoulder', 'right_shoulder',
      'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle'
    ];

    this.canvasCtx.fillStyle = '#ff6b6b';

    keyPoints.forEach(pointName => {
      const point = pose[pointName as keyof PoseKeypoints];
      if (point && point.visibility > 0.5) {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        
        this.canvasCtx!.beginPath();
        this.canvasCtx!.arc(x, y, 5, 0, 2 * Math.PI);
        this.canvasCtx!.fill();
      }
    });
  }

  // 🚦 DIBUJAR OVERLAY DE PREPARACIÓN
  private drawPreparationOverlay(message: string, color: string): void {
    if (!this.overlayCtx) return;

    const canvas = this.overlayElementRef.nativeElement;
    this.overlayCtx.clearRect(0, 0, canvas.width, canvas.height);

    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 6;
    this.overlayCtx.setLineDash([15, 10]);
    this.overlayCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    this.overlayCtx.fillStyle = color;
    this.overlayCtx.font = 'bold 24px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.fillText(message, canvas.width / 2, 40);

    console.log(`🚦 Overlay de preparación: ${message}`);
  }

  // 🧹 LIMPIAR OVERLAY DE PREPARACIÓN
  private clearPreparationOverlay(): void {
    if (!this.overlayCtx) return;
    const canvas = this.overlayElementRef.nativeElement;
    this.overlayCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // 🚨 DIBUJAR OVERLAY DE ERROR CON COLORES
  private drawErrorOverlay(errors: PostureError[]): void {
    if (!this.overlayCtx) return;

    const canvas = this.overlayElementRef.nativeElement;
    this.overlayCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (errors.length === 0) return;

    const mostSevereError = this.getMostSevereError(errors);
    if (!mostSevereError) return;

    let color = this.errorColors.good;
    let alertText = 'BUENA FORMA';
    
    if (mostSevereError.severity >= 7) {
      color = this.errorColors.critical;
      alertText = 'ERROR CRÍTICO';
    } else if (mostSevereError.severity >= 5) {
      color = this.errorColors.warning;
      alertText = 'CORREGIR POSTURA';
    }

    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 8;
    this.overlayCtx.setLineDash([10, 5]);
    this.overlayCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    this.overlayCtx.fillStyle = color;
    this.overlayCtx.font = 'bold 24px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.fillText(alertText, canvas.width / 2, 40);

    this.overlayCtx.font = '16px Arial';
    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.strokeStyle = '#000000';
    this.overlayCtx.lineWidth = 2;
    
    const lines = this.wrapText(mostSevereError.description, canvas.width - 40);
    lines.forEach((line, index) => {
      const y = 70 + (index * 25);
      this.overlayCtx!.strokeText(line, canvas.width / 2, y);
      this.overlayCtx!.fillText(line, canvas.width / 2, y);
    });

    console.log(`🚨 Overlay dibujado - ${alertText}: ${mostSevereError.description}`);
  }

  // ✅ DIBUJAR OVERLAY VERDE (BUENA FORMA)
  private drawGoodFormOverlay(): void {
    if (!this.overlayCtx) return;

    const canvas = this.overlayElementRef.nativeElement;
    this.overlayCtx.clearRect(0, 0, canvas.width, canvas.height);

    this.overlayCtx.strokeStyle = this.errorColors.good;
    this.overlayCtx.lineWidth = 4;
    this.overlayCtx.setLineDash([15, 10]);
    this.overlayCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    this.overlayCtx.fillStyle = this.errorColors.good;
    this.overlayCtx.font = 'bold 20px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.fillText('✓ EXCELENTE FORMA', canvas.width / 2, 35);

    if (this.currentQualityScore > 0) {
      this.overlayCtx.font = '14px Arial';
      this.overlayCtx.fillText(`Calidad: ${this.currentQualityScore}%`, canvas.width / 2, 60);
    }
  }

  // 🧹 LIMPIAR OVERLAY DE ERROR
  private clearErrorOverlay(): void {
    if (!this.overlayCtx) return;
    const canvas = this.overlayElementRef.nativeElement;
    this.overlayCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // 📝 ENVOLVER TEXTO
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length * 8 <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // ✅ INICIALIZAR SESIÓN DE CAPTURA
  private async initializeCaptureSession(): Promise<void> {
    try {
      if (!this.hasSessionStarted) {
        this.currentSessionId = await this.captureService.startTrainingSession(this.exerciseType);
        
        if (this.currentSessionId) {
          this.hasSessionStarted = true;
          console.log('📸 Sesión de captura iniciada:', this.currentSessionId);
        } else {
          console.warn('📸 No se pudo iniciar sesión de captura (usuario no autenticado)');
        }
      }
    } catch (error) {
      console.error('🛑 Error inicializando sesión de captura:', error);
    }
  }

  // ✅ MÉTODOS DE CÁMARA (MODIFICADOS PARA INCLUIR TODOS LOS SERVICIOS)
  async startCamera(): Promise<void> {
    this.initializationAttempts++;
    
    try {
      console.log(`🚀 Intento de inicialización ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
      
      this.isLoading = true;
      this.error = null;
      this.cdr.detectChanges();

      await this.poseEngine.initializeMediaPipe();
      
      const video = this.videoElementRef.nativeElement;
      const canvas = this.canvasElementRef.nativeElement;
      const overlay = this.overlayElementRef.nativeElement;
      
      await this.poseEngine.startCamera(video, canvas);
      
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      
      this.isInitialized = true;
      this.isLoading = false;

      // ✅ NUEVO: INICIAR SESIÓN DE CAPTURA CON TODOS LOS SERVICIOS
      await this.initializeCaptureSession();
      
      console.log('✅ Cámara iniciada exitosamente con integración completa de servicios');
      
    } catch (error) {
      console.error(`❌ Error iniciando cámara (intento ${this.initializationAttempts}):`, error);
      
      this.isLoading = false;
      this.error = `Error de inicialización: ${error}`;
      
      if (this.initializationAttempts < this.maxInitializationAttempts) {
        console.log(`🔄 Reintentando en 2 segundos...`);
        this.initializationTimer = setTimeout(() => {
          this.startCamera();
        }, 2000);
      } else {
        this.error = 'No se pudo inicializar la cámara después de varios intentos';
      }
    }
    
    this.cdr.detectChanges();
  }

  async stopCamera(): Promise<void> {
    try {
      await this.poseEngine.stopCamera();
      
      // ✅ NUEVO: FINALIZAR SESIÓN CON TODOS LOS SERVICIOS
      if (this.hasSessionStarted) {
        await this.captureService.endTrainingSession();
        
        // ✅ ENVIAR ESTADÍSTICAS FINALES VIA CLOUD FUNCTIONS
        if (this.currentSessionId) {
          try {
            await this.cloudFunctions.reportUsageMetrics({
              sessionId: this.currentSessionId,
              exerciseType: this.exerciseType,
              totalRepetitions: this.repetitionCount,
              avgQualityScore: this.currentQualityScore,
              errorsDetected: this.criticalErrorsSent.size,
              sessionDuration: Date.now() - (Date.now() - 300000) // Aproximado
            });
            console.log('☁️ Estadísticas de sesión enviadas');
          } catch (error) {
            console.error('🛑 Error enviando estadísticas:', error);
          }
        }
        
        this.hasSessionStarted = false;
        this.currentSessionId = null;
        this.criticalErrorsSent.clear();
        console.log('📸 Sesión de captura finalizada completamente');
      }
      
      this.isInitialized = false;
      console.log('⏹️ Cámara parada');
    } catch (error) {
      console.error('❌ Error parando cámara:', error);
    }
  }

  getStatusMessage(): string {
    if (this.initializationAttempts === 0) {
      return 'Preparando sistema...';
    } else if (this.initializationAttempts === 1) {
      return 'Cargando MediaPipe...';
    } else if (this.initializationAttempts <= 3) {
      return 'Inicializando cámara...';
    } else {
      return 'Reintentando conexión...';
    }
  }

  restartCamera(): void {
    this.initializationAttempts = 0;
    this.startCamera();
  }

  toggleSkeleton(): void {
    this.showSkeleton = !this.showSkeleton;
    if (!this.showSkeleton && this.canvasCtx) {
      const canvas = this.canvasElementRef.nativeElement;
      this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  toggleErrorDetection(): void {
    this.enableErrorDetection = !this.enableErrorDetection;
    if (!this.enableErrorDetection) {
      this.currentErrors = [];
      this.clearErrorOverlay();
    }
  }

  // ✅ TOGGLE AUDIO MEJORADO
  toggleAudio(): void {
    this.enableAudio = !this.enableAudio;
    this.audioService.setEnabled(this.enableAudio);
    
    if (this.enableAudio) {
      this.audioService.speak('Audio activado');
    }
  }

  // ✅ MÉTODOS PARA EL TEMPLATE
  getExerciseName(): string {
    switch (this.exerciseType) {
      case ExerciseType.SQUATS: return 'Sentadillas';
      case ExerciseType.PUSHUPS: return 'Flexiones';
      case ExerciseType.PLANK: return 'Plancha';
      case ExerciseType.LUNGES: return 'Estocadas';
      default: return 'Ejercicio';
    }
  }

  getPhaseText(): string {
    switch (this.currentPhase) {
      case RepetitionPhase.IDLE: return 'Reposo';
      case RepetitionPhase.TOP: return 'Arriba';
      case RepetitionPhase.BOTTOM: return 'Abajo';
      case RepetitionPhase.DESCENDING: return 'Bajando';
      case RepetitionPhase.ASCENDING: return 'Subiendo';
      case RepetitionPhase.HOLD: return 'Mantener';
      default: return 'Detectando...';
    }
  }

  getQualityClass(): string {
    if (this.currentQualityScore >= 90) return 'quality-excellent';
    if (this.currentQualityScore >= 75) return 'quality-good';
    if (this.currentQualityScore >= 60) return 'quality-fair';
    return 'quality-poor';
  }

  getSeverityClass(severity: number): string {
    if (severity >= 7) return 'critical';
    if (severity >= 5) return 'warning';
    return 'info';
  }

  getErrorIcon(severity: number): string {
    if (severity >= 7) return 'warning';
    if (severity >= 5) return 'alert-circle';
    return 'information-circle';
  }

  getErrorTypeText(errorType: string): string {
    switch (errorType) {
      case 'KNEE_VALGUS': return 'Rodillas hacia adentro';
      case 'ROUNDED_BACK': return 'Espalda curvada';
      case 'INSUFFICIENT_DEPTH': return 'Poca profundidad';
      case 'DROPPED_HIPS': return 'Caderas caídas';
      case 'HIGH_HIPS': return 'Caderas altas';
      case 'EXCESSIVE_ELBOW_FLARE': return 'Codos muy abiertos';
      case 'KNEE_FORWARD': return 'Rodilla adelantada';
      case 'POOR_ALIGNMENT': return 'Mala alineación';
      case 'EXCESSIVE_SPEED': return 'Velocidad excesiva';
      default: return 'Error postural';
    }
  }

  // ✅ OBTENER MENSAJE ACTUAL BASADO EN ESTADO
  getCurrentStateMessage(): string {
    return this.readinessMessage;
  }

  // ✅ OBTENER COLOR DEL ESTADO ACTUAL
  getCurrentStateColor(): string {
    switch (this.currentReadinessState) {
      case ReadinessState.NOT_READY: return this.errorColors.preparing;
      case ReadinessState.GETTING_READY: return this.errorColors.warning;
      case ReadinessState.READY_TO_START: return this.errorColors.good;
      case ReadinessState.EXERCISING: return this.errorColors.good;
      default: return this.errorColors.preparing;
    }
  }

  // ✅ VERIFICAR SI AUDIO ESTÁ HABILITADO (PARA TEMPLATE)
  get isAudioEnabled(): boolean {
    return this.audioService.isAudioEnabled();
  }

  // ✅ NUEVOS MÉTODOS PARA ESTADO DE SERVICIOS (PARA TEMPLATE)
  getCaptureSessionStats() {
    return this.captureService.getSessionStats();
  }

  get hasActiveCaptureSession(): boolean {
    return this.hasSessionStarted && !!this.currentSessionId;
  }

  get criticalErrorsCount(): number {
    return this.criticalErrorsSent.size;
  }

  // ✅ LIMPIEZA COMPLETA CON TODOS LOS SERVICIOS
  private cleanup(): void {
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }

    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    // ✅ LIMPIAR TODOS LOS SERVICIOS
    this.audioService.cleanup();

    // ✅ ASEGURAR FINALIZACIÓN DE SESIÓN
    if (this.hasSessionStarted) {
      this.captureService.endTrainingSession().catch(console.error);
    }

    this.poseEngine.cleanup();
    this.biomechanicsAnalyzer.cleanup();

    console.log('🧹 PoseCameraComponent limpiado completamente con todos los servicios');
  }
}