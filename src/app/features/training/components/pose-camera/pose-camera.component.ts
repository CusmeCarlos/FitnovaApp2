// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ VERSIÓN COMPLETA CON MEDIAPIPE REAL

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

// Declaraciones globales para MediaPipe
declare global {
  interface Window {
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
    POSE_LANDMARKS: any;
  }
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
  
  // ✅ REFERENCIAS CORREGIDAS - COINCIDEN CON EL HTML
  @ViewChild('videoElement', { static: false }) videoElementRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElementRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayElement', { static: false }) overlayElementRef!: ElementRef<HTMLCanvasElement>;

  // Inputs y Outputs
  @Input() exerciseType: ExerciseType = ExerciseType.SQUATS;
  @Input() showSkeleton: boolean = true;
  @Input() showAngles: boolean = false;
  @Input() enableErrorDetection: boolean = true;

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
  private initializationAttempts = 0;
  private maxInitializationAttempts = 5;
  private initializationInProgress = false;

  // Configuración visual
  private readonly POSE_COLORS = {
    landmarks: '#00FF00',
    connections: '#0099FF',
    errors: '#FF3030',
    angles: '#FFD700'
  };

  constructor(
    private poseEngine: PoseDetectionEngine,
    private biomechanicsAnalyzer: BiomechanicsAnalyzer,
    private cdr: ChangeDetectorRef
  ) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: any }).message);
    }
    return 'Error desconocido durante la inicialización';
  }

  ngOnInit(): void {
    console.log('🎬 Inicializando PoseCameraComponent...');
    this.biomechanicsAnalyzer.setCurrentExercise(this.exerciseType);
  }

  ngAfterViewInit(): void {
    console.log('🔧 === ngAfterViewInit EJECUTÁNDOSE ===');
    
    // Configurar suscripciones primero
    this.setupSubscriptions();
    
    // Inicializar con delay
    setTimeout(() => {
      this.attemptInitialization();
    }, 500);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // 🎯 INTENTAR INICIALIZACIÓN
  private attemptInitialization(): void {
    if (this.initializationInProgress) {
      console.log('⏭️ Inicialización ya en progreso, saltando...');
      return;
    }

    this.initializationAttempts++;
    console.log(`🎯 Intento de inicialización ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
    
    if (this.areElementsReady()) {
      console.log('✅ Elementos verificados, iniciando cámara...');
      this.initializationInProgress = true;
      this.startCameraSequence();
    } else {
      console.log('❌ Elementos no listos, reintentando...');
      
      if (this.initializationAttempts < this.maxInitializationAttempts) {
        const delay = this.initializationAttempts * 300;
        setTimeout(() => {
          this.attemptInitialization();
        }, delay);
      } else {
        console.error('💥 Máximo de intentos alcanzado');
        this.error = 'Error: No se pudieron inicializar los elementos de cámara';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  // ✅ VERIFICACIÓN DE ELEMENTOS
  private areElementsReady(): boolean {
    try {
      console.log('🔍 Verificando elementos del DOM...');
      
      const hasVideoRef = !!this.videoElementRef;
      const hasCanvasRef = !!this.canvasElementRef;
      const hasOverlayRef = !!this.overlayElementRef;
      
      console.log('📊 Referencias ViewChild:', {
        videoRef: hasVideoRef,
        canvasRef: hasCanvasRef,
        overlayRef: hasOverlayRef
      });

      if (!hasVideoRef || !hasCanvasRef || !hasOverlayRef) {
        console.error('❌ Faltan referencias ViewChild');
        return false;
      }
      
      const video = this.videoElementRef.nativeElement;
      const canvas = this.canvasElementRef.nativeElement;
      const overlay = this.overlayElementRef.nativeElement;
      
      const hasElements = !!(video && canvas && overlay);
      
      if (!hasElements) {
        console.error('❌ Faltan elementos DOM');
        return false;
      }
      
      const hasCorrectTypes = 
        video instanceof HTMLVideoElement &&
        canvas instanceof HTMLCanvasElement &&
        overlay instanceof HTMLCanvasElement;
      
      if (!hasCorrectTypes) {
        console.error('❌ Tipos de elementos incorrectos');
        return false;
      }
      
      const result = hasElements && hasCorrectTypes;
      
      console.log('✅ Verificación completada:', {
        hasElements,
        hasCorrectTypes,
        result
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en verificación de elementos:', error);
      return false;
    }
  }

  // 🚀 SECUENCIA DE INICIO COMPLETA CON MEDIAPIPE
  private async startCameraSequence(): Promise<void> {
    try {
      console.log('🚀 === INICIANDO SECUENCIA DE CÁMARA CON MEDIAPIPE ===');
      
      this.error = null;
      this.cdr.detectChanges();
      
      // Verificar elementos
      if (!this.areElementsReady()) {
        console.log('⏳ Elementos no listos, esperando...');
        await this.waitForDOMRender();
        
        if (!this.areElementsReady()) {
          throw new Error('Elementos del DOM no están disponibles después de esperar');
        }
      }
      
      // Inicializar canvas
      await this.initializeCanvas();
      
      // Iniciar MediaPipe y cámara
      console.log('📱 Iniciando MediaPipe y cámara...');
      await this.startCameraWithMediaPipe();
      
      // Finalizar
      this.isLoading = false;
      this.cdr.detectChanges();
      console.log('✅ Secuencia de cámara completada');
      
    } catch (error) {
      console.error('💥 Error en secuencia de cámara:', error);
      this.error = this.getErrorMessage(error);
      this.isLoading = false;
      this.initializationInProgress = false;
      this.cdr.detectChanges();
      throw error;
    }
  }

  private async startCameraWithMediaPipe(): Promise<void> {
    try {
      console.log('📱 === INICIANDO MEDIAPIPE REAL ===');
      
      const video = this.videoElementRef?.nativeElement;
      const canvas = this.canvasElementRef?.nativeElement;
      const overlay = this.overlayElementRef?.nativeElement;
      
      if (!video || !canvas || !overlay) {
        throw new Error('❌ Elementos DOM no disponibles para cámara');
      }
  
      // 🎥 OBTENER STREAM
      console.log('🎥 Solicitando cámara...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
  
      console.log('✅ Stream obtenido:', stream);
  
      // ✅ CONFIGURAR VIDEO VISIBLE
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
  
      // ✅ APLICAR ESTILOS PARA QUE SE VEA
      video.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        z-index: 15 !important;
        display: block !important;
        transform: scaleX(-1) !important;
        background: red !important;
      `;
  
      // ✅ ESPERAR A QUE EL VIDEO CARGUE
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          console.log('✅ Video metadata loaded');
          resolve();
        };
        
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        
        if (video.readyState >= 2) {
          onLoaded();
        }
      });
  
      // ✅ REPRODUCIR VIDEO
      try {
        await video.play();
        console.log('✅ Video playing');
      } catch (e) {
        console.error('❌ Play error:', e);
      }
  
      // 🎨 CONFIGURAR CANVAS
      this.canvasCtx = canvas.getContext('2d')!;
      this.overlayCtx = overlay.getContext('2d')!;
      console.log('✅ Contextos obtenidos');
  
      // 📐 CONFIGURAR DIMENSIONES
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      overlay.width = videoWidth;
      overlay.height = videoHeight;
      console.log('✅ Canvas dimensiones configuradas:', { width: videoWidth, height: videoHeight });
  
      // 🎨 CONFIGURAR ESTILOS DE CANVAS
      this.setupCanvasStyles(canvas, overlay);
  
      // 🚀 INICIAR MEDIAPIPE
      console.log('🎥 Iniciando PoseDetectionEngine...');
      await this.poseEngine.startCamera(video, canvas);
      console.log('✅ PoseDetectionEngine iniciado');
  
      // 🎬 INICIAR RENDER LOOP
      this.startRenderLoop();
  
      // ✅ MARCAR COMO LISTO
      this.isInitialized = true;
      this.isRunning = true;
      this.initializationInProgress = false;
      await this.forceVideoDisplay();
      console.log('🎉 === MEDIAPIPE REAL COMPLETADO ===');
      
    } catch (error) {
      console.error('💥 Error en MediaPipe:', error);
      this.error = `Error: ${this.getErrorMessage(error)}`;
      this.isInitialized = false;
      this.isRunning = false;
      this.initializationInProgress = false;
      this.isLoading = false;
      this.cdr.detectChanges();
      throw error;
    }
  } // ← CIERRA EL MÉTODO startCameraWithMediaPipe AQUÍ
  
  // ✅ MÉTODO SEPARADO (FUERA del método anterior)
  private async forceVideoDisplay(): Promise<void> {
    const video = this.videoElementRef?.nativeElement;
    if (!video) return;
  
    console.log('🔧 Forzando display del video...');
    
    // ✅ CREAR NUEVO STREAM SOLO PARA DISPLAY
    try {
      const displayStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
  
      console.log('✅ Nuevo stream para display creado');
  
      // ✅ CREAR VIDEO ELEMENT SEPARADO PARA DISPLAY
      const displayVideo = document.createElement('video');
      displayVideo.srcObject = displayStream;
      displayVideo.autoplay = true;
      displayVideo.muted = true;
      displayVideo.playsInline = true;
  
      // ✅ APLICAR ESTILOS AL VIDEO DE DISPLAY
      displayVideo.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        z-index: 20 !important;
        display: block !important;
        transform: scaleX(-1) !important;
        background: transparent !important;
      `;
  
      // ✅ AGREGAR AL CONTAINER
      const container = this.videoElementRef.nativeElement.parentElement;
      if (container) {
        container.appendChild(displayVideo);
        console.log('✅ Video de display agregado al DOM');
      }
  
      // ✅ REPRODUCIR VIDEO DE DISPLAY
      await displayVideo.play();
      console.log('✅ Video de display reproduciendo');
  
    } catch (error) {
      console.error('❌ Error creando video de display:', error);
    }
  }
 

  // 🎨 CONFIGURAR ESTILOS DE CANVAS
  private setupCanvasStyles(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement): void {
    const video = this.videoElementRef?.nativeElement;
    
    // Canvas principal (oculto)
    canvas.style.display = 'none';
    
    // VIDEO VISIBLE
    if (video) {
      video.style.display = 'block';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.zIndex = '1';
      video.style.transform = 'scaleX(-1)';
    }
    
    // Overlay encima
    overlay.style.display = 'block';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '10';
    overlay.style.pointerEvents = 'none';
    overlay.style.background = 'transparent';
  }

  // 🎬 RENDER LOOP CON POSES REALES
  private startRenderLoop(): void {
    console.log('🎬 Iniciando render loop con poses reales...');
    
    const renderFrame = () => {
      if (!this.isRunning || !this.overlayCtx) return;
      
      try {
        // Limpiar overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCtx.canvas.width, this.overlayCtx.canvas.height);
        
        // Dibujar pose si está disponible y skeleton habilitado
        if (this.showSkeleton && this.currentPose) {
          this.drawPoseOnOverlay(this.currentPose);
        }

        // Dibujar información adicional
        this.drawOverlay();
        
      } catch (error) {
        console.error('❌ Error en render loop:', error);
      }
      
      requestAnimationFrame(renderFrame);
    };
    
    requestAnimationFrame(renderFrame);
  }

  // 🎨 DIBUJAR POSE EN OVERLAY
  private drawPoseOnOverlay(pose: PoseKeypoints): void {
    if (!window.drawConnectors || !window.drawLandmarks || !window.POSE_CONNECTIONS) {
      // Fallback: dibujar manualmente
      this.drawPoseManually(pose);
      return;
    }

    try {
      const ctx = this.overlayCtx;
      
      // Convertir pose a formato MediaPipe
      const landmarks = this.convertPoseToMediaPipeFormat(pose);
      
      // Dibujar conexiones usando MediaPipe
      window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, {
        color: this.POSE_COLORS.connections,
        lineWidth: 2
      });
      
      // Dibujar landmarks usando MediaPipe
      window.drawLandmarks(ctx, landmarks, {
        color: this.POSE_COLORS.landmarks,
        radius: 4
      });
      
    } catch (error) {
      console.error('❌ Error dibujando con MediaPipe, usando fallback:', error);
      this.drawPoseManually(pose);
    }
  }

  // 🔄 CONVERTIR POSE A FORMATO MEDIAPIPE
  private convertPoseToMediaPipeFormat(pose: PoseKeypoints): any[] {
    const landmarks: any[] = [];
    const width = this.overlayCtx.canvas.width;
    const height = this.overlayCtx.canvas.height;
    
    // Orden específico de MediaPipe Pose
    const orderedLandmarks = [
      pose.nose, pose.left_eye_inner, pose.left_eye, pose.left_eye_outer,
      pose.right_eye_inner, pose.right_eye, pose.right_eye_outer,
      pose.left_ear, pose.right_ear, pose.mouth_left, pose.mouth_right,
      pose.left_shoulder, pose.right_shoulder, pose.left_elbow, pose.right_elbow,
      pose.left_wrist, pose.right_wrist, pose.left_pinky, pose.right_pinky,
      pose.left_index, pose.right_index, pose.left_thumb, pose.right_thumb,
      pose.left_hip, pose.right_hip, pose.left_knee, pose.right_knee,
      pose.left_ankle, pose.right_ankle, pose.left_heel, pose.right_heel,
      pose.left_foot_index, pose.right_foot_index
    ];
    
    orderedLandmarks.forEach(landmark => {
      landmarks.push({
        x: landmark.x * width,
        y: landmark.y * height,
        z: landmark.z,
        visibility: landmark.visibility
      });
    });
    
    return landmarks;
  }

  // 🎨 DIBUJAR POSE MANUALMENTE (FALLBACK)
  private drawPoseManually(pose: PoseKeypoints): void {
    const ctx = this.overlayCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Dibujar conexiones principales
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

    // Dibujar landmarks principales
    this.drawLandmark(pose.nose, width, height);
    this.drawLandmark(pose.left_shoulder, width, height);
    this.drawLandmark(pose.right_shoulder, width, height);
    this.drawLandmark(pose.left_elbow, width, height);
    this.drawLandmark(pose.right_elbow, width, height);
    this.drawLandmark(pose.left_wrist, width, height);
    this.drawLandmark(pose.right_wrist, width, height);
    this.drawLandmark(pose.left_hip, width, height);
    this.drawLandmark(pose.right_hip, width, height);
    this.drawLandmark(pose.left_knee, width, height);
    this.drawLandmark(pose.right_knee, width, height);
    this.drawLandmark(pose.left_ankle, width, height);
    this.drawLandmark(pose.right_ankle, width, height);
  }

  // 🔗 DIBUJAR CONEXIÓN ENTRE DOS PUNTOS
  private drawConnection(start: any, end: any, width: number, height: number): void {
    if (start.visibility > 0.5 && end.visibility > 0.5) {
      const ctx = this.overlayCtx;
      ctx.strokeStyle = this.POSE_COLORS.connections;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  }

  // 📍 DIBUJAR LANDMARK
  private drawLandmark(landmark: any, width: number, height: number): void {
    if (landmark.visibility > 0.5) {
      const ctx = this.overlayCtx;
      ctx.fillStyle = this.POSE_COLORS.landmarks;
      ctx.beginPath();
      ctx.arc(
        landmark.x * width,
        landmark.y * height,
        6,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }

  // ⏳ ESPERAR RENDERIZADO DOM
  private async waitForDOMRender(): Promise<void> {
    return new Promise((resolve) => {
      console.log('⏳ Esperando renderizado DOM...');
      
      const maxAttempts = 10;
      let attempts = 0;
      
      const checkElements = () => {
        attempts++;
        console.log(`🔄 Verificando elementos... Intento ${attempts}/${maxAttempts}`);
        
        const hasRefs = !!(
          this.videoElementRef?.nativeElement && 
          this.canvasElementRef?.nativeElement && 
          this.overlayElementRef?.nativeElement
        );
        
        if (hasRefs) {
          console.log('✅ Elementos DOM están listos');
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkElements, 100);
        } else {
          console.warn('⚠️ Timeout esperando renderizado DOM, continuando...');
          resolve();
        }
      };
      
      setTimeout(checkElements, 50);
    });
  }

  // 🎨 INICIALIZAR CANVAS
  private async initializeCanvas(): Promise<void> {
    try {
      console.log('🎨 Inicializando canvas...');
      
      if (this.isLoading) {
        throw new Error('❌ Aplicación aún cargando');
      }
      
      if (this.error) {
        throw new Error('❌ Error presente: ' + this.error);
      }
      
      if (!this.videoElementRef || !this.canvasElementRef || !this.overlayElementRef) {
        throw new Error('❌ Referencias ViewChild no disponibles');
      }
      
      const canvas = this.canvasElementRef.nativeElement;
      const overlay = this.overlayElementRef.nativeElement;
      const video = this.videoElementRef.nativeElement;

      if (!canvas || !overlay || !video) {
        throw new Error('❌ Elementos canvas no disponibles - DOM no renderizado');
      }

      // Dimensiones con fallback
      let width = 640;
      let height = 480;
      
      if (video.videoWidth && video.videoHeight) {
        width = video.videoWidth;
        height = video.videoHeight;
      } else {
        const rect = video.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          width = rect.width;
          height = rect.height;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      overlay.width = width;
      overlay.height = height;

      console.log('✅ Canvas inicializados:', { width, height });
      
    } catch (error) {
      console.error('❌ Error en initializeCanvas:', error);
      throw error;
    }
  }

  // 🔗 CONFIGURAR SUSCRIPCIONES REACTIVAS
  private setupSubscriptions(): void {
    // Suscribirse a poses detectadas
    this.subscriptions.push(
      this.poseEngine.pose$.subscribe(pose => {
        this.currentPose = pose;
        if (pose) {
          this.poseDetected.emit(pose);
        }
      })
    );

    // Suscribirse a ángulos calculados
    this.subscriptions.push(
      this.poseEngine.angles$.subscribe(angles => {
        this.currentAngles = angles;
        if (angles && this.currentPose) {
          this.analyzeMovement(this.currentPose, angles);
        }
      })
    );

    // Suscribirse a FPS
    this.subscriptions.push(
      this.poseEngine.fps$.subscribe(fps => {
        this.fps = fps;
        this.cdr.detectChanges();
      })
    );

    // Suscribirse a estado del engine
    this.subscriptions.push(
      this.poseEngine.status$.subscribe(status => {
        console.log('📊 Estado del engine:', status);
        this.isLoading = status === 'initializing';
        this.isRunning = status === 'running';
        if (status === 'error') {
          this.error = 'Error en el sistema de detección';
        }
        this.cdr.detectChanges();
      })
    );
  }

  // 🎬 MÉTODO PÚBLICO PARA INICIAR LA CÁMARA
  public async initializeCamera(): Promise<void> {
    console.log('🎬 === initializeCamera LLAMADO DESDE PADRE ===');
    
    if (!this.initializationInProgress && !this.isInitialized) {
      console.log('🔄 Reiniciando proceso de inicialización...');
      this.initializationAttempts = 0;
      this.attemptInitialization();
    } else {
      console.log('⏭️ Ya inicializado o en progreso');
    }
  }

  // 🚀 MÉTODO PÚBLICO PARA INICIAR CÁMARA MANUALMENTE
  public async startCamera(): Promise<void> {
    console.log('🚀 === startCamera LLAMADO MANUALMENTE ===');
    
    if (!this.initializationInProgress && !this.isInitialized) {
      this.initializationAttempts = 0;
      this.attemptInitialization();
    } else {
      console.log('⏭️ Ya inicializado o en progreso');
    }
  }

  // 🛑 DETENER CÁMARA
  async stopCamera(): Promise<void> {
    try {
      await this.poseEngine.stopCamera();
      this.isRunning = false;
      this.cdr.detectChanges();
      this.clearCanvas();
      console.log('🛑 Cámara detenida');
    } catch (error) {
      console.error('❌ Error deteniendo cámara:', error);
    }
  }

  // 🔄 REINICIAR SESIÓN
  resetSession(): void {
    this.repetitionCount = 0;
    this.currentErrors = [];
    this.currentQuality = 0;
    this.biomechanicsAnalyzer.setCurrentExercise(this.exerciseType);
    console.log('🔄 Sesión reiniciada');
  }

  // 🧠 ANALIZAR MOVIMIENTO
  private analyzeMovement(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    if (!this.enableErrorDetection) return;

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

  // 🖼️ DIBUJAR OVERLAY CON INFORMACIÓN
  private drawOverlay(): void {
    if (!this.overlayCtx) return;
    
    this.drawInfoPanel();
    this.drawErrors();
    this.drawPhaseIndicator();
  }

  // 📊 DIBUJAR PANEL DE INFORMACIÓN
  private drawInfoPanel(): void {
    const ctx = this.overlayCtx;
    const padding = 15;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 200, 120);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText(`Repeticiones: ${this.repetitionCount}`, padding, 25);
    ctx.fillText(`Calidad: ${this.currentQuality}%`, padding, 45);
    ctx.fillText(`FPS: ${this.fps}`, padding, 65);
    ctx.fillText(`Fase: ${this.getPhaseText()}`, padding, 85);
    ctx.fillText(`Errores: ${this.currentErrors.length}`, padding, 105);
  }

  // ⚠️ DIBUJAR ERRORES
  private drawErrors(): void {
    if (this.currentErrors.length === 0) return;

    const ctx = this.overlayCtx;
    const startY = 140;
    
    this.currentErrors.forEach((error, index) => {
      const y = startY + (index * 25);
      
      ctx.fillStyle = 'rgba(255, 48, 48, 0.9)';
      ctx.fillRect(0, y - 15, ctx.canvas.width, 20);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(error.description, ctx.canvas.width / 2, y);
    });
  }

  // 🔄 DIBUJAR INDICADOR DE FASE
  private drawPhaseIndicator(): void {
    const ctx = this.overlayCtx;
    const x = ctx.canvas.width - 100;
    const y = 30;
    
    const phaseColor = this.getPhaseColor();
    
    ctx.fillStyle = phaseColor;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.getPhaseText(), x, y + 25);
  }

  // 🎨 OBTENER COLOR DE FASE
  private getPhaseColor(): string {
    switch (this.currentPhase) {
      case RepetitionPhase.TOP: return '#00FF00';
      case RepetitionPhase.ECCENTRIC: return '#FF9900';
      case RepetitionPhase.BOTTOM: return '#FF0000';
      case RepetitionPhase.CONCENTRIC: return '#0099FF';
      default: return '#888888';
    }
  }

  // 📝 OBTENER TEXTO DE FASE
  private getPhaseText(): string {
    const phaseMap = {
      [RepetitionPhase.IDLE]: 'Inactivo',
      [RepetitionPhase.TOP]: 'Arriba',
      [RepetitionPhase.ECCENTRIC]: 'Bajando',
      [RepetitionPhase.BOTTOM]: 'Abajo',
      [RepetitionPhase.CONCENTRIC]: 'Subiendo'
    };
    return phaseMap[this.currentPhase] || 'Desconocido';
  }

  // 🧹 LIMPIAR CANVAS
  private clearCanvas(): void {
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlayCtx.canvas.width, this.overlayCtx.canvas.height);
    }
  }

  // 🧹 LIMPIEZA GENERAL
  private cleanup(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopCamera();
  }

  // 🎯 MÉTODOS PÚBLICOS PARA EL TEMPLATE

  getExerciseName(): string {
    const exerciseNames = {
      [ExerciseType.SQUATS]: 'Sentadillas',
      [ExerciseType.PUSHUPS]: 'Flexiones',
      [ExerciseType.LUNGES]: 'Estocadas',
      [ExerciseType.PLANK]: 'Plancha',
      [ExerciseType.BICEP_CURLS]: 'Curl de Bíceps',
      [ExerciseType.DEADLIFT]: 'Peso Muerto',
      [ExerciseType.BENCH_PRESS]: 'Press de Banca',
      [ExerciseType.SHOULDER_PRESS]: 'Press de Hombros'
    };
    return exerciseNames[this.exerciseType] || 'Ejercicio';
  }

  toggleSkeleton(): void {
    this.showSkeleton = !this.showSkeleton;
    console.log(`🎨 Esqueleto: ${this.showSkeleton ? 'ON' : 'OFF'}`);
  }

  toggleAngles(): void {
    this.showAngles = !this.showAngles;
    console.log(`📐 Ángulos: ${this.showAngles ? 'ON' : 'OFF'}`);
  }

  getQualityClass(): string {
    if (this.currentQuality >= 80) return 'quality-excellent';
    if (this.currentQuality >= 60) return 'quality-good';
    if (this.currentQuality >= 40) return 'quality-fair';
    return 'quality-poor';
  }

  getCurrentCoachingTip(): string {
    const tips: { [key in ExerciseType]?: string[] } = {
      [ExerciseType.SQUATS]: [
        'Mantén el pecho erguido y la mirada al frente',
        'Baja como si te fueras a sentar en una silla',
        'Los talones siempre en el suelo',
        'Las rodillas deben seguir la dirección de los pies'
      ],
      [ExerciseType.PUSHUPS]: [
        'Forma una línea recta desde cabeza hasta talones',
        'Los codos a 45° del cuerpo, no muy abiertos',
        'Baja hasta que el pecho casi toque el suelo',
        'Mantén el core contraído durante todo el movimiento'
      ],
      [ExerciseType.PLANK]: [
        'Mantén una línea recta desde cabeza hasta talones',
        'Contrae el core como si fueras a recibir un golpe',
        'Respira normalmente, no contengas la respiración',
        'Los codos directamente bajo los hombros'
      ]
    };

    const exerciseTips = tips[this.exerciseType] || ['¡Sigue así!'];
    const randomIndex = Math.floor(Math.random() * exerciseTips.length);
    return exerciseTips[randomIndex];
  }

  trackByErrorType(index: number, error: PostureError): string {
    return error.type;
  }
}