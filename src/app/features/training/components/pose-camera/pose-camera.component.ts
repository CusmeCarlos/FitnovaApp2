// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ COMPONENTE CORREGIDO SIN ESPEJO + ESTADOS DE PREPARACIÓN

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
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  ExerciseType,
  RepetitionPhase 
} from '../../../../shared/models/pose.models';

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

  // ✅ NUEVOS: Estados de preparación
  currentReadinessState: ReadinessState = ReadinessState.NOT_READY;
  readinessMessage = '';

  // ✅ CONTEXTOS DE CANVAS
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  // ✅ SUBSCRIPCIONES
  private subscriptions: Subscription[] = [];

  // ✅ CONTROL DE INICIALIZACIÓN
  private initializationTimer: any = null;
  initializationAttempts = 0;
  readonly maxInitializationAttempts = 10;

  // ✅ SISTEMA DE AUDIO MEJORADO CON ESTADOS
  private speechSynthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioQueue: string[] = [];
  isPlayingAudio = false;
  private lastAudioTime = 0;
  private readonly AUDIO_COOLDOWN = 5000; // 5 segundos entre audios
  private lastReadinessAudioTime = 0;
  private readonly READINESS_AUDIO_COOLDOWN = 8000; // 8 segundos para mensajes de preparación
  private lastGoodFormTime = 0;
  private readonly GOOD_FORM_INTERVAL = 15000; // 15 segundos para mensajes positivos

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
    private cdr: ChangeDetectorRef
  ) {
    console.log('🎬 PoseCameraComponent constructor');
    
    // ✅ INICIALIZAR SISTEMA DE AUDIO
    this.speechSynthesis = window.speechSynthesis;
    this.initializeAudioSystem();
  }

  ngOnInit() {
    console.log('🚀 PoseCameraComponent ngOnInit');
    this.setupSubscriptions();
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

  // ✅ INICIALIZAR SISTEMA DE AUDIO
  private initializeAudioSystem(): void {
    try {
      if (!this.speechSynthesis) {
        console.warn('⚠️ Text-to-Speech no disponible');
        this.enableAudio = false;
        return;
      }

      this.speechSynthesis.onvoiceschanged = () => {
        const voices = this.speechSynthesis.getVoices();
        const spanishVoice = voices.find(voice => 
          voice.lang.includes('es') || voice.name.includes('Spanish')
        );
        console.log('🎤 Voces disponibles:', voices.length, 'Español:', !!spanishVoice);
      };

      console.log('🎤 Sistema de audio inicializado');
    } catch (error) {
      console.error('❌ Error inicializando audio:', error);
      this.enableAudio = false;
    }
  }

  // 🔔 REPRODUCIR AUDIO CON COOLDOWN MEJORADO
  private async playAudio(message: string, isReadinessMessage = false): Promise<void> {
    if (!this.enableAudio || !this.speechSynthesis) return;

    const now = Date.now();
    
    // ✅ COOLDOWN DIFERENTE PARA MENSAJES DE PREPARACIÓN
    const relevantCooldown = isReadinessMessage ? this.READINESS_AUDIO_COOLDOWN : this.AUDIO_COOLDOWN;
    const relevantLastTime = isReadinessMessage ? this.lastReadinessAudioTime : this.lastAudioTime;
    
    if (now - relevantLastTime < relevantCooldown) {
      console.log('⏸️ Audio en cooldown, saltando mensaje:', message);
      return;
    }

    try {
      // Cancelar audio anterior si existe
      if (this.currentUtterance) {
        this.speechSynthesis.cancel();
      }

      this.currentUtterance = new SpeechSynthesisUtterance(message);
      
      // Configurar voz
      const voices = this.speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => 
        voice.lang.includes('es') || voice.name.includes('Spanish')
      );
      
      if (spanishVoice) {
        this.currentUtterance.voice = spanishVoice;
      }

      this.currentUtterance.rate = 0.9;
      this.currentUtterance.pitch = 1.0;
      this.currentUtterance.volume = 0.8;

      this.currentUtterance.onstart = () => {
        this.isPlayingAudio = true;
        console.log('🔊 Audio iniciado:', message);
      };

      this.currentUtterance.onend = () => {
        this.isPlayingAudio = false;
        console.log('✅ Audio completado');
      };

      this.speechSynthesis.speak(this.currentUtterance);
      
      // ✅ ACTUALIZAR TIEMPO CORRECTO
      if (isReadinessMessage) {
        this.lastReadinessAudioTime = now;
      } else {
        this.lastAudioTime = now;
      }

    } catch (error) {
      console.error('❌ Error reproduciendo audio:', error);
      this.isPlayingAudio = false;
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

  // ✅ BUSCAR ESTE MÉTODO EN pose-camera.component.ts Y REEMPLAZARLO COMPLETO:

// 🧠 ANÁLIZAR MOVIMIENTO CON ESTADOS DE PREPARACIÓN (CORREGIDO)
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
      
      // Audio de repetición cada 5
      if (this.repetitionCount % 5 === 0) {
        this.playAudio(`¡Excelente! ${this.repetitionCount} repeticiones completadas`);
      }
    }

    // ✅ PROCESAR SEGÚN ESTADO
    if (this.currentReadinessState === ReadinessState.EXERCISING) {
      this.processExerciseErrors(analysis.errors, previousCount);
    } else {
      this.processReadinessErrors(analysis.errors);
      // ✅ LIMPIAR OVERLAYS DE EJERCICIO CUANDO NO ESTÁ EJERCITÁNDOSE
      this.clearErrorOverlay();
    }

  } catch (error) {
    console.error('❌ Error en análisis biomecánico:', error);
  }
}

