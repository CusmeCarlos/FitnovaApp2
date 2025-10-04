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
interface UnifiedAlert {
  type: 'readiness' | 'error' | 'success';
  message: string;
  severity: number; // 0-10
  color: string;
  duration: number; // milisegundos
  timestamp: number;
  icon?: string;
}
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
  @ViewChild('readinessCanvas', { static: true }) readinessCanvasRef!: ElementRef<HTMLCanvasElement>; // ✅ NUEVO


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

  private audioInitialized = false;
  // ✅ NUEVAS PROPIEDADES PARA SERVICIOS INTEGRADOS
  private currentSessionId: string | null = null;
  private hasSessionStarted = false;
  private criticalErrorsSent = new Set<string>(); // Para evitar spam de notificaciones

  private currentAlert: UnifiedAlert | null = null;
  private alertQueue: UnifiedAlert[] = [];
  private alertTimeoutId: any = null;
  private readonly MAX_QUEUE_SIZE = 2; // Máximo 3 alertas en cola

  // ✅ ESTADO DE AUDIO (PARA TEMPLATE)
  get isPlayingAudio(): boolean {
    return this.audioService.isCurrentlyPlaying();
  }

  // ✅ CONTEXTOS DE CANVAS
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private readinessCtx: CanvasRenderingContext2D | null = null; // ✅ NUEVO

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
    this.readinessCtx = this.readinessCanvasRef.nativeElement.getContext('2d'); // ✅ NUEVO
    
    // Iniciar cámara automáticamente
    this.startCamera();
    this.initializeAudioOnFirstInteraction();

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

  private initializeAudioOnFirstInteraction(): void {
    const videoElement = this.videoElementRef.nativeElement;
    
    const initAudio = async () => {
      if (!this.audioInitialized) {
        try {
          // Crear un utterance silencioso para "despertar" el API
          const utterance = new SpeechSynthesisUtterance('');
          utterance.volume = 0;
          window.speechSynthesis.speak(utterance);
          
          this.audioInitialized = true;
          console.log('✅ Audio inicializado después de interacción');
          
          // Probar audio
          this.audioService.speak('Sistema de audio activado', 'info', 'normal');
        } catch (error) {
          console.error('❌ Error inicializando audio:', error);
        }
      }
      
      // Remover listeners después de inicializar
      videoElement.removeEventListener('touchstart', initAudio);
      videoElement.removeEventListener('click', initAudio);
    };
    
    // Escuchar primer toque o clic
    videoElement.addEventListener('touchstart', initAudio, { once: true });
    videoElement.addEventListener('click', initAudio, { once: true });
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
        repetitions: analysis.repetitionCount
      });
  
      // ✅ MANEJAR CAMBIOS DE ESTADO DE PREPARACIÓN
      this.handleReadinessStateChange(prevReadinessState, this.currentReadinessState);
  
      // ✅ ACTUALIZAR DATOS GENERALES
      const previousCount = this.repetitionCount;
      this.repetitionCount = analysis.repetitionCount;
      this.currentPhase = analysis.phase;
      this.currentQualityScore = analysis.qualityScore;
      
      // ✅ DETECTAR NUEVA REPETICIÓN (SOLO SI ESTÁ EXERCISING)
      if (this.repetitionCount > previousCount && 
          this.currentReadinessState === ReadinessState.EXERCISING) {
        console.log(`🎉 ¡NUEVA REPETICIÓN! Total: ${this.repetitionCount}`);
        this.repetitionCounted.emit(this.repetitionCount);
        
        // ✅ AUDIO DE REPETICIÓN cada 5
        if (this.repetitionCount % 5 === 0) {
          const alert: UnifiedAlert = {
            type: 'success',
            message: `¡Excelente! ${this.repetitionCount} repeticiones`,
            severity: 1,
            color: this.errorColors.good,
            duration: 2500,
            timestamp: Date.now(),
            icon: '🎉'
          };
          this.showUnifiedAlert(alert);
          this.audioService.speakSuccess(`¡Excelente! ${this.repetitionCount} repeticiones completadas`);
        }
      }
  
      // ✅ INTEGRACIÓN COMPLETA: CAPTURA + NOTIFICACIONES
      this.handleCriticalErrorsIntegration(analysis.errors);
  
      // ✅ PROCESAR ERRORES SOLO SI ESTÁ EXERCISING
      if (this.currentReadinessState === ReadinessState.EXERCISING) {
        this.processExerciseErrors(analysis.errors, previousCount);
      } else {
        // En preparación: solo mostrar estado, NO errores
        this.currentErrors = [];
      }
  
    } catch (error) {
      console.error('❌ Error en análisis biomecánico:', error);
    }
  }

  private async handleCriticalErrorsIntegration(errors: PostureError[]): Promise<void> {
    // ✅ 1. VALIDAR SESIÓN ACTIVA
    if (!this.currentSessionId || !this.hasSessionStarted) {
      console.log('⚠️ No hay sesión activa, no se captura');
      return;
    }
    
    // ✅ 2. FILTRAR ERRORES CRÍTICOS (severity >= 7)
    const criticalErrors = errors.filter(error => error.severity >= 7);
    
    if (criticalErrors.length === 0) {
      return;
    }
  
    // ✅ 3. OBTENER EL MÁS CRÍTICO
    const mostCritical = criticalErrors.reduce((prev, current) => 
      current.severity > prev.severity ? current : prev
    );
  
    // ✅ 4. EVITAR DUPLICADOS EN MISMA SESIÓN
    const errorKey = `${mostCritical.type}_${this.currentSessionId}`;
    if (this.criticalErrorsSent.has(errorKey)) {
      console.log('⏭️ Error ya enviado en esta sesión:', mostCritical.type);
      return;
    }
  
    console.log('🚨 ERROR CRÍTICO DETECTADO:', mostCritical.type, 'Severity:', mostCritical.severity);
  
    try {
      // ============================================================================
      // PASO 1: CAPTURA AUTOMÁTICA DE LA IMAGEN
      // ============================================================================
      
      console.log('📸 Iniciando captura automática...');
      
      // ✅ CORRECCIÓN CRÍTICA: Mapear severity NUMBER a STRING
      let severityString: 'critical' | 'high' | 'medium' | 'low';
      
      if (mostCritical.severity >= 9) {
        severityString = 'critical';
      } else if (mostCritical.severity >= 7) {
        severityString = 'high';
      } else if (mostCritical.severity >= 5) {
        severityString = 'medium';
      } else {
        severityString = 'low';
      }
      
      const captureSuccess = await this.captureService.captureErrorIfNeeded(
        this.canvasElementRef.nativeElement, // Canvas, NO video
        mostCritical.type,
        severityString, // ✅ AHORA ES STRING
        {
          affectedJoints: mostCritical.affectedJoints,
          confidence: mostCritical.confidence,
          recommendation: mostCritical.recommendation,
          timestamp: mostCritical.timestamp,
          exerciseType: this.exerciseType,
          currentPhase: this.currentPhase,
          angles: this.currentAngles
        }
      );
  
      if (!captureSuccess) {
        console.warn('⚠️ No se pudo realizar captura (límite alcanzado o cooldown activo)');
        return;
      }
  
      console.log('✅ Captura realizada exitosamente');
  
      // ============================================================================
      // PASO 2: ENVIAR NOTIFICACIÓN AL ENTRENADOR
      // ============================================================================
  
      console.log('🔔 Enviando notificación al entrenador...');
  
      const notificationSuccess = await this.notificationService.sendCriticalAlert(
        mostCritical.type,
        this.exerciseType,
        severityString, // ✅ Usar misma variable string
        this.currentSessionId,
        undefined, // captureURL ya está en Firebase
        {
          description: mostCritical.description,
          severity: mostCritical.severity,
          biomechanicsData: {
            affectedJoints: mostCritical.affectedJoints,
            confidence: mostCritical.confidence,
            angles: this.currentAngles
          },
          deviceInfo: {
            timestamp: mostCritical.timestamp,
            exerciseType: this.exerciseType,
            currentPhase: this.currentPhase,
            repetitionCount: this.repetitionCount,
            userAgent: navigator.userAgent
          }
        }
      );
  
      if (notificationSuccess) {
        console.log('✅ Notificación enviada al entrenador');
        
        // ✅ MARCAR COMO ENVIADO
        this.criticalErrorsSent.add(errorKey);
  
        // ============================================================================
        // PASO 3: NOTIFICACIÓN LOCAL AL USUARIO
        // ============================================================================
  
        this.fcmService.showLocalNotification(
          'Error Crítico Detectado',
          `${mostCritical.description} - Tu entrenador ha sido notificado`
        );
  
        // ============================================================================
        // PASO 4: PROCESAMIENTO CON CLOUD FUNCTIONS (OPCIONAL)
        // ============================================================================
  
        if (this.cloudFunctions) {
          try {
            const processResult = await this.cloudFunctions.processBiomechanicsAnalysis({
              errorType: mostCritical.type,
              severity: mostCritical.severity,
              sessionId: this.currentSessionId,
              exerciseType: this.exerciseType,
              biomechanicsData: {
                affectedJoints: mostCritical.affectedJoints,
                confidence: mostCritical.confidence,
                timestamp: mostCritical.timestamp,
                angles: this.currentAngles
              }
            });
  
            if (processResult.success && processResult.data?.personalizedRecommendation) {
              this.audioService.speak(
                processResult.data.personalizedRecommendation, 
                'info', 
                'normal'
              );
            }
          } catch (cfError) {
            console.warn('⚠️ Error en Cloud Functions (no crítico):', cfError);
          }
        }
  
        // ============================================================================
        // PASO 5: NOTIFICACIÓN VISUAL EN PANTALLA
        // ============================================================================
  
        this.showCaptureNotification();
  
      } else {
        console.error('❌ No se pudo enviar notificación al entrenador');
      }
  
    } catch (error) {
      console.error('🛑 Error en integración de errores críticos:', error);
      
      this.fcmService.showLocalNotification(
        'Error de Sistema',
        'No se pudo procesar el error crítico. Continúa con precaución.'
      );
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

  private showCaptureNotification(): void {
    const canvas = this.overlayElementRef.nativeElement;
    const ctx = this.overlayCtx;
    
    if (!ctx) return;
  
    // Guardar estado actual
    ctx.save();
  
    // Dibujar notificación de captura en la esquina superior derecha
    const x = canvas.width - 70;
    const y = 15;
    const width = 60;
    const height = 30;
  
    // Fondo blanco semi-transparente
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x, y, width, height);
  
    // Borde
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  
    // Icono de cámara
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📸', x + width / 2, y + height / 2);
  
    // Restaurar estado
    ctx.restore();
  
    // Auto-limpiar después de 1.5 segundos
    setTimeout(() => {
      if (ctx) {
        ctx.clearRect(x - 2, y - 2, width + 4, height + 4);
      }
    }, 1500);
  
    console.log('✅ Notificación de captura mostrada');
  }
  
  getCaptureStats(): { captured: number; sessionId: string | null } {
    return {
      captured: this.criticalErrorsSent.size,
      sessionId: this.currentSessionId
    };
  }
  // Forzar captura manual (para testing)
async forceCapture(): Promise<void> {
  if (!this.currentSessionId || !this.hasSessionStarted) {
    console.warn('⚠️ No hay sesión activa');
    return;
  }

  try {
    const captureURL = await this.captureService.captureErrorIfNeeded(
      this.canvasElementRef.nativeElement,
      PostureErrorType.POOR_ALIGNMENT,
      'critical',
      this.currentSessionId
    );

    console.log('✅ Captura manual exitosa:', captureURL);
    this.showCaptureNotification();
  } catch (error) {
    console.error('❌ Error en captura manual:', error);
  }
}

private showUnifiedAlert(alert: UnifiedAlert): void {
  // ✅ PRIORIDAD 1: Estados de preparación BLOQUEAN TODO (duración infinita)
  if (this.currentReadinessState !== ReadinessState.EXERCISING && 
      alert.type === 'readiness') {
    this.clearCurrentAlert(); // Limpiar alerta anterior
    this.currentAlert = alert;
    this.drawUnifiedAlertOnCanvas(alert);
    // ✅ NO programar auto-limpieza (se limpia solo al cambiar de estado)
    return;
  }

  // ✅ PRIORIDAD 2: Errores críticos interrumpen (pero solo si está ejercitando)
  if (alert.type === 'error' && alert.severity >= 7 && 
      this.currentReadinessState === ReadinessState.EXERCISING) {
    this.clearCurrentAlert();
    this.currentAlert = alert;
    this.drawUnifiedAlertOnCanvas(alert);
    this.setAlertAutoClear(alert.duration);
    return;
  }

  // ✅ PRIORIDAD 3: Otras alertas (solo si está ejercitando)
  if (this.currentReadinessState === ReadinessState.EXERCISING) {
    if (this.currentAlert) {
      if (this.alertQueue.length < this.MAX_QUEUE_SIZE) {
        this.alertQueue.push(alert);
      }
      return;
    }

    this.currentAlert = alert;
    this.drawUnifiedAlertOnCanvas(alert);
    this.setAlertAutoClear(alert.duration);
  }
}

  private drawUnifiedAlertOnCanvas(alert: UnifiedAlert): void {
    const canvas = this.overlayElementRef.nativeElement;
    const ctx = this.overlayCtx;
    
    if (!ctx) return;
  
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // ✅ DIBUJAR BORDE DE ALERTA
    ctx.strokeStyle = alert.color;
    ctx.lineWidth = alert.severity >= 7 ? 12 : 8; // Más grueso
    ctx.setLineDash(alert.severity >= 7 ? [20, 10] : [15, 8]);
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  
    // ✅ FONDO SEMI-TRANSPARENTE PARA EL TEXTO
    const textHeight = 100;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; // Fondo oscuro para contraste
    ctx.fillRect(20, 20, canvas.width - 40, textHeight);
  
    // ✅ DIBUJAR ICONO (si existe)
    if (alert.icon) {
      ctx.font = '48px Arial'; // Más grande
      ctx.textAlign = 'left';
      ctx.fillText(alert.icon, 40, 75);
    }
  
    // ✅ DIBUJAR TEXTO PRINCIPAL CON ALTO CONTRASTE
    ctx.fillStyle = alert.color;
    ctx.font = alert.severity >= 7 ? 'bold 32px Arial' : 'bold 28px Arial'; // Más grande
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Texto centrado
    ctx.fillText(alert.message, canvas.width / 2, 70);
  
    // Resetear sombra
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  
    console.log(`🎨 Alerta dibujada: "${alert.message}" (severity: ${alert.severity})`);
  }
  
  private drawReadinessNotification(): void {
    const canvas = this.readinessCanvasRef?.nativeElement;
    if (!canvas) return;
  
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    const width = 220;
    const height = 80;
    const padding = 15;
    
    const x = canvas.width - width - padding;
    const y = padding;
  
    ctx.save();
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.roundRect(ctx, x, y, width, height, 12);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    
    ctx.strokeStyle = this.getCurrentStateColor();
    ctx.lineWidth = 3;
    this.roundRect(ctx, x, y, width, height, 12);
    ctx.stroke();
  
    const iconSize = 28;
    const iconX = x + 15;
    const iconY = y + height / 2;
  
    ctx.fillStyle = this.getCurrentStateColor();
    ctx.font = `${iconSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.getReadinessIcon(), iconX, iconY);
  
    const textX = iconX + iconSize + 12;
    const textY = iconY;
  
    ctx.fillStyle = '#333';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const maxTextWidth = width - iconSize - 40;
    const message = this.readinessMessage || ''; // ✅ Usa this.readinessMessage
    
    const words = message.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];
  
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxTextWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  
    const lineHeight = 18;
    const totalTextHeight = lines.length * lineHeight;
    let currentY = textY - (totalTextHeight / 2) + (lineHeight / 2);
  
    lines.forEach(line => {
      ctx.fillText(line, textX, currentY);
      currentY += lineHeight;
    });
  
    ctx.restore();
  }
  
  
private roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ✅ Iconos según estado
private getReadinessIcon(): string {
  switch (this.currentReadinessState) {
    case ReadinessState.NOT_READY: return '⏸️';
    case ReadinessState.GETTING_READY: return '⏳';
    case ReadinessState.READY_TO_START: return '✅';
    case ReadinessState.EXERCISING: return '💪';
    default: return 'ℹ️';
  }
}
  
private clearReadinessNotification(): void {
  const canvas = this.readinessCanvasRef?.nativeElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

  // ✅ AUTO-LIMPIAR ALERTA
  private setAlertAutoClear(duration: number): void {
    // Limpiar timeout anterior
    if (this.alertTimeoutId) {
      clearTimeout(this.alertTimeoutId);
    }

    // Programar limpieza
    this.alertTimeoutId = setTimeout(() => {
      this.clearCurrentAlert();
      this.processAlertQueue();
    }, duration);
  }

  // ✅ LIMPIAR ALERTA ACTUAL
  private clearCurrentAlert(): void {
    if (this.alertTimeoutId) {
      clearTimeout(this.alertTimeoutId);
      this.alertTimeoutId = null;
    }

    this.currentAlert = null;

    // Limpiar canvas
    const canvas = this.overlayElementRef.nativeElement;
    const ctx = this.overlayCtx;
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
 // ✅ PROCESAR COLA DE ALERTAS
 private processAlertQueue(): void {
  if (this.alertQueue.length > 0 && !this.currentAlert) {
    const nextAlert = this.alertQueue.shift();
    if (nextAlert) {
      this.showUnifiedAlert(nextAlert);
    }
  }
}
 // Reemplazar processExerciseErrors
 private processExerciseErrors(errors: PostureError[], previousCount: number): void {
  const newErrors = this.filterNewErrors(errors);

  if (newErrors.length > 0) {
    console.log('🚨 Errores detectados:', newErrors.map(e => e.description));

    const mostSevere = this.getMostSevereError(newErrors);
    if (mostSevere) {
      // Crear alerta unificada
      const alert: UnifiedAlert = {
        type: 'error',
        message: mostSevere.description,
        severity: mostSevere.severity,
        color: this.getErrorColor(mostSevere.severity),
        duration: mostSevere.severity >= 7 ? 2000 : 2500,
        timestamp: mostSevere.timestamp,
        icon: this.getErrorIconEmoji(mostSevere.severity)
      };

      this.showUnifiedAlert(alert);

      // Audio solo si no hay repetición nueva
      if (this.repetitionCount === previousCount) {
        if (mostSevere.severity >= 7) {
          this.audioService.speakCritical(mostSevere.recommendation);
        } else if (mostSevere.severity >= 5) {
          this.audioService.speakError(mostSevere.recommendation);
        } else {
          this.audioService.speak(mostSevere.recommendation, 'info', 'normal');
        }
      }
    }
  } else {
    // Sin errores
    if (this.repetitionCount > previousCount) {
      const goodMessage = this.biomechanicsAnalyzer.generatePositiveMessage();
      
      const alert: UnifiedAlert = {
        type: 'success',
        message: '¡EXCELENTE REPETICIÓN!',
        severity: 1,
        color: this.errorColors.good,
        duration: 2000,
        timestamp: Date.now(),
        icon: '🎉'
      };

      this.showUnifiedAlert(alert);
      this.audioService.speakSuccess(goodMessage);
    }
  }
}

 // ✅ MÉTODOS AUXILIARES
 private getErrorColor(severity: number): string {
  if (severity >= 7) return this.errorColors.critical;
  if (severity >= 5) return this.errorColors.warning;
  return this.errorColors.preparing;
}

private getErrorIconEmoji(severity: number): string {
  if (severity >= 7) return '🔴';
  if (severity >= 5) return '🟠';
  return '🔵';
}
private handleReadinessStateChange(prevState: ReadinessState, newState: ReadinessState): void {
  if (prevState !== newState) {
    console.log(`🚦 Cambio de estado: ${prevState} → ${newState}`);
    
    switch (newState) {
      case ReadinessState.NOT_READY:
        // ✅ readinessMessage ya está actualizado en analyzeMovementWithStates
        this.drawReadinessNotification(); // ✅ Sin parámetros
        this.audioService.speakReadiness('Posiciónate para hacer el ejercicio');
        break;
        
      case ReadinessState.GETTING_READY:
        this.drawReadinessNotification(); // ✅ Sin parámetros
        // No audio aquí para evitar spam
        break;
        
      case ReadinessState.READY_TO_START:
        this.drawReadinessNotification(); // ✅ Sin parámetros
        this.audioService.speakReadiness('¡Listo para empezar! Comienza el ejercicio');
        break;
        
      case ReadinessState.EXERCISING:
        this.clearReadinessNotification();
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
    
    // ✅ DURACIÓN BASADA EN AUDIO + DISPLAY + MARGEN
    // Audio crítico: ~3-4 segundos
    // Audio moderado: ~2-3 segundos
    // Display visual: 3 segundos
    // Margen de seguridad: 1 segundo
    const ERROR_TOTAL_DURATION = 7000; // ✅ 7 segundos totales
    
    // Limpiar errores antiguos
    this.currentErrors = this.currentErrors.filter(error => 
      (now - error.timestamp) < ERROR_TOTAL_DURATION
    );
    
    // ✅ BLOQUEAR NUEVAS ALERTAS SI:
    // 1. Hay errores mostrándose
    // 2. El audio está reproduciéndose
    if (this.currentErrors.length > 0) {
      console.log('⏸️ Ya hay alerta activa, bloqueando nuevas alertas...');
      return [];
    }
    
    if (this.audioService.isCurrentlyPlaying()) {
      console.log('🔊 Audio reproduciéndose, bloqueando nuevas alertas...');
      return [];
    }
    
    // ✅ Si no hay alertas activas ni audio, permitir nueva alerta
    const mostSevereError = this.getMostSevereError(errors);
    
    if (mostSevereError) {
      console.log(`✅ Nueva alerta permitida: ${mostSevereError.type} (severity ${mostSevereError.severity})`);
    }
    
    return mostSevereError ? [mostSevereError] : [];
  }

  // 🚨 OBTENER ERROR MÁS SEVERO
  private getMostSevereError(errors: PostureError[]): PostureError | null {
    if (errors.length === 0) return null;
    
    return errors.reduce((prev, current) => 
      (current.severity > prev.severity) ? current : prev
    );
  }

  // REEMPLAZAR el método drawSkeleton en pose-camera.component.ts

private drawSkeleton(pose: PoseKeypoints): void {
  if (!this.canvasCtx || !this.showSkeleton) return;

  const canvas = this.canvasElementRef.nativeElement;
  const ctx = this.canvasCtx;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ✅ DIBUJAR CONEXIONES usando MediaPipe
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#00ff88';
  
  if (window.drawConnectors && window.POSE_CONNECTIONS) {
    const landmarks = this.convertPoseToLandmarks(pose);
    
    window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, {
      color: '#00ff88',
      lineWidth: 3
    });
  }

  // ✅ DIBUJAR PUNTOS CLAVE
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
      this.clearCurrentAlert();
      this.alertQueue = [];
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