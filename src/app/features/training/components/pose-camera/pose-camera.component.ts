// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ SOLUCIÓN VIEWCHILD - ESTRATEGIA ALTERNATIVA

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
  
  // ✅ ViewChild con { static: true } - CAMBIO CLAVE
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
    
    // ✅ FORZAR DETECCIÓN DE CAMBIOS ANTES DE CONTINUAR
    this.cdr.detectChanges();
    
    // ✅ ESTRATEGIA ALTERNATIVA: usar querySelector como fallback
    this.initializationTimer = setTimeout(() => {
      this.attemptInitializationWithFallback();
    }, 100);
  }

  ngOnDestroy(): void {
    console.log('🧹 PoseCameraComponent ngOnDestroy');
    this.cleanup();
  }

  // 🎯 NUEVA ESTRATEGIA DE INICIALIZACIÓN CON FALLBACK
  private attemptInitializationWithFallback(): void {
    this.initializationAttempts++;
    console.log(`🎯 Intento ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
    
    if (this.initializationTimer === null) {
      console.log('⏭️ Componente destruido, cancelando');
      return;
    }
    
    // ✅ ESTRATEGIA 1: Intentar con ViewChild
    if (this.areViewChildElementsReady()) {
      console.log('✅ ViewChild elementos listos');
      this.startCameraSequence();
      return;
    }
    
    // ✅ ESTRATEGIA 2: Fallback con querySelector
    if (this.initializationAttempts >= 2) {
      console.log('🔄 Intentando fallback con querySelector...');
      if (this.setupElementsWithQuerySelector()) {
        console.log('✅ Elementos configurados con querySelector');
        this.startCameraSequence();
        return;
      }
    }
    
    // ✅ ESTRATEGIA 3: Reintentar si no ha alcanzado el máximo
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
      
      // Buscar elementos en el DOM
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
      
      // ✅ REEMPLAZAR LAS REFERENCIAS VIEWCHILD CON LOS ELEMENTOS ENCONTRADOS
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

      // 1. Verificar MediaPipe
      await this.waitForMediaPipe();

      // 2. Inicializar canvas
      this.initializeCanvas();

      // 3. Iniciar cámara
      await this.startCameraWithMediaPipe();

      // 4. Finalizar
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

    // ✅ QUITAR TRANSFORM DEL OVERLAY PARA CORREGIR EL ESPEJO
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

    // ✅ SIMPLE: APLICAR TRANSFORM AL CONTEXTO PARA CORREGIR EL ESPEJO
    ctx.save(); // Guardar estado del contexto
    ctx.scale(-1, 1); // Voltear horizontalmente
    ctx.translate(-width, 0); // Reposicionar

    // Ahora dibujar normalmente - el transform se encarga del espejo
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

    ctx.restore(); // Restaurar estado original del contexto
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
    
    this.currentErrors = analysis.errors;
    this.currentPhase = analysis.phase;
    this.currentQuality = analysis.qualityScore;
    
    if (analysis.repetitionCount > this.repetitionCount) {
      this.repetitionCount = analysis.repetitionCount;
      this.repetitionComplete.emit(this.repetitionCount);
    }

    if (analysis.errors.length > 0) {
      this.errorDetected.emit(analysis.errors);
    }
    
    this.qualityScore.emit(analysis.qualityScore);
  }

  private drawOverlayInfo(): void {
    if (!this.overlayCtx) return;
    
    const ctx = this.overlayCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // ✅ APLICAR TRANSFORM PARA QUE LA INFORMACIÓN NO SE VEA ESPEJADA
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    
    // Panel info (ahora en la esquina correcta)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 200, 120);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText(`Reps: ${this.repetitionCount}`, 25, 35);
    ctx.fillText(`Calidad: ${this.currentQuality}%`, 25, 55);
    ctx.fillText(`FPS: ${this.fps}`, 25, 75);
    ctx.fillText(`Fase: ${this.getPhaseText()}`, 25, 95);
    ctx.fillText(`Errores: ${this.currentErrors.length}`, 25, 115);

    // Mostrar errores
    if (this.currentErrors.length > 0) {
      const startY = 150;
      
      this.currentErrors.forEach((error, index) => {
        const y = startY + (index * 30);
        
        // Fondo del error
        ctx.fillStyle = 'rgba(255, 48, 48, 0.9)';
        ctx.fillRect(10, y - 20, width - 20, 25);
        
        // Texto del error
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠️ ${error.description}`, width / 2, y - 5);
      });
    }

    // Mostrar consejo si no hay errores
    if (this.currentErrors.length === 0 && this.isRunning) {
      const tipY = height - 50;
      
      // Fondo del consejo
      ctx.fillStyle = 'rgba(16, 220, 96, 0.9)';
      ctx.fillRect(10, tipY - 20, width - 20, 35);
      
      // Texto del consejo
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`💡 ${this.getCurrentCoachingTip()}`, width / 2, tipY);
    }

    ctx.restore(); // Restaurar estado
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Error desconocido';
  }

  // MÉTODOS PÚBLICOS
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

  public getCurrentCoachingTip(): string {
    const tips: { [key in ExerciseType]: string[] } = {
      [ExerciseType.SQUATS]: [
        'Mantén el pecho erguido',
        'Baja como si te sentaras',
        'Talones en el suelo',
        'Rodillas siguiendo los pies'
      ],
      [ExerciseType.PUSHUPS]: [
        'Línea recta del cuerpo',
        'Codos a 45 grados',
        'Pecho casi al suelo',
        'Core contraído'
      ],
      [ExerciseType.LUNGES]: [
        'Paso largo y estable',
        'Rodilla trasera hacia el suelo',
        'Torso erguido',
        'Peso en el talón delantero'
      ],
      [ExerciseType.PLANK]: [
        'Línea recta completa',
        'Core bien contraído',
        'Respiración normal',
        'Codos bajo hombros'
      ],
      [ExerciseType.BICEP_CURLS]: [
        'Codos pegados al cuerpo',
        'Movimiento controlado',
        'Sin usar impulso',
        'Muñecas rectas'
      ],
      [ExerciseType.DEADLIFT]: [
        'Espalda recta siempre',
        'Caderas hacia atrás',
        'Barra cerca del cuerpo',
        'Subir con las piernas'
      ],
      [ExerciseType.BENCH_PRESS]: [
        'Hombros hacia atrás',
        'Arco natural en espalda',
        'Barra al pecho medio',
        'Movimiento controlado'
      ],
      [ExerciseType.SHOULDER_PRESS]: [
        'Core bien activado',
        'Codos hacia adelante',
        'Press vertical directo',
        'No arquear la espalda'
      ]
    };

    const exerciseTips = tips[this.exerciseType];
    return exerciseTips[Math.floor(Math.random() * exerciseTips.length)];
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