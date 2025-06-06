// src/app/features/training/components/pose-camera/pose-camera.component.ts
// ✅ VERSIÓN CORREGIDA - SIN ERRORES DE REFERENCIAS

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
    
    // Inicializar con delay mayor
    setTimeout(() => {
      this.attemptInitialization();
    }, 1000); // Aumentar a 1 segundo para móviles
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
        const delay = this.initializationAttempts * 300; // 300ms, 600ms, 900ms...
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

  // ✅ VERIFICACIÓN DE ELEMENTOS - REFERENCIAS CORREGIDAS
  private areElementsReady(): boolean {
    try {
      console.log('🔍 Verificando elementos del DOM...');
      
      // Verificar que las referencias ViewChild existen
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
      
      // Verificar que los elementos DOM existen
      const video = this.videoElementRef.nativeElement;
      const canvas = this.canvasElementRef.nativeElement;
      const overlay = this.overlayElementRef.nativeElement;
      
      console.log('📊 Elementos DOM:', {
        video: !!video,
        canvas: !!canvas,
        overlay: !!overlay,
        videoType: video?.constructor.name,
        canvasType: canvas?.constructor.name,
        overlayType: overlay?.constructor.name
      });
      
      const hasElements = !!(video && canvas && overlay);
      
      if (!hasElements) {
        console.error('❌ Faltan elementos DOM');
        return false;
      }
      
      // Verificar tipos correctos
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

  // 🚀 SECUENCIA DE INICIO
// 🚀 SECUENCIA DE INICIO
private async startCameraSequence(): Promise<void> {
  try {
    console.log('🚀 === INICIANDO SECUENCIA DE CÁMARA ===');
    
    // ✅ 1. LIMPIAR ESTADOS
    this.error = null;
    // NO cambiar isLoading aquí todavía
    this.cdr.detectChanges();
    
    // ✅ 2. VERIFICAR ELEMENTOS INMEDIATAMENTE (sin waitForDOMRender)
    if (!this.areElementsReady()) {
      console.log('⏳ Elementos no listos, esperando...');
      await this.waitForDOMRender();
      
      // Verificar de nuevo después de esperar
      if (!this.areElementsReady()) {
        throw new Error('Elementos del DOM no están disponibles después de esperar');
      }
    }
    
    // ✅ 3. INICIALIZAR CANVAS
    await this.initializeCanvas();
    
    // ✅ 4. INICIAR STREAM DE CÁMARA
    console.log('📱 Iniciando stream de cámara...');
    await this.startCameraStream();
    
    // ✅ 5. FINALIZAR - AHORA SÍ CAMBIAR isLoading
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

// 🎯 PASO A PASO: AGREGAR POSES SIN ROMPER EL VIDEO
// REEMPLAZA startCameraStream() con esta versión que agrega SOLO contextos:

// 🎯 MICRO-PASO 2: MOSTRAR OVERLAY TRANSPARENTE
// REEMPLAZA startCameraStream() con esta versión:

private async startCameraStream(): Promise<void> {
  try {
    console.log('📱 === MICRO-PASO 2: OVERLAY TRANSPARENTE ===');
    
    const video = this.videoElementRef?.nativeElement;
    const canvas = this.canvasElementRef?.nativeElement;
    const overlay = this.overlayElementRef?.nativeElement;
    
    if (!video || !canvas || !overlay) {
      throw new Error('❌ Elementos DOM no disponibles para cámara');
    }

    // ✅ AGREGAR CONTEXTOS (del paso anterior)
    this.canvasCtx = canvas.getContext('2d')!;
    this.overlayCtx = overlay.getContext('2d')!;
    console.log('✅ Contextos obtenidos');

    // 🎥 OBTENER STREAM (igual que funcionó)
    console.log('🎥 Solicitando cámara...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640, min: 480 },
        height: { ideal: 480, min: 320 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });
    
    console.log('✅ Stream obtenido');

    // ✅ CONFIGURAR SOLO EL VIDEO (igual que funcionó)
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    
    // 🎯 MANTENER CANVAS OCULTO, PERO MOSTRAR OVERLAY TRANSPARENTE
    canvas.style.display = 'none'; // ← Canvas sigue oculto
    
    // 🆕 NUEVO: MOSTRAR OVERLAY PERO TRANSPARENTE
    overlay.style.display = 'block';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '10'; // Encima del video
    overlay.style.pointerEvents = 'none';
    overlay.style.background = 'transparent';
    console.log('🆕 Overlay mostrado (transparente)');
    
    // ✅ CONFIGURAR VIDEO PARA QUE SE VEA (igual que funcionó)
    video.style.display = 'block';
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.transform = 'scaleX(-1)';
    video.style.zIndex = '1'; // Debajo del overlay
    video.style.backgroundColor = 'transparent';
    
    // ✅ ESPERAR METADATA (igual que funcionó)
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      
      const onReady = () => {
        if (resolved) return;
        resolved = true;
        
        console.log('✅ Video listo:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        });
        
        resolve();
      };
      
      const onError = (error: any) => {
        if (resolved) return;
        resolved = true;
        console.error('❌ Error:', error);
        reject(error);
      };
      
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
      
      if (video.readyState >= 2) {
        onReady();
      }
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('⏰ Timeout, continuando...');
          resolve();
        }
      }, 3000);
    });

    // ✅ REPRODUCIR (igual que funcionó)
    try {
      await video.play();
      console.log('✅ Video reproduciendo');
    } catch (playError) {
      console.error('❌ Error play:', playError);
    }

    // ✅ CONFIGURAR CANVAS DIMENSIONES (del paso anterior)
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    overlay.width = videoWidth;
    overlay.height = videoHeight;
    console.log('✅ Canvas dimensiones configuradas:', { width: videoWidth, height: videoHeight });

    // 🆕 NUEVO: INICIAR RENDER LOOP BÁSICO (solo limpiar overlay)
  

    // ✅ SIMULAR POSES BÁSICAS (del paso anterior)
    this.simulateBasicPoses();

    // 🚫 NO INICIALIZAR ENGINE (igual que funcionó)
    console.log('⏸️ Engine deshabilitado');

    // ✅ MARCAR COMO LISTO (igual que funcionó)
    this.isInitialized = true;
    this.isRunning = true;
    this.initializationInProgress = false;
    
    // 📊 SIMULAR FPS (igual que funcionó)
    this.startFpsSimulation();
    
    console.log('🎉 === MICRO-PASO 2 COMPLETADO: OVERLAY TRANSPARENTE ===');
    
  } catch (error) {
    console.error('💥 Error:', error);
    this.error = `Error: ${this.getErrorMessage(error)}`;
    this.isInitialized = false;
    this.isRunning = false;
    this.initializationInProgress = false;
    this.isLoading = false;
    this.cdr.detectChanges();
    throw error;
  }
}

