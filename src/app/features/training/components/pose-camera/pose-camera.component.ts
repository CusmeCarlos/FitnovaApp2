// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ COMPONENTE PROFESIONAL COMPLETO

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
  
  // ✅ ViewChild con { static: true }
  @ViewChild('videoElement', { static: true }) videoElementRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: true }) canvasElementRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayElement', { static: true }) overlayElementRef!: ElementRef<HTMLCanvasElement>;

  // Inputs
  @Input() exerciseType: ExerciseType = ExerciseType.SQUATS;
  @Input() showSkeleton: boolean = true;
  @Input() showAngles: boolean = false;
  @Input() enableErrorDetection: boolean = true;

  // Outputs
  @Output() poseDetected = new EventEmitter<PoseKeypoints>();
  @Output() errorDetected = new EventEmitter<PostureError[]>();
  @Output() repetitionComplete = new EventEmitter<number>();
  @Output() qualityScore = new EventEmitter<number>();
  @Output() backToExercises = new EventEmitter<void>(); // ✅ NUEVO OUTPUT


  // Estado del componente
  isInitialized = false;
  isRunning = false;
  isLoading = true;
  error: string | null = null;

  // Datos en tiempo real
  currentPose: PoseKeypoints | null = null;
  currentAngles: BiomechanicalAngles | null = null;
  currentErrors: PostureError[] = [];
  currentPhase: RepetitionPhase = RepetitionPhase.IDLE;
  repetitionCount = 0;
  currentQuality = 0;
  fps = 0;

  // Canvas contexts
  private canvasCtx!: CanvasRenderingContext2D;
  private overlayCtx!: CanvasRenderingContext2D;

  // Subscripciones
  private subscriptions: Subscription[] = [];

  // Control de inicialización
  public initializationAttempts = 0;
  public maxInitializationAttempts = 5;
  private initializationTimer: any = null;

  // ✅ CONTROL DE CONSEJOS ESTABLES
  private currentTip: string = '';
  private tipStartTime: number = 0;
  private readonly TIP_DURATION = 4000; // 4 segundos por consejo
  private tipIndex: number = 0;

  // ✅ NUEVAS PROPIEDADES PARA FUNCIONALIDAD PROFESIONAL
  public isPaused = false;
  public Math = Math; // Para usar Math en el template

  constructor(
    private poseEngine: PoseDetectionEngine,
    private biomechanicsAnalyzer: BiomechanicsAnalyzer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('🎬 PoseCameraComponent ngOnInit');
    this.biomechanicsAnalyzer.setCurrentExercise(this.exerciseType);
    this.setupSubscriptions();
  }

  ngAfterViewInit(): void {
    console.log('🔧 PoseCameraComponent ngAfterViewInit');
    
    this.cdr.detectChanges();
    
    this.initializationTimer = setTimeout(() => {
      this.attemptInitializationWithFallback();
    }, 100);
  }

  ngOnDestroy(): void {
    console.log('🧹 PoseCameraComponent ngOnDestroy');
    this.cleanup();
  }

  // 🎯 INICIALIZACIÓN CON FALLBACK
  private attemptInitializationWithFallback(): void {
    this.initializationAttempts++;
    console.log(`🎯 Intento ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
    
    if (this.initializationTimer === null) {
      console.log('⏭️ Componente destruido, cancelando');
      return;
    }
    
    if (this.areViewChildElementsReady()) {
      console.log('✅ ViewChild elementos listos');
      this.startCameraSequence();
      return;
    }
    
    if (this.initializationAttempts >= 2) {
      console.log('🔄 Intentando fallback con querySelector...');
      if (this.setupElementsWithQuerySelector()) {
        console.log('✅ Elementos configurados con querySelector');
        this.startCameraSequence();
        return;
      }
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

  // ✅ VERIFICAR VIEWCHILD ELEMENTOS
  private areViewChildElementsReady(): boolean {
    try {
      console.log('🔍 Verificando ViewChild...');
      
      const hasRefs = !!(this.videoElementRef && this.canvasElementRef && this.overlayElementRef);
      const hasElements = !!(
        this.videoElementRef?.nativeElement && 
        this.canvasElementRef?.nativeElement && 
        this.overlayElementRef?.nativeElement
      );
      
      console.log('📊 ViewChild estado:', { hasRefs, hasElements });
      
      if (!hasRefs || !hasElements) {
        return false;
      }
      
      const video = this.videoElementRef.nativeElement;
      const canvas = this.canvasElementRef.nativeElement;
      const overlay = this.overlayElementRef.nativeElement;
      
      const correctTypes = (
        video instanceof HTMLVideoElement &&
        canvas instanceof HTMLCanvasElement &&
        overlay instanceof HTMLCanvasElement
      );
      
      const inDOM = (
        document.body.contains(video) &&
        document.body.contains(canvas) &&
        document.body.contains(overlay)
      );
      
      console.log('📊 Verificación completa:', { correctTypes, inDOM });
      
      return correctTypes && inDOM;
      
    } catch (error) {
      console.error('❌ Error verificando ViewChild:', error);
      return false;
    }
  }

  // 🔍 CONFIGURAR ELEMENTOS CON QUERYSELECTOR (FALLBACK)
  private setupElementsWithQuerySelector(): boolean {
    try {
      console.log('🔍 Configurando con querySelector...');
      
      const video = document.querySelector('app-pose-camera video') as HTMLVideoElement;
      const canvas = document.querySelector('app-pose-camera canvas:first-of-type') as HTMLCanvasElement;
      const overlay = document.querySelector('app-pose-camera canvas:last-of-type') as HTMLCanvasElement;
      
      console.log('📊 QuerySelector resultados:', {
        video: !!video,
        canvas: !!canvas,
        overlay: !!overlay
      });
      
      if (!video || !canvas || !overlay) {
        return false;
      }
      
      this.videoElementRef = new ElementRef(video);
      this.canvasElementRef = new ElementRef(canvas);
      this.overlayElementRef = new ElementRef(overlay);
      
      console.log('✅ Referencias reemplazadas exitosamente');
      return true;
      
    } catch (error) {
      console.error('❌ Error con querySelector:', error);
      return false;
    }
  }

  // 🚀 INICIAR SECUENCIA DE CÁMARA
  private async startCameraSequence(): Promise<void> {
    try {
      console.log('🚀 === INICIANDO SECUENCIA DE CÁMARA ===');
      
      this.error = null;
      this.cdr.detectChanges();

      await this.waitForMediaPipe();
      this.initializeCanvas();
      await this.startCameraWithMediaPipe();

      this.isLoading = false;
      this.isInitialized = true;
      this.cdr.detectChanges();
      
      console.log('✅ === SECUENCIA COMPLETADA ===');
      
    } catch (error) {
      console.error('💥 Error en secuencia:', error);
      this.error = this.getErrorMessage(error);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // ⏳ ESPERAR MEDIAPIPE
  private async waitForMediaPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isMediaPipeReady()) {
        console.log('✅ MediaPipe listo');
        resolve();
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 30;
      
      const checkMediaPipe = () => {
        attempts++;
        
        if (this.isMediaPipeReady()) {
          console.log(`✅ MediaPipe listo después de ${attempts} intentos`);
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('MediaPipe no disponible'));
        } else {
          setTimeout(checkMediaPipe, 100);
        }
      };
      
      setTimeout(checkMediaPipe, 100);
    });
  }

  private isMediaPipeReady(): boolean {
    return !!(window.Pose && window.Camera && window.drawConnectors && window.POSE_CONNECTIONS);
  }

  // 📹 INICIAR CÁMARA CON MEDIAPIPE
  private async startCameraWithMediaPipe(): Promise<void> {
    try {
      console.log('📹 Iniciando cámara...');

      const video = this.videoElementRef.nativeElement;
      const canvas = this.canvasElementRef.nativeElement;
      
      if (!video || !canvas) {
        throw new Error('Elementos no disponibles');
      }

      await this.poseEngine.startCamera(video, canvas);
      
      this.canvasCtx = canvas.getContext('2d')!;
      this.overlayCtx = this.overlayElementRef.nativeElement.getContext('2d')!;
      
      const overlay = this.overlayElementRef.nativeElement;
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      
      this.setupCanvasStyles();
      this.startRenderLoop();
      
      this.isRunning = true;
      console.log('✅ Cámara iniciada');
      
    } catch (error) {
      console.error('❌ Error iniciando cámara:', error);
      throw error;
    }
  }

  private setupCanvasStyles(): void {
    const video = this.videoElementRef.nativeElement;
    const canvas = this.canvasElementRef.nativeElement;
    const overlay = this.overlayElementRef.nativeElement;

    video.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      object-fit: cover; z-index: 1; transform: scaleX(-1); display: block;
    `;

    canvas.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2; pointer-events: none; display: none;
    `;

    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 3; pointer-events: none; background: transparent;
    `;
  }

  private initializeCanvas(): void {
    const canvas = this.canvasElementRef.nativeElement;
    const overlay = this.overlayElementRef.nativeElement;

    canvas.width = 640;
    canvas.height = 480;
    overlay.width = 640;
    overlay.height = 480;
  }

  // 🔗 CONFIGURAR SUSCRIPCIONES
  private setupSubscriptions(): void {
    this.subscriptions.push(
      this.poseEngine.pose$.subscribe(pose => {
        this.currentPose = pose;
        if (pose) this.poseDetected.emit(pose);
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.push(
      this.poseEngine.angles$.subscribe(angles => {
        this.currentAngles = angles;
        if (angles && this.currentPose && this.enableErrorDetection) {
          this.analyzeMovement(this.currentPose, angles);
        }
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.push(
      this.poseEngine.fps$.subscribe(fps => {
        this.fps = fps;
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.push(
      this.poseEngine.status$.subscribe(status => {
        if (status === 'error') {
          this.error = 'Error en detección';
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  private startRenderLoop(): void {
    const renderFrame = () => {
      if (!this.isRunning || !this.overlayCtx) return;
      
      try {
        this.overlayCtx.clearRect(0, 0, this.overlayCtx.canvas.width, this.overlayCtx.canvas.height);
        
        if (this.showSkeleton && this.currentPose) {
          this.drawPoseManually(this.currentPose);
        }

        this.drawOverlayInfo();
      } catch (error) {
        console.error('❌ Error render:', error);
      }
      
      requestAnimationFrame(renderFrame);
    };
    
    requestAnimationFrame(renderFrame);
  }

  private drawPoseManually(pose: PoseKeypoints): void {
    const ctx = this.overlayCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);

    // Conexiones principales
    this.drawConnection(pose.left_shoulder, pose.right_shoulder, width, height);
    this.drawConnection(pose.left_shoulder, pose.left_hip, width, height);
    this.drawConnection(pose.right_shoulder, pose.right_hip, width, height);
    this.drawConnection(pose.left_hip, pose.right_hip, width, height);
    
    // Brazos
    this.drawConnection(pose.left_shoulder, pose.left_elbow, width, height);
    this.drawConnection(pose.left_elbow, pose.left_wrist, width, height);
    this.drawConnection(pose.right_shoulder, pose.right_elbow, width, height);
    this.drawConnection(pose.right_elbow, pose.right_wrist, width, height);
    
    // Piernas
    this.drawConnection(pose.left_hip, pose.left_knee, width, height);
    this.drawConnection(pose.left_knee, pose.left_ankle, width, height);
    this.drawConnection(pose.right_hip, pose.right_knee, width, height);
    this.drawConnection(pose.right_knee, pose.right_ankle, width, height);

    // Landmarks
    [pose.nose, pose.left_shoulder, pose.right_shoulder, pose.left_elbow, pose.right_elbow,
     pose.left_wrist, pose.right_wrist, pose.left_hip, pose.right_hip, pose.left_knee,
     pose.right_knee, pose.left_ankle, pose.right_ankle].forEach(landmark => {
      this.drawLandmark(landmark, width, height);
    });

    ctx.restore();
  }

  private drawConnection(start: any, end: any, width: number, height: number): void {
    if (start.visibility > 0.5 && end.visibility > 0.5) {
      const ctx = this.overlayCtx;
      ctx.strokeStyle = '#0099FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  }

  private drawLandmark(landmark: any, width: number, height: number): void {
    if (landmark.visibility > 0.5) {
      const ctx = this.overlayCtx;
      ctx.fillStyle = '#00FF00';
      ctx.beginPath();
      ctx.arc(landmark.x * width, landmark.y * height, 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private analyzeMovement(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    const analysis = this.biomechanicsAnalyzer.analyzeFrame(pose, angles);
    
    // ✅ FILTRAR ERRORES DUPLICADOS
    const newErrors = this.filterUniqueErrors(analysis.errors);
    
    this.currentErrors = newErrors;
    this.currentPhase = analysis.phase;
    this.currentQuality = analysis.qualityScore;
    
    if (analysis.repetitionCount > this.repetitionCount) {
      this.repetitionCount = analysis.repetitionCount;
      this.repetitionComplete.emit(this.repetitionCount);
    }

    if (newErrors.length > 0) {
      this.errorDetected.emit(newErrors);
    }
    
    this.qualityScore.emit(analysis.qualityScore);
  }

  // 🚫 FILTRAR ERRORES DUPLICADOS
  private filterUniqueErrors(errors: PostureError[]): PostureError[] {
    if (errors.length === 0) return [];
    
    const now = Date.now();
    const ERROR_DISPLAY_DURATION = 2000; // 2 segundos
    
    // Limpiar errores antiguos
    this.currentErrors = this.currentErrors.filter(error => 
      (now - error.timestamp) < ERROR_DISPLAY_DURATION
    );
    
    // Filtrar errores que ya están siendo mostrados
    const newErrors = errors.filter(newError => {
      return !this.currentErrors.some(existingError => 
        existingError.type === newError.type
      );
    });
    
    return newErrors;
  }

  private drawOverlayInfo(): void {
    if (!this.overlayCtx) return;
    
    const ctx = this.overlayCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);

    // Mostrar solo errores activos (evitar duplicación con debug panel)
    if (this.currentErrors.length > 0) {
      const startY = 150;
      
      this.currentErrors.forEach((error, index) => {
        const y = startY + (index * 35);
        
        // Fondo del error
        ctx.fillStyle = 'rgba(255, 48, 48, 0.9)';
        ctx.fillRect(10, y - 25, width - 20, 30);
        
        // Texto del error
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠️ ${error.description}`, width / 2, y - 8);
      });
    }

    // ✅ MOSTRAR CONSEJO ESTABLE SI NO HAY ERRORES
    if (this.currentErrors.length === 0 && this.isRunning && this.repetitionCount > 0) {
      const stableTip = this.getStableCoachingTip();
      
      if (stableTip) {
        const tipY = height - 50;
        
        // Fondo del consejo con bordes redondeados
        ctx.fillStyle = 'rgba(16, 220, 96, 0.85)';
        ctx.beginPath();
        ctx.roundRect(15, tipY - 30, width - 30, 35, 8);
        ctx.fill();
        
        // Borde sutil
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Texto del consejo
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`💡 ${stableTip}`, width / 2, tipY - 10);
      }
    }

    ctx.restore();
  }

  // ✅ OBTENER CONSEJO ESTABLE (NO CAMBIA EN CADA FRAME)
  private getStableCoachingTip(): string {
    const now = Date.now();
    
    // Si es el primer consejo o ha pasado el tiempo, cambiar consejo
    if (!this.currentTip || (now - this.tipStartTime) > this.TIP_DURATION) {
      const tips = this.getTipsForCurrentExercise();
      
      // Rotar consejos en orden, no aleatoriamente
      this.tipIndex = (this.tipIndex + 1) % tips.length;
      this.currentTip = tips[this.tipIndex];
      this.tipStartTime = now;
    }
    
    return this.currentTip;
  }

  // ✅ OBTENER CONSEJOS PARA EL EJERCICIO ACTUAL
  private getTipsForCurrentExercise(): string[] {
    const tips: { [key in ExerciseType]: string[] } = {
      [ExerciseType.SQUATS]: [
        'Mantén el pecho erguido y la mirada al frente',
        'Baja como si te fueras a sentar en una silla',
        'Mantén los talones siempre en el suelo',
        'Las rodillas deben seguir la dirección de los pies',
        'Inicia empujando las caderas hacia atrás'
      ],
      [ExerciseType.PUSHUPS]: [
        'Forma una línea recta desde cabeza hasta talones',
        'Mantén los codos a 45° del cuerpo',
        'Baja hasta que el pecho casi toque el suelo',
        'Mantén el core contraído todo el tiempo',
        'Respira: inhala al bajar, exhala al subir'
      ],
      [ExerciseType.PLANK]: [
        'Mantén una línea recta perfecta',
        'Contrae el core como si te fueran a golpear',
        'Respira normalmente, no contengas el aire',
        'Los codos directamente bajo los hombros',
        'Aprieta los glúteos para mantener posición'
      ],
      [ExerciseType.LUNGES]: [
        'Da un paso lo suficientemente largo',
        'Baja la rodilla trasera hacia el suelo',
        'Mantén el torso completamente erguido',
        'El peso debe estar en el talón delantero'
      ],
      [ExerciseType.BICEP_CURLS]: [
        'Mantén los codos pegados al cuerpo',
        'Controla el movimiento al subir y bajar',
        'No uses impulso, solo la fuerza del bíceps',
        'Mantén las muñecas rectas y firmes'
      ],
      [ExerciseType.DEADLIFT]: [
        'Mantén la espalda recta siempre',
        'Empuja las caderas hacia atrás',
        'La barra debe estar cerca del cuerpo',
        'Sube usando la fuerza de las piernas'
      ],
      [ExerciseType.BENCH_PRESS]: [
        'Retrae los hombros hacia atrás',
        'Mantén un arco natural en la espalda',
        'Baja la barra al pecho medio',
        'Movimiento controlado arriba y abajo'
      ],
      [ExerciseType.SHOULDER_PRESS]: [
        'Mantén el core bien activado',
        'Los codos ligeramente hacia adelante',
        'Press vertical directo hacia arriba',
        'No arquees excesivamente la espalda'
      ]
    };

    return tips[this.exerciseType] || ['¡Excelente trabajo! Sigue así.'];
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Error desconocido';
  }

  // ✅ NUEVOS MÉTODOS PROFESIONALES

  public showSettings(): void {
    console.log('⚙️ Mostrando configuración');
  }

  
  // ✅ NUEVO MÉTODO PARA RETROCEDER
  public goBackToExercises(): void {
    console.log('🔙 Volviendo a ejercicios...');
    this.backToExercises.emit();
  }

  public getCircleProgress(): string {
    const circumference = 2 * Math.PI * 35; // radio de 35
    const progress = Math.min(this.repetitionCount / 10, 1);
    const strokeDasharray = progress * circumference;
    return `${strokeDasharray} ${circumference}`;
  }

  // MÉTODOS PÚBLICOS EXISTENTES
  public async startCamera(): Promise<void> {
    if (!this.isInitialized && !this.isLoading) {
      this.isLoading = true;
      this.error = null;
      this.initializationAttempts = 0;
      this.cdr.detectChanges();
      
      this.initializationTimer = setTimeout(() => {
        this.attemptInitializationWithFallback();
      }, 200);
    }
  }

  public async stopCamera(): Promise<void> {
    try {
      await this.poseEngine.stopCamera();
      this.isRunning = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error deteniendo:', error);
    }
  }

  public resetSession(): void {
    this.repetitionCount = 0;
    this.currentErrors = [];
    this.currentQuality = 0;
    
    // ✅ RESETEAR CONSEJOS
    this.currentTip = '';
    this.tipStartTime = 0;
    this.tipIndex = 0;
    
    this.biomechanicsAnalyzer.setCurrentExercise(this.exerciseType);
  }

  public toggleSkeleton(): void {
    this.showSkeleton = !this.showSkeleton;
  }

  public toggleAngles(): void {
    this.showAngles = !this.showAngles;
  }

  public getPhaseText(): string {
    const phases = {
      [RepetitionPhase.IDLE]: 'Inactivo',
      [RepetitionPhase.TOP]: 'Arriba',
      [RepetitionPhase.ECCENTRIC]: 'Bajando',
      [RepetitionPhase.BOTTOM]: 'Abajo',
      [RepetitionPhase.CONCENTRIC]: 'Subiendo'
    };
    return phases[this.currentPhase] || 'Desconocido';
  }

  public getQualityClass(): string {
    if (this.currentQuality >= 80) return 'quality-excellent';
    if (this.currentQuality >= 60) return 'quality-good';
    if (this.currentQuality >= 40) return 'quality-fair';
    return 'quality-poor';
  }

  public trackByErrorType(index: number, error: PostureError): string {
    return error.type;
  }

  // ✅ MANTENER EL MÉTODO PÚBLICO PARA COMPATIBILIDAD
  public getCurrentCoachingTip(): string {
    return this.getStableCoachingTip();
  }
  // ✅ NUEVOS MÉTODOS PROFESIONALES
  public togglePause(): void {
  this.isPaused = !this.isPaused;
  console.log('🎮 Pausa toggled:', this.isPaused);
}

  private cleanup(): void {
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }
    
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopCamera();
  }
}