// ✅ TAMBIÉN AGREGAR ESTE MÉTODO NUEVO:

// 🏃 PROCESAR ERRORES DURANTE EJERCICIO (MEJORADO)
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
        this.playAudio(mostSevereError.recommendation);
      }
    }
    
    // ✅ DIBUJAR OVERLAY DE ERROR
    this.drawErrorOverlay(newErrors);
    
  } else {
    // ✅ BUENA FORMA DURANTE EJERCICIO
    this.currentErrors = [];
    
    const now = Date.now();
    if (now - this.lastGoodFormTime > this.GOOD_FORM_INTERVAL) {
      const goodMessage = this.biomechanicsAnalyzer.generatePositiveMessage();
      this.playAudio(goodMessage);
      this.lastGoodFormTime = now;
      
      // ✅ MOSTRAR OVERLAY VERDE
      this.drawGoodFormOverlay();
    } else {
      // ✅ LIMPIAR OVERLAY SIN MOSTRAR MENSAJE
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
          this.playAudio('Posiciónate para hacer el ejercicio', true);
          break;
          
        case ReadinessState.GETTING_READY:
          this.drawPreparationOverlay('Mantén la posición...', this.errorColors.warning);
          break;
          
        case ReadinessState.READY_TO_START:
          this.drawPreparationOverlay('¡LISTO PARA EMPEZAR!', this.errorColors.good);
          this.playAudio('¡Listo para empezar! Comienza el ejercicio', true);
          break;
          
        case ReadinessState.EXERCISING:
          this.clearPreparationOverlay();
          this.playAudio('¡Perfecto! Continúa con el ejercicio', true);
          break;
      }
    }
  }


  // 🚦 PROCESAR ERRORES DE PREPARACIÓN
  private processReadinessErrors(errors: PostureError[]): void {
    if (errors.length > 0) {
      this.currentErrors = errors;
      this.errorDetected.emit(errors);
      
      // Solo audio si hay errores de posición
      const positionError = errors[0];
      if (positionError) {
        this.playAudio(positionError.recommendation, true);
      }
    } else {
      this.currentErrors = [];
    }
  }

  // 🔍 FILTRAR ERRORES NUEVOS (SOLO UNO A LA VEZ)
  private filterNewErrors(errors: PostureError[]): PostureError[] {
    if (errors.length === 0) return [];
    
    const now = Date.now();
    const ERROR_DISPLAY_DURATION = 5000;
    
    // Limpiar errores antiguos
    this.currentErrors = this.currentErrors.filter(error => 
      (now - error.timestamp) < ERROR_DISPLAY_DURATION
    );
    
    // Si ya hay un error mostrándose, no mostrar más
    if (this.currentErrors.length > 0) {
      console.log('⏸️ Ya hay error mostrándose, esperando...');
      return [];
    }
    
    // Solo el error más severo
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

    // ✅ CONFIGURAR ESTILO
    this.canvasCtx.lineWidth = 3;
    this.canvasCtx.strokeStyle = '#00ff88';
    this.canvasCtx.fillStyle = '#00ff88';

    // ✅ DIBUJAR CONEXIONES USANDO MEDIAPIPE (SIN ESPEJO)
    if (window.drawConnectors && window.POSE_CONNECTIONS) {
      // Convertir pose a formato MediaPipe
      const landmarks = this.convertPoseToLandmarks(pose);
      
      this.canvasCtx.save();
      // ✅ NO APLICAR TRANSFORM PARA ELIMINAR ESPEJO
      window.drawConnectors(this.canvasCtx, landmarks, window.POSE_CONNECTIONS, {
        color: '#00ff88',
        lineWidth: 3
      });
      this.canvasCtx.restore();
    }

    // ✅ DIBUJAR PUNTOS IMPORTANTES
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

    // ✅ BORDE DE PREPARACIÓN
    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 6;
    this.overlayCtx.setLineDash([15, 10]);
    this.overlayCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // ✅ TEXTO DE PREPARACIÓN
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

  // [MANTENER TODOS LOS OTROS MÉTODOS EXISTENTES]
  // drawErrorOverlay, drawGoodFormOverlay, clearErrorOverlay, etc.

  // 🚨 DIBUJAR OVERLAY DE ERROR CON COLORES
  private drawErrorOverlay(errors: PostureError[]): void {
    if (!this.overlayCtx) return;

    const canvas = this.overlayElementRef.nativeElement;
    this.overlayCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (errors.length === 0) return;

    const mostSevereError = this.getMostSevereError(errors);
    if (!mostSevereError) return;

    // ✅ DETERMINAR COLOR SEGÚN SEVERIDAD
    let color = this.errorColors.good;
    let alertText = 'BUENA FORMA';
    
    if (mostSevereError.severity >= 7) {
      color = this.errorColors.critical; // ROJO - CRÍTICO
      alertText = 'ERROR CRÍTICO';
    } else if (mostSevereError.severity >= 5) {
      color = this.errorColors.warning;  // NARANJA - MODERADO
      alertText = 'CORREGIR POSTURA';
    }

    // ✅ DIBUJAR BORDE DE ALERTA
    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 8;
    this.overlayCtx.setLineDash([10, 5]);
    this.overlayCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // ✅ DIBUJAR TEXTO DE ALERTA
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.font = 'bold 24px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.fillText(alertText, canvas.width / 2, 40);

    // ✅ DIBUJAR DESCRIPCIÓN DEL ERROR
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

    // ✅ BORDE VERDE SUTIL
    this.overlayCtx.strokeStyle = this.errorColors.good;
    this.overlayCtx.lineWidth = 4;
    this.overlayCtx.setLineDash([15, 10]);
    this.overlayCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // ✅ INDICADOR DE BUENA FORMA
    this.overlayCtx.fillStyle = this.errorColors.good;
    this.overlayCtx.font = 'bold 20px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.fillText('✓ EXCELENTE FORMA', canvas.width / 2, 35);

    // ✅ MOSTRAR PUNTUACIÓN
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
      if (testLine.length * 8 <= maxWidth) { // Aproximación de ancho
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // [MANTENER TODOS LOS MÉTODOS RESTANTES COMO startCamera, stopCamera, etc.]
  
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
      console.log('✅ Cámara iniciada exitosamente');
      
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

  toggleAudio(): void {
    this.enableAudio = !this.enableAudio;
    if (!this.enableAudio && this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.isPlayingAudio = false;
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

  private cleanup(): void {
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }

    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }

    this.poseEngine.cleanup();
    this.biomechanicsAnalyzer.cleanup();

    console.log('🧹 PoseCameraComponent limpiado');
  }
}