// 🎯 MICRO-PASO 4: AGREGAR PUNTOS CLAVE PRINCIPALES
// REEMPLAZA startTransparentRenderLoop() con esta versión:

// 🎯 MICRO-PASO 3: DIBUJAR UN PUNTO SIMPLE
// REEMPLAZA startTransparentRenderLoop() con esta versión:

private startTransparentRenderLoop(overlay: HTMLCanvasElement): void {
  console.log('🎨 Iniciando render loop con punto simple...');
  
  const renderFrame = () => {
    if (!this.isRunning || !this.overlayCtx) return;
    
    try {
      // 🧹 LIMPIAR OVERLAY
      this.overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      
      // 🆕 NUEVO: DIBUJAR UN PUNTO SIMPLE SI SKELETON HABILITADO
      if (this.showSkeleton && this.currentPose) {
        console.log('🔴 Dibujando punto simple...');
        
        // Dibujar solo un punto rojo en el centro de la nariz
        const nose = this.currentPose.nose;
        if (nose && nose.visibility > 0.5) {
          this.overlayCtx.fillStyle = '#FF0000'; // Rojo brillante
          this.overlayCtx.beginPath();
          this.overlayCtx.arc(
            nose.x * overlay.width,  // Posición X
            nose.y * overlay.height, // Posición Y
            10, // Radio del punto
            0, 2 * Math.PI
          );
          this.overlayCtx.fill();
          console.log('🔴 Punto dibujado en nariz:', { x: nose.x * overlay.width, y: nose.y * overlay.height });
        }
      }
      
    } catch (error) {
      console.error('❌ Error en render con punto:', error);
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

// 🆕 TAMBIÉN AGREGAR ESTE MÉTODO PARA TOGGLE DEL SKELETON:





// 📊 MÉTODO PARA SIMULAR FPS (igual que funcionó):
private startFpsSimulation(): void {
  let frameCount = 0;
  let lastTime = performance.now();
  
  const updateFps = () => {
    if (!this.isRunning) return;
    
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime >= 1000) {
      this.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      frameCount = 0;
      lastTime = currentTime;
      this.cdr.detectChanges();
    }
    
    requestAnimationFrame(updateFps);
  };
  
  requestAnimationFrame(updateFps);
}

// ✅ SIMULAR POSES BÁSICAS (del paso anterior):
private simulateBasicPoses(): void {
  console.log('🤖 Iniciando simulación de poses...');
  
  setInterval(() => {
    if (!this.isRunning) return;
    
    const mockPose: PoseKeypoints = {
      nose: { x: 0.5, y: 0.3, z: 0, visibility: 0.9 },
      left_eye_inner: { x: 0.48, y: 0.28, z: 0, visibility: 0.8 },
      left_eye: { x: 0.47, y: 0.29, z: 0, visibility: 0.8 },
      left_eye_outer: { x: 0.46, y: 0.30, z: 0, visibility: 0.8 },
      right_eye_inner: { x: 0.52, y: 0.28, z: 0, visibility: 0.8 },
      right_eye: { x: 0.53, y: 0.29, z: 0, visibility: 0.8 },
      right_eye_outer: { x: 0.54, y: 0.30, z: 0, visibility: 0.8 },
      left_ear: { x: 0.45, y: 0.32, z: 0, visibility: 0.7 },
      right_ear: { x: 0.55, y: 0.32, z: 0, visibility: 0.7 },
      mouth_left: { x: 0.48, y: 0.35, z: 0, visibility: 0.8 },
      mouth_right: { x: 0.52, y: 0.35, z: 0, visibility: 0.8 },
      left_shoulder: { x: 0.4, y: 0.4, z: 0, visibility: 0.8 },
      right_shoulder: { x: 0.6, y: 0.4, z: 0, visibility: 0.8 },
      left_elbow: { x: 0.35, y: 0.5, z: 0, visibility: 0.7 },
      right_elbow: { x: 0.65, y: 0.5, z: 0, visibility: 0.7 },
      left_wrist: { x: 0.3, y: 0.6, z: 0, visibility: 0.6 },
      right_wrist: { x: 0.7, y: 0.6, z: 0, visibility: 0.6 },
      left_pinky: { x: 0.28, y: 0.62, z: 0, visibility: 0.5 },
      right_pinky: { x: 0.72, y: 0.62, z: 0, visibility: 0.5 },
      left_index: { x: 0.29, y: 0.61, z: 0, visibility: 0.5 },
      right_index: { x: 0.71, y: 0.61, z: 0, visibility: 0.5 },
      left_thumb: { x: 0.31, y: 0.59, z: 0, visibility: 0.5 },
      right_thumb: { x: 0.69, y: 0.59, z: 0, visibility: 0.5 },
      left_hip: { x: 0.4, y: 0.6, z: 0, visibility: 0.7 },
      right_hip: { x: 0.6, y: 0.6, z: 0, visibility: 0.7 },
      left_knee: { x: 0.4, y: 0.8, z: 0, visibility: 0.6 },
      right_knee: { x: 0.6, y: 0.8, z: 0, visibility: 0.6 },
      left_ankle: { x: 0.4, y: 0.95, z: 0, visibility: 0.5 },
      right_ankle: { x: 0.6, y: 0.95, z: 0, visibility: 0.5 },
      left_heel: { x: 0.39, y: 0.96, z: 0, visibility: 0.5 },
      right_heel: { x: 0.61, y: 0.96, z: 0, visibility: 0.5 },
      left_foot_index: { x: 0.41, y: 0.97, z: 0, visibility: 0.5 },
      right_foot_index: { x: 0.59, y: 0.97, z: 0, visibility: 0.5 }
    };

    this.currentPose = mockPose;
    console.log('🤖 Pose simulada actualizada');
    
  }, 1000);
}

// 📊 AGREGAR ESTE MÉTODO PARA SIMULAR FPS:


  // ⏳ ESPERAR A QUE EL POSE ENGINE ESTÉ LISTO
  private async waitForDOMRender(): Promise<void> {
    return new Promise((resolve) => {
      console.log('⏳ Esperando renderizado DOM...');
      
      // ❌ NO CAMBIAR isLoading AQUÍ - Causa problemas con *ngIf
      // this.isLoading = false; // ELIMINAR ESTA LÍNEA
      
      // ✅ Simplemente esperar a que los elementos estén disponibles
      const maxAttempts = 10;
      let attempts = 0;
      
      const checkElements = () => {
        attempts++;
        console.log(`🔄 Verificando elementos... Intento ${attempts}/${maxAttempts}`);
        
        // Verificar que las referencias ViewChild existen
        const hasRefs = !!(
          this.videoElementRef?.nativeElement && 
          this.canvasElementRef?.nativeElement && 
          this.overlayElementRef?.nativeElement
        );
        
        console.log('📊 Estado de elementos:', {
          videoRef: !!this.videoElementRef,
          canvasRef: !!this.canvasElementRef,
          overlayRef: !!this.overlayElementRef,
          videoElement: !!this.videoElementRef?.nativeElement,
          canvasElement: !!this.canvasElementRef?.nativeElement,
          overlayElement: !!this.overlayElementRef?.nativeElement,
          hasRefs
        });
        
        if (hasRefs) {
          console.log('✅ Elementos DOM están listos');
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkElements, 100);
        } else {
          console.warn('⚠️ Timeout esperando renderizado DOM, continuando...');
          resolve(); // Continuar aunque no esté listo
        }
      };
      
      // Empezar verificación después de un pequeño delay
      setTimeout(checkElements, 50);
    });
  }
  // 🎨 INICIALIZAR CANVAS - REFERENCIAS CORREGIDAS
  private async initializeCanvas(): Promise<void> {
    try {
      console.log('🎨 Inicializando canvas...');
      
      // ✅ VERIFICAR ESTADOS PRIMERO
      if (this.isLoading) {
        throw new Error('❌ Aplicación aún cargando');
      }
      
      if (this.error) {
        throw new Error('❌ Error presente: ' + this.error);
      }
      
      // ✅ VERIFICAR REFERENCIAS
      if (!this.videoElementRef || !this.canvasElementRef || !this.overlayElementRef) {
        throw new Error('❌ Referencias ViewChild no disponibles');
      }
      
      const canvas = this.canvasElementRef.nativeElement;
      const overlay = this.overlayElementRef.nativeElement;
      const video = this.videoElementRef.nativeElement;
  
      console.log('📊 Verificando elementos:', {
        canvas: !!canvas,
        overlay: !!overlay,
        video: !!video,
        isLoading: this.isLoading,
        error: this.error
      });
  
      if (!canvas || !overlay || !video) {
        throw new Error('❌ Elementos canvas no disponibles - DOM no renderizado');
      }
  
      // ✅ OBTENER DIMENSIONES CON FALLBACK
      let width = 640;
      let height = 480;
      
      // Intentar obtener dimensiones reales del video
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
      
      // Canvas principal
      canvas.width = width;
      canvas.height = height;
      
      // Canvas overlay
      overlay.width = width;
      overlay.height = height;
  
      console.log('✅ Canvas inicializados:', { width, height });
      
    } catch (error) {
      console.error('❌ Error en initializeCanvas:', error);
      throw error;
    }
  }

  // 📏 REDIMENSIONAR CANVAS - REFERENCIAS CORREGIDAS
  private resizeCanvas(): void {
    try {
      // ✅ USAR LAS REFERENCIAS CORRECTAS
      const video = this.videoElementRef?.nativeElement;
      const canvas = this.canvasElementRef?.nativeElement;
      const overlay = this.overlayElementRef?.nativeElement;  
      
      if (!canvas || !overlay) {
        console.warn('⚠️ Canvas elements no disponibles para resize');
        return;
      }

      // Dimensiones estándar para cámara
      const canvasWidth = 640;
      const canvasHeight = 480;

      console.log('📏 Aplicando dimensiones:', { canvasWidth, canvasHeight });

      // Aplicar dimensiones a ambos canvas
      [canvas, overlay].forEach(element => {
        element.width = canvasWidth;
        element.height = canvasHeight;
        element.style.width = `${canvasWidth}px`;
        element.style.height = `${canvasHeight}px`;
      });

      // Configurar video también
      if (video) {
        video.width = canvasWidth;
        video.height = canvasHeight;
      }
      
    } catch (error) {
      console.error('❌ Error en resizeCanvas:', error);
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
          this.drawPose(pose);
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
  // 🚀 SECUENCIA DE INICIO


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
// REEMPLAZAR el método analyzeMovement con este:

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

  this.drawOverlay();
}

  // 🎨 DIBUJAR POSE EN CANVAS
  private drawPose(pose: PoseKeypoints): void {
    if (!this.showSkeleton || !this.overlayCtx) return;

    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawConnections(pose);
    this.drawLandmarks(pose);
    
    if (this.showAngles && this.currentAngles) {
      this.drawAngles(pose, this.currentAngles);
    }
  }

  // 🔗 DIBUJAR CONEXIONES DEL ESQUELETO
  private drawConnections(pose: PoseKeypoints): void {
    const ctx = this.overlayCtx;
    ctx.strokeStyle = this.POSE_COLORS.connections;
    ctx.lineWidth = 3;

    const connections = [
      [pose.left_shoulder, pose.right_shoulder],
      [pose.left_shoulder, pose.left_hip],
      [pose.right_shoulder, pose.right_hip],
      [pose.left_hip, pose.right_hip],
      [pose.left_shoulder, pose.left_elbow],
      [pose.left_elbow, pose.left_wrist],
      [pose.right_shoulder, pose.right_elbow],
      [pose.right_elbow, pose.right_wrist],
      [pose.left_hip, pose.left_knee],
      [pose.left_knee, pose.left_ankle],
      [pose.right_hip, pose.right_knee],
      [pose.right_knee, pose.right_ankle]
    ];

    connections.forEach(([start, end]) => {
      if (start.visibility > 0.5 && end.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
        ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
        ctx.stroke();
      }
    });
  }

  // 📍 DIBUJAR LANDMARKS
  private drawLandmarks(pose: PoseKeypoints): void {
    const ctx = this.overlayCtx;
    
    Object.values(pose).forEach(landmark => {
      if (landmark.visibility > 0.5) {
        ctx.fillStyle = this.POSE_COLORS.landmarks;
        ctx.beginPath();
        ctx.arc(
          landmark.x * ctx.canvas.width,
          landmark.y * ctx.canvas.height,
          6,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    });
  }

  // 📐 DIBUJAR ÁNGULOS
  private drawAngles(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    const ctx = this.overlayCtx;
    ctx.fillStyle = this.POSE_COLORS.angles;
    ctx.font = '14px Arial';

    if (this.exerciseType === ExerciseType.SQUATS) {
      this.drawAngleText(pose.left_knee, `${Math.round(angles.left_knee_angle || 0)}°`);
      this.drawAngleText(pose.right_knee, `${Math.round(angles.right_knee_angle || 0)}°`);
    } else if (this.exerciseType === ExerciseType.PUSHUPS) {
      this.drawAngleText(pose.left_elbow, `${Math.round(angles.left_elbow_angle || 0)}°`);
      this.drawAngleText(pose.right_elbow, `${Math.round(angles.right_elbow_angle || 0)}°`);
    }
  }

  // 📝 DIBUJAR TEXTO DE ÁNGULO
  private drawAngleText(landmark: any, text: string): void {
    if (landmark.visibility > 0.5) {
      const ctx = this.overlayCtx;
      const x = landmark.x * ctx.canvas.width;
      const y = landmark.y * ctx.canvas.height - 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x - 15, y - 15, 30, 20);
      
      ctx.fillStyle = this.POSE_COLORS.angles;
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y);
    }
  }

  // 🖼️ DIBUJAR OVERLAY CON INFORMACIÓN
  private drawOverlay(): void {
    if (!this.overlayCtx) return;
    const canvas = this.canvasElementRef?.nativeElement;
    const overlay = this.overlayElementRef?.nativeElement;
    const video = this.videoElementRef?.nativeElement;
    
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
    window.removeEventListener('resize', () => this.resizeCanvas());
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
  // 🎨 MÉTODOS PÚBLICOS PARA EL TEMPLATE - AGREGAR ESTOS



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