// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ COMPONENTE CORREGIDO CON SISTEMA DE AUDIO PARA EXAMEN

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
import { Subscription } from 'rxjs';

import { PoseDetectionEngine } from '../../../../core/pose-engine/pose-detection.engine';
import { BiomechanicsAnalyzer } from '../../../../core/pose-engine/biomechanics.analyzer';
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
  @Input() enableAudio = true; // ✅ NUEVO: Controlar audio
  
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

  // ✅ CONTEXTOS DE CANVAS
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  // ✅ SUBSCRIPCIONES
  private subscriptions: Subscription[] = [];

  // ✅ CONTROL DE INICIALIZACIÓN
  private initializationTimer: any = null;
  initializationAttempts = 0;
  readonly maxInitializationAttempts = 10;

  // ✅ SISTEMA DE AUDIO TTS (Text-to-Speech)
  private speechSynthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioQueue: string[] = [];
  isPlayingAudio = false;
  private lastAudioTime = 0;
  private readonly AUDIO_COOLDOWN = 4000; // 4 segundos entre audios

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

  // ✅ INICIALIZAR SISTEMA DE AUDIO (MEJORADO)
private initializeAudioSystem(): void {
  try {
    // Verificar disponibilidad de TTS
    if (!this.speechSynthesis) {
      console.warn('⚠️ Text-to-Speech no disponible en este navegador');
      this.enableAudio = false;
      return;
    }

    // ✅ FORZAR CARGA DE VOCES
    const loadVoices = () => {
      const voices = this.speechSynthesis.getVoices();
      console.log(`🎤 Voces disponibles: ${voices.length}`);
      
      if (voices.length > 0) {
        voices.forEach((voice, index) => {
          console.log(`Voz ${index}: ${voice.name} (${voice.lang})`);
        });
        
        // Buscar voz en español
        const spanishVoice = voices.find(voice => 
          voice.lang.includes('es') || 
          voice.name.toLowerCase().includes('spanish') ||
          voice.name.toLowerCase().includes('español')
        );
        
        if (spanishVoice) {
          console.log(`✅ Voz en español encontrada: ${spanishVoice.name}`);
        } else {
          console.log('⚠️ No se encontró voz en español, usando voz por defecto');
        }
      }
    };

    // ✅ CARGAR VOCES INMEDIATAMENTE Y CON EVENTO
    loadVoices();
    this.speechSynthesis.onvoiceschanged = loadVoices;
    
    // ✅ FORZAR CARGA EN ALGUNOS NAVEGADORES
    if (this.speechSynthesis.getVoices().length === 0) {
      console.log('🔄 Forzando carga de voces...');
      const utterance = new SpeechSynthesisUtterance('');
      this.speechSynthesis.speak(utterance);
      this.speechSynthesis.cancel();
    }

    console.log('✅ Sistema de audio inicializado');
    
  } catch (error) {
    console.error('❌ Error inicializando sistema de audio:', error);
    this.enableAudio = false;
  }
}

// 🔊 REPRODUCIR AUDIO (CORREGIDO CON VOZ EN ESPAÑOL)
private playAudio(message: string): void {
  if (!this.enableAudio || !this.speechSynthesis) {
    console.log('🔇 Audio desactivado o no disponible');
    return;
  }

  console.log('🔊 INICIANDO AUDIO:', message);

  try {
    // ✅ CANCELAR AUDIO ANTERIOR SOLO SI ESTÁ HABLANDO
    if (this.speechSynthesis.speaking) {
      this.speechSynthesis.cancel();
      console.log('🛑 Audio anterior cancelado');
    }
    
    // ✅ ESPERAR A QUE SE CANCELE COMPLETAMENTE
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(message);
      
      // ✅ CONFIGURACIÓN MEJORADA
      utterance.lang = 'es-ES';
      utterance.rate = 0.8;        // Más lento
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // ✅ BUSCAR Y ASIGNAR VOZ EN ESPAÑOL
      const voices = this.speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => 
        voice.lang.includes('es') || 
        voice.name.toLowerCase().includes('spanish') ||
        voice.name.toLowerCase().includes('español')
      );
      
      if (spanishVoice) {
        utterance.voice = spanishVoice;
        console.log(`🎤 Usando voz: ${spanishVoice.name}`);
      } else {
        console.log('⚠️ Usando voz por defecto');
      }

      // ✅ EVENTOS DE AUDIO
      utterance.onstart = () => {
        console.log('✅ Audio INICIADO:', message);
        this.isPlayingAudio = true;
      };

      utterance.onend = () => {
        console.log('✅ Audio COMPLETADO');
        this.isPlayingAudio = false;
      };

      utterance.onerror = (event) => {
        console.error('❌ Error audio:', event.error);
        this.isPlayingAudio = false;
        
        // ✅ RETRY SI ES "INTERRUPTED"
        if (event.error === 'interrupted') {
          console.log('🔄 Reintentando audio...');
          setTimeout(() => {
            this.speechSynthesis.speak(utterance);
          }, 500);
        }
      };

      // ✅ REPRODUCIR AUDIO
      this.speechSynthesis.speak(utterance);
      this.lastAudioTime = Date.now();
      
    }, 300); // Aumentado el delay
    
  } catch (error) {
    console.error('❌ Error reproduciendo audio:', error);
  }
}

  ngOnInit(): void {
    console.log('🚀 PoseCameraComponent ngOnInit');
    this.setupPoseEngineSubscriptions();
    this.startErrorCleanup(); // ✅ AGREGAR ESTA LÍNEA
  }

  ngAfterViewInit(): void {
    console.log('🎯 PoseCameraComponent ngAfterViewInit');
    this.attemptInitializationWithFallback();
  }

  ngOnDestroy(): void {
    console.log('🧹 PoseCameraComponent ngOnDestroy');
    this.cleanup();
  }

  // ✅ CONFIGURAR SUBSCRIPCIONES AL POSE ENGINE
  private setupPoseEngineSubscriptions(): void {
    // Establecer ejercicio en el analizador
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
          console.log('🧠 Analizando movimiento...');
          this.analyzeMovement(this.currentPose, angles);
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

// 🧠 ANALIZAR MOVIMIENTO (CON CONTEO CORREGIDO)
private analyzeMovement(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
  try {
    const analysis = this.biomechanicsAnalyzer.analyzeMovement(pose, angles);
    
    console.log('📊 Análisis completado:', {
      errorsCount: analysis.errors.length,
      phase: analysis.phase,
      repetitions: analysis.repetitionCount,
      componentCount: this.repetitionCount // ✅ AGREGAR PARA DEBUG
    });

    // ✅ ACTUALIZAR REPETICIONES INMEDIATAMENTE
    const previousCount = this.repetitionCount;
    this.repetitionCount = analysis.repetitionCount; // ✅ SINCRONIZAR SIEMPRE
    
    // ✅ DETECTAR NUEVA REPETICIÓN
    if (this.repetitionCount > previousCount) {
      const newReps = this.repetitionCount - previousCount;
      console.log(`🎉 ¡NUEVA(S) REPETICIÓN(ES)! Anterior: ${previousCount}, Actual: ${this.repetitionCount}, Nuevas: ${newReps}`);
      
      // ✅ EMITIR EVENTO
      this.repetitionCounted.emit(this.repetitionCount);
      
      // ✅ AUDIO DE REPETICIÓN COMPLETADA
      // ✅ AUDIO SOLO CADA 5 REPETICIONES
     // ✅ AUDIO MOTIVACIONAL CADA 5 REPETICIONES
        if (this.repetitionCount % 5 === 0) {
          let message = '';
          
          switch (this.repetitionCount) {
            case 5:
              message = '¡Bien! 5 repeticiones completadas';
              break;
            case 10:
              message = '¡Excelente! Ya llevas 10 repeticiones';
              break;
            case 15:
              message = '¡Increíble! 15 repeticiones, vas genial';
              break;
            case 20:
              message = '¡Impresionante! 20 repeticiones completadas';
              break;
            case 25:
              message = '¡Eres imparable! 25 repeticiones';
              break;
            default:
              message = `¡Fantástico! ${this.repetitionCount} repeticiones completadas`;
          }
          
          this.playAudio(message);
          console.log(`🔊 Milestone alcanzado: ${this.repetitionCount} repeticiones`);
        } else {
          console.log(`✅ Repetición ${this.repetitionCount} completada silenciosamente`);
        }
      }

    // ✅ PROCESAR ERRORES NUEVOS
    const newErrors = this.filterNewErrors(analysis.errors);
    
    if (newErrors.length > 0) {
      console.log('🚨 Nuevos errores detectados:', newErrors.length);
      
      // ✅ ACTUALIZAR ERRORES ACTUALES
      this.currentErrors = newErrors;
      this.errorDetected.emit(newErrors);
      
      // ✅ REPRODUCIR AUDIO PARA ERRORES (SOLO SI NO HAY REPETICIÓN NUEVA)
      if (this.repetitionCount === previousCount) {
        newErrors.forEach((error, index) => {
          console.log(`🔊 Reproduciendo audio para error ${index + 1}:`, error.description);
          
          setTimeout(() => {
            this.playAudio(error.recommendation);
          }, index * 500);
        });
      }
    }

    // ✅ ACTUALIZAR FASE ACTUAL
    this.currentPhase = analysis.phase;
    
  } catch (error) {
    console.error('❌ Error en análisis biomecánico:', error);
  }
}
// 🔍 FILTRAR ERRORES (SOLO UNO A LA VEZ)
private filterNewErrors(errors: PostureError[]): PostureError[] {
  if (errors.length === 0) return [];
  
  const now = Date.now();
  const ERROR_DISPLAY_DURATION = 5000;
  
  // Limpiar errores antiguos
  this.currentErrors = this.currentErrors.filter(error => 
    (now - error.timestamp) < ERROR_DISPLAY_DURATION
  );
  
  // ✅ SI YA HAY UN ERROR MOSTRÁNDOSE, NO MOSTRAR MÁS
  if (this.currentErrors.length > 0) {
    console.log('⏸️ Ya hay error mostrándose, esperando...');
    return [];
  }
  
  // ✅ SOLO EL ERROR MÁS SEVERO
  const mostSevereError = errors.reduce((prev, current) => 
    (prev.severity > current.severity) ? prev : current
  );
  
  console.log('✅ Mostrando error:', mostSevereError.description);
  return [mostSevereError];
}

// 🎨 DIBUJAR ESQUELETO (SIN MODO ESPEJO)
private drawSkeleton(pose: PoseKeypoints): void {
  if (!this.showSkeleton || !this.canvasCtx || !pose) return;

  const ctx = this.canvasCtx;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Limpiar canvas
  ctx.clearRect(0, 0, width, height);

  // ✅ CONFIGURAR ESTILO SIN TRANSFORMACIONES
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#ff0000';

  // ✅ DIBUJAR PUNTOS (COORDENADAS DIRECTAS)
  const keyPoints = [
    'nose', 'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
    'left_hip', 'right_hip', 'left_knee', 'right_knee',
    'left_ankle', 'right_ankle'
  ];

  keyPoints.forEach(pointName => {
    const point = pose[pointName];
    if (point && point.visibility > 0.5) {
      // ✅ INVERTIR X PARA CORREGIR ESPEJO
      const x = point.x * width;  // ← ESTA ES LA CLAVE
      const y = point.y * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  // ✅ DIBUJAR CONEXIONES (COORDENADAS CORREGIDAS)
  const connections = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle']
  ];

  connections.forEach(([point1, point2]) => {
    const p1 = pose[point1];
    const p2 = pose[point2];
    
    if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
      ctx.beginPath();
      // ✅ INVERTIR X PARA AMBOS PUNTO
      ctx.moveTo((p1.x) * width, p1.y * height);
      ctx.lineTo((p2.x) * width, p2.y * height);
      ctx.stroke();
    }
  });
}
  // 🚨 DIBUJAR OVERLAY DE ERRORES
  private drawErrorOverlay(): void {
    if (!this.overlayCtx || this.currentErrors.length === 0) return;

    const ctx = this.overlayCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Limpiar overlay
    ctx.clearRect(0, 0, width, height);

    // Mostrar errores actuales
    this.currentErrors.forEach((error, index) => {
      const y = 50 + (index * 60);
      
      // Fondo del error
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fillRect(10, y - 35, width - 20, 50);
      
      // Texto del error
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`⚠️ ${error.description}`, 20, y - 10);
      
      // Recomendación
      ctx.font = '12px Arial';
      ctx.fillText(`💡 ${error.recommendation}`, 20, y + 8);
    });
  }

  // 🚀 INTENTAR INICIALIZACIÓN CON FALLBACK
  private attemptInitializationWithFallback(): void {
    this.initializationAttempts++;
    console.log(`🎯 Intento ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
    
    if (this.areViewChildElementsReady()) {
      console.log('✅ ViewChild elementos listos');
      this.startCameraSequence();
      return;
    }
    
    if (this.initializationAttempts < this.maxInitializationAttempts) {
      const delay = this.initializationAttempts * 300;
      console.log(`⏳ Reintentando en ${delay}ms...`);
      this.initializationTimer = setTimeout(() => {
        this.attemptInitializationWithFallback();
      }, delay);
    } else {
      console.error('💥 Máximo de intentos alcanzado');
      this.error = 'No se pudieron inicializar los elementos. Verifica que los permisos de cámara estén habilitados.';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // ✅ VERIFICAR ELEMENTOS VIEWCHILD
  private areViewChildElementsReady(): boolean {
    try {
      const hasRefs = !!(this.videoElementRef && this.canvasElementRef && this.overlayElementRef);
      const hasElements = !!(
        this.videoElementRef?.nativeElement && 
        this.canvasElementRef?.nativeElement && 
        this.overlayElementRef?.nativeElement
      );
      
      console.log('🔍 Estado ViewChild:', { hasRefs, hasElements });
      return hasRefs && hasElements;
      
    } catch (error) {
      console.error('❌ Error verificando ViewChild:', error);
      return false;
    }
  }

  // 📹 SECUENCIA DE INICIO DE CÁMARA
  private async startCameraSequence(): Promise<void> {
    try {
      console.log('📹 === INICIANDO SECUENCIA DE CÁMARA ===');

      // 1. Obtener elementos
      const videoElement = this.videoElementRef.nativeElement;
      const canvasElement = this.canvasElementRef.nativeElement;
      const overlayElement = this.overlayElementRef.nativeElement;

      // 2. Configurar contextos de canvas
      this.canvasCtx = canvasElement.getContext('2d');
      this.overlayCtx = overlayElement.getContext('2d');

      if (!this.canvasCtx || !this.overlayCtx) {
        throw new Error('No se pudieron obtener contextos de canvas');
      }

      // 3. Iniciar cámara
      await this.poseEngine.startCamera(videoElement, canvasElement);

      // 4. Sincronizar tamaños de canvas
      overlayElement.width = canvasElement.width;
      overlayElement.height = canvasElement.height;

      // 5. Marcar como inicializado
      this.isInitialized = true;
      this.isLoading = false;
      this.error = null;

      console.log('✅ === CÁMARA INICIADA EXITOSAMENTE ===');
      
      // ✅ Audio de bienvenida
      this.playAudio(`Detección postural iniciada. Ejercicio: ${this.getExerciseName(this.exerciseType)}`);

    } catch (error) {
      console.error('❌ Error en secuencia de cámara:', error);
      this.error = `Error iniciando cámara: ${error}`;
      this.isLoading = false;
    }

    this.cdr.detectChanges();
  }

  // 🏋️ OBTENER NOMBRE DEL EJERCICIO EN ESPAÑOL
  private getExerciseName(exercise: ExerciseType): string {
    const names = {
        [ExerciseType.SQUATS]: 'sentadillas',
        [ExerciseType.PUSHUPS]: 'flexiones',
        [ExerciseType.LUNGES]: 'estocadas',
        [ExerciseType.PLANK]: 'plancha',
        [ExerciseType.BICEP_CURLS]: 'curl de bíceps',
        [ExerciseType.DEADLIFTS]: 'peso muerto',
        [ExerciseType.OVERHEAD_PRESS]: 'press militar'
      };
    return names[exercise] || 'ejercicio';
  }

  // 🚀 MÉTODO PÚBLICO PARA INICIAR CÁMARA
  async startCamera(): Promise<void> {
    console.log('🚀 Método público startCamera llamado');
    this.isLoading = true;
    this.error = null;
    this.initializationAttempts = 0;
    this.cdr.detectChanges();
    
    // Limpiar timer previo
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }
    
    this.attemptInitializationWithFallback();
  }

  // 🛑 MÉTODO PÚBLICO PARA PARAR CÁMARA
  async stopCamera(): Promise<void> {
    console.log('🛑 Parando cámara...');
    
    try {
      await this.poseEngine.stopCamera();
      this.isInitialized = false;
      this.currentPose = null;
      this.currentAngles = null;
      this.currentErrors = [];
      
      // Cancelar audio si está reproduciéndose
      if (this.speechSynthesis && this.isPlayingAudio) {
        this.speechSynthesis.cancel();
        this.isPlayingAudio = false;
      }
      
      this.cdr.detectChanges();
      console.log('✅ Cámara parada');
      
    } catch (error) {
      console.error('❌ Error parando cámara:', error);
    }
  }

// 🔄 CAMBIAR TIPO DE EJERCICIO (MEJORADO)
setExerciseType(exerciseType: ExerciseType): void {
  console.log(`🏋️ Cambiando ejercicio a: ${exerciseType}`);
  
  // ✅ RESET COMPLETO AL CAMBIAR EJERCICIO
  this.biomechanicsAnalyzer.setCurrentExercise(exerciseType);
  this.biomechanicsAnalyzer.resetCounter();
  this.repetitionCount = 0;
  this.currentErrors = [];
  this.currentPhase = RepetitionPhase.IDLE;
  
  this.exerciseType = exerciseType;
  
  // Audio de confirmación
  this.playAudio(`Ejercicio cambiado a ${this.getExerciseName(exerciseType)}. Contador reseteado.`);
  
  this.cdr.detectChanges();
}

  // 🔄 RESET CONTADOR DE REPETICIONES (MEJORADO)
resetRepetitions(): void {
  console.log('🔄 === RESET REPETICIONES ===');
  console.log(`Repeticiones antes: Componente=${this.repetitionCount}, Analizador=${this.biomechanicsAnalyzer.getStats().repetitions}`);
  
  // ✅ RESET EN AMBOS LUGARES
  this.biomechanicsAnalyzer.resetCounter();
  this.repetitionCount = 0;
  this.currentErrors = [];
  this.currentPhase = RepetitionPhase.IDLE;
  
  console.log('✅ Reset completado en componente y analizador');
  this.playAudio('Contador de repeticiones reseteado');
  this.cdr.detectChanges();
}

  // 🔇 TOGGLE AUDIO
  toggleAudio(): void {
    this.enableAudio = !this.enableAudio;
    console.log(`🔊 Audio ${this.enableAudio ? 'activado' : 'desactivado'}`);
    
    if (!this.enableAudio && this.speechSynthesis && this.isPlayingAudio) {
      this.speechSynthesis.cancel();
      this.isPlayingAudio = false;
    }
    
    this.cdr.detectChanges();
  }

  // 🎯 TOGGLE DETECCIÓN DE ERRORES
  toggleErrorDetection(): void {
    this.enableErrorDetection = !this.enableErrorDetection;
    console.log(`🔍 Detección de errores ${this.enableErrorDetection ? 'activada' : 'desactivada'}`);
    
    if (!this.enableErrorDetection) {
      this.currentErrors = [];
    }
    
    this.cdr.detectChanges();
  }

  // 🎨 TOGGLE ESQUELETO
  toggleSkeleton(): void {
    this.showSkeleton = !this.showSkeleton;
    console.log(`🎨 Esqueleto ${this.showSkeleton ? 'visible' : 'oculto'}`);
    
    if (!this.showSkeleton && this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvasCtx.canvas.width, this.canvasCtx.canvas.height);
    }
    
    this.cdr.detectChanges();
  }

  // 📊 OBTENER ESTADÍSTICAS ACTUALES
  getCurrentStats(): {
    repetitions: number;
    currentPhase: RepetitionPhase;
    errors: PostureError[];
    fps: number;
    isDetecting: boolean;
  } {
    return {
      repetitions: this.repetitionCount,
      currentPhase: this.currentPhase,
      errors: this.currentErrors,
      fps: this.fps,
      isDetecting: this.enableErrorDetection && this.isInitialized
    };
  }

  // 🧹 CLEANUP COMPLETO
  private cleanup(): void {
    console.log('🧹 Limpiando PoseCameraComponent...');

    // Limpiar timer de inicialización
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }

    // Parar cámara
    this.stopCamera();

    // Limpiar subscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    // Cancelar audio
    if (this.speechSynthesis && this.isPlayingAudio) {
      this.speechSynthesis.cancel();
      this.isPlayingAudio = false;
    }

    // Limpiar contextos
    this.canvasCtx = null;
    this.overlayCtx = null;

    // Limpiar analizador
    this.biomechanicsAnalyzer.cleanup();

    console.log('✅ PoseCameraComponent limpiado');
  }

  // 🎮 MÉTODOS PÚBLICOS PARA LA INTERFAZ

  // Obtener mensaje de estado para mostrar en UI
  getStatusMessage(): string {
    if (this.error) return this.error;
    if (this.isLoading) return 'Iniciando cámara...';
    if (!this.isInitialized) return 'Cámara no inicializada';
    if (this.fps === 0) return 'Conectando...';
    if (this.fps < 15) return 'Conexión lenta';
    return 'Funcionando correctamente';
  }

  // Obtener color del estado para UI
  getStatusColor(): string {
    if (this.error) return 'danger';
    if (this.isLoading || !this.isInitialized) return 'warning';
    if (this.fps < 15) return 'warning';
    return 'success';
  }

  // Obtener fase actual del ejercicio en español
  getCurrentPhaseText(): string {
    const phaseTexts = {
      [RepetitionPhase.IDLE]: 'En reposo',
      [RepetitionPhase.TOP]: 'Posición alta',
      [RepetitionPhase.DESCENDING]: 'Bajando',
      [RepetitionPhase.BOTTOM]: 'Posición baja',
      [RepetitionPhase.ASCENDING]: 'Subiendo',
      [RepetitionPhase.HOLD]: 'Manteniendo'
    };
    return phaseTexts[this.currentPhase] || 'Desconocido';
  }

  // Verificar si hay errores activos
  hasActiveErrors(): boolean {
    return this.currentErrors.length > 0;
  }

  // Obtener lista de errores activos para UI
  getActiveErrors(): PostureError[] {
    return this.currentErrors;
  }

  // Obtener texto de motivación basado en repeticiones
  getMotivationText(): string {
    if (this.repetitionCount === 0) {
      return '¡Empecemos! Realiza tu primer ejercicio';
    } else if (this.repetitionCount < 5) {
      return `¡Vas bien! ${this.repetitionCount} repeticiones completadas`;
    } else if (this.repetitionCount < 10) {
      return `¡Excelente! Ya tienes ${this.repetitionCount} repeticiones`;
    } else {
      return `¡Increíble! ${this.repetitionCount} repeticiones - ¡Eres imparable!`;
    }
  }

  // 🎤 MÉTODO PÚBLICO PARA PROBAR AUDIO
  testAudio(): void {
    this.playAudio('Sistema de audio funcionando correctamente. Detección postural lista.');
  }

  // 📱 OBTENER INFO DEL DISPOSITIVO PARA DEBUG
  getDeviceInfo(): any {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      speechSynthesisSupported: !!this.speechSynthesis,
      mediaDevicesSupported: !!navigator.mediaDevices,
      getUserMediaSupported: !!navigator.mediaDevices?.getUserMedia
    };
  }
  // Método para trackBy en template
trackErrorById(index: number, error: PostureError): string {
  return error.type + error.timestamp;
}
// 🎨 OBTENER CLASE CSS SEGÚN SEVERIDAD
getAlertClass(severity: number): string {
  if (severity <= 3) return 'alert-success'; // Verde
  if (severity <= 6) return 'alert-warning'; // Naranja
  return 'alert-danger'; // Rojo
}

// 🚨 OBTENER ÍCONO SEGÚN SEVERIDAD
getAlertIcon(severity: number): string {
  if (severity <= 3) return 'checkmark-circle-outline'; // Verde
  if (severity <= 6) return 'warning-outline'; // Naranja
  return 'alert-circle-outline'; // Rojo
}

// 📢 OBTENER TÍTULO SEGÚN SEVERIDAD
getAlertTitle(severity: number): string {
  if (severity <= 3) return '¡Bien hecho!'; // Verde
  if (severity <= 6) return 'Ajuste menor'; // Naranja
  return '¡Corrección necesaria!'; // Rojo
}

// 📊 OBTENER CLASE DE BARRA SEGÚN SEVERIDAD
getSeverityBarClass(severity: number): string {
  if (severity <= 3) return 'bar-success'; // Verde
  if (severity <= 6) return 'bar-warning'; // Naranja
  return 'bar-danger'; // Rojo
}

// 📝 OBTENER TEXTO DE SEVERIDAD
getSeverityText(severity: number): string {
  if (severity <= 3) return 'Excelente';
  if (severity <= 6) return 'Mejorable';
  return 'Crítico';
}
// 🔄 LIMPIAR ERRORES AUTOMÁTICAMENTE
private startErrorCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const ERROR_DISPLAY_DURATION = 5000; // 5 segundos
    
    const initialCount = this.currentErrors.length;
    this.currentErrors = this.currentErrors.filter(error => 
      (now - error.timestamp) < ERROR_DISPLAY_DURATION
    );
    
    if (this.currentErrors.length !== initialCount) {
      console.log(`🧹 Limpiados ${initialCount - this.currentErrors.length} errores antiguos`);
      this.cdr.detectChanges();
    }
  }, 1000); // Revisar cada segundo
}

}