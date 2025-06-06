// src/app/core/pose-engine/pose-detection.engine.ts
// ✅ VERSIÓN COMPLETA DEL ENGINE CON MEDIAPIPE REAL

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PoseKeypoints, PoseLandmark, BiomechanicalAngles, ExerciseType } from '../../shared/models/pose.models';

// Declaraciones globales para MediaPipe
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
    POSE_LANDMARKS: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class PoseDetectionEngine {
  private pose: any = null;
  private camera: any = null;
  private isInitialized = false;
  private isRunning = false;

  // Streams reactivos para la aplicación
  private poseStream = new BehaviorSubject<PoseKeypoints | null>(null);
  private anglesStream = new BehaviorSubject<BiomechanicalAngles | null>(null);
  private fpsStream = new BehaviorSubject<number>(0);
  private statusStream = new BehaviorSubject<'initializing' | 'ready' | 'running' | 'error' | 'loading'>('loading');

  // Métricas de rendimiento
  private frameCount = 0;
  private lastFpsUpdate = Date.now();
  private processingTimes: number[] = [];

  // Control de carga de MediaPipe
  private mediaPipeLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  // Configuración avanzada
  private readonly config = {
    modelComplexity: 1,
    enableSegmentation: false,
    smoothLandmarks: true,
    smoothSegmentation: false,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
    selfieMode: true
  };

  constructor() {
    this.ensureMediaPipeLoaded();
  }

  // 🚀 GETTERS PARA STREAMS REACTIVOS
  get pose$(): Observable<PoseKeypoints | null> {
    return this.poseStream.asObservable();
  }

  get angles$(): Observable<BiomechanicalAngles | null> {
    return this.anglesStream.asObservable();
  }

  get fps$(): Observable<number> {
    return this.fpsStream.asObservable();
  }

  get status$(): Observable<string> {
    return this.statusStream.asObservable();
  }

  // 📦 CARGAR MEDIAPIPE DINÁMICAMENTE
  private async ensureMediaPipeLoaded(): Promise<void> {
    if (this.mediaPipeLoaded) return;
    
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadMediaPipeScripts();
    return this.loadingPromise;
  }

  private async loadMediaPipeScripts(): Promise<void> {
    try {
      console.log('📦 Verificando MediaPipe scripts...');
      this.statusStream.next('loading');

      // Verificar si MediaPipe ya está disponible
      if (window.Pose && window.Camera) {
        console.log('✅ MediaPipe ya está disponible');
        this.mediaPipeLoaded = true;
        await this.initializePose();
        return;
      }

      // Si no está disponible, los scripts deberían cargarse desde index.html
      console.log('⏳ Esperando que MediaPipe se cargue...');
      
      // Esperar a que los scripts se carguen
      await this.waitForMediaPipe();
      
      console.log('✅ MediaPipe detectado, inicializando...');
      this.mediaPipeLoaded = true;
      await this.initializePose();

    } catch (error) {
      console.error('❌ Error cargando MediaPipe:', error);
      this.statusStream.next('error');
      throw error;
    }
  }

  private waitForMediaPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30; // 3 segundos máximo
      
      const checkMediaPipe = () => {
        attempts++;
        
        if (window.Pose && window.Camera) {
          console.log('✅ MediaPipe encontrado en intento', attempts);
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('❌ MediaPipe no se cargó después de', maxAttempts, 'intentos');
          reject(new Error('MediaPipe no disponible'));
        } else {
          console.log('⏳ Esperando MediaPipe... intento', attempts);
          setTimeout(checkMediaPipe, 100);
        }
      };
      
      checkMediaPipe();
    });
  }

  // 🔧 INICIALIZACIÓN DEL MOTOR MEDIAPIPE
  private async initializePose(): Promise<void> {
    try {
      console.log('🧠 Iniciando MediaPipe Pose Engine...');
      this.statusStream.next('initializing');

      // Verificar que MediaPipe esté disponible
      if (!window.Pose) {
        throw new Error('MediaPipe Pose no está disponible');
      }

      // Crear instancia de Pose
      this.pose = new window.Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      console.log('⚙️ Configurando MediaPipe...');
      await this.pose.setOptions(this.config);

      console.log('🎯 Configurando callback de resultados...');
      this.pose.onResults((results: any) => {
        this.processPoseResults(results);
      });

      this.isInitialized = true;
      this.statusStream.next('ready');
      console.log('✅ MediaPipe Pose Engine inicializado correctamente');

    } catch (error) {
      console.error('❌ Error inicializando MediaPipe:', error);
      this.statusStream.next('error');
      throw error;
    }
  }

  // 📹 INICIAR CÁMARA Y DETECCIÓN - VERSIÓN COMPLETA
  async startCamera(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      console.log('📹 Iniciando cámara con MediaPipe...');
      this.statusStream.next('initializing');

      // Esperar a que MediaPipe esté listo
      await this.ensureMediaPipeLoaded();

      if (!this.isInitialized) {
        throw new Error('MediaPipe no está inicializado');
      }

      // ✅ OBTENER STREAM DE CÁMARA
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 480, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15, max: 60 }
        }
      });

      console.log('✅ Stream obtenido:', {
        tracks: stream.getVideoTracks().length,
        settings: stream.getVideoTracks()[0]?.getSettings()
      });

      // ✅ CONFIGURAR VIDEO
      videoElement.srcObject = stream;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.autoplay = true;

      // ✅ ESPERAR A QUE EL VIDEO ESTÉ LISTO
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout cargando video'));
        }, 10000);

        const onLoadedMetadata = () => {
          clearTimeout(timeoutId);
          console.log('✅ Video metadata cargada:', {
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight,
            readyState: videoElement.readyState
          });
          resolve();
        };

        const onError = (error: any) => {
          clearTimeout(timeoutId);
          console.error('❌ Error cargando video:', error);
          reject(error);
        };

        videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        videoElement.addEventListener('error', onError, { once: true });
        
        if (videoElement.readyState >= 2) {
          onLoadedMetadata();
        }
      });

      // ✅ REPRODUCIR VIDEO
      try {
        await videoElement.play();
        console.log('✅ Video reproduciendo');
      } catch (playError) {
        console.error('❌ Error reproduciendo:', playError);
      }

      // ✅ CONFIGURAR CANVAS
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;

      console.log('✅ Canvas configurado:', {
        width: canvasElement.width,
        height: canvasElement.height
      });

      // 🚀 INICIALIZAR CAMERA DE MEDIAPIPE
      if (window.Camera) {
        this.camera = new window.Camera(videoElement, {
          onFrame: async () => {
            if (this.pose && this.isRunning) {
              await this.pose.send({ image: videoElement });
            }
          },
          width: canvasElement.width,
          height: canvasElement.height
        });

        // ✅ INICIAR CÁMARA DE MEDIAPIPE
        await this.camera.start();
        console.log('✅ Camera de MediaPipe iniciada');
      } else {
        // Fallback: usar requestAnimationFrame si Camera no está disponible
        this.startManualProcessing(videoElement);
      }

      // ✅ MARCAR COMO CORRIENDO
      this.isRunning = true;
      this.statusStream.next('running');
      this.startFpsTracking();

      console.log('🎉 Cámara y MediaPipe iniciados exitosamente');

    } catch (error) {
      console.error('❌ Error iniciando cámara:', error);
      this.statusStream.next('error');
      throw error;
    }
  }

  // 🔄 PROCESAMIENTO MANUAL COMO FALLBACK
  private startManualProcessing(videoElement: HTMLVideoElement): void {
    console.log('🔄 Iniciando procesamiento manual...');
    
    const processFrame = async () => {
      if (this.isRunning && this.pose && videoElement.readyState >= 2) {
        try {
          await this.pose.send({ image: videoElement });
        } catch (error) {
          console.error('❌ Error en procesamiento manual:', error);
        }
      }
      
      if (this.isRunning) {
        requestAnimationFrame(processFrame);
      }
    };
    
    requestAnimationFrame(processFrame);
  }

  // 🛑 DETENER CÁMARA Y DETECCIÓN
  async stopCamera(): Promise<void> {
    try {
      if (this.camera) {
        this.camera.stop();
        this.camera = null;
      }
      
      this.isRunning = false;
      this.statusStream.next('ready');
      console.log('🛑 Cámara detenida');

    } catch (error) {
      console.error('❌ Error deteniendo cámara:', error);
    }
  }

  // 🧠 PROCESAMIENTO PRINCIPAL DE RESULTADOS - VERSIÓN COMPLETA
  private processPoseResults(results: any): void {
    const startTime = performance.now();
  
    // ✅ VERIFICAR SI HAY POSES VÁLIDAS
    if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
      console.log('⚠️ No se detectaron poses');
      this.poseStream.next(null);
      this.anglesStream.next(null);
      return;
    }
  
    try {
      console.log('🎯 Pose detectada con', results.poseLandmarks.length, 'landmarks');
      
      // Convertir landmarks de MediaPipe a nuestro formato
      const poseKeypoints = this.convertToKeypoints(results.poseLandmarks);
      
      // Calcular ángulos biomecánicos
      const angles = this.calculateBiomechanicalAngles(poseKeypoints);
      
      // ✅ SOLO EMITIR SI LAS POSES SON VÁLIDAS
      if (this.isPoseValid(poseKeypoints)) {
        this.poseStream.next(poseKeypoints);
        this.anglesStream.next(angles);
        console.log('✅ Pose válida emitida');
      } else {
        console.log('⚠️ Pose inválida, no emitiendo');
        this.poseStream.next(null);
        this.anglesStream.next(null);
      }
  
      // Actualizar métricas de rendimiento
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);
  
    } catch (error) {
      console.error('❌ Error procesando pose:', error);
    }
  }
  
  // ✅ AGREGAR ESTE MÉTODO NUEVO
  private isPoseValid(pose: PoseKeypoints): boolean {
    // Verificar que los landmarks principales tengan buena visibilidad
    const keyLandmarks = [
      pose.left_shoulder, pose.right_shoulder,
      pose.left_hip, pose.right_hip,
      pose.left_knee, pose.right_knee
    ];
    
    const validLandmarks = keyLandmarks.filter(landmark => landmark.visibility > 0.5);
    return validLandmarks.length >= 4; // Al menos 4 de 6 landmarks clave
  }

  // 🔄 CONVERSIÓN DE LANDMARKS MEDIAPIPE A NUESTRO FORMATO
  private convertToKeypoints(landmarks: any[]): PoseKeypoints {
    const createLandmark = (index: number): PoseLandmark => ({
      x: landmarks[index]?.x || 0,
      y: landmarks[index]?.y || 0,
      z: landmarks[index]?.z || 0,
      visibility: landmarks[index]?.visibility || 0
    });

    return {
      // Cara y cabeza (0-10)
      nose: createLandmark(0),
      left_eye_inner: createLandmark(1),
      left_eye: createLandmark(2),
      left_eye_outer: createLandmark(3),
      right_eye_inner: createLandmark(4),
      right_eye: createLandmark(5),
      right_eye_outer: createLandmark(6),
      left_ear: createLandmark(7),
      right_ear: createLandmark(8),
      mouth_left: createLandmark(9),
      mouth_right: createLandmark(10),

      // Torso superior (11-16)
      left_shoulder: createLandmark(11),
      right_shoulder: createLandmark(12),
      left_elbow: createLandmark(13),
      right_elbow: createLandmark(14),
      left_wrist: createLandmark(15),
      right_wrist: createLandmark(16),

      // Manos (17-22)
      left_pinky: createLandmark(17),
      right_pinky: createLandmark(18),
      left_index: createLandmark(19),
      right_index: createLandmark(20),
      left_thumb: createLandmark(21),
      right_thumb: createLandmark(22),

      // Torso y cadera (23-24)
      left_hip: createLandmark(23),
      right_hip: createLandmark(24),

      // Piernas (25-32)
      left_knee: createLandmark(25),
      right_knee: createLandmark(26),
      left_ankle: createLandmark(27),
      right_ankle: createLandmark(28),
      left_heel: createLandmark(29),
      right_heel: createLandmark(30),
      left_foot_index: createLandmark(31),
      right_foot_index: createLandmark(32)
    };
  }

  // 📐 CÁLCULO DE ÁNGULOS BIOMECÁNICOS - IMPLEMENTACIÓN COMPLETA
  private calculateBiomechanicalAngles(pose: PoseKeypoints): BiomechanicalAngles {
    return {
      left_shoulder_angle: this.calculateAngle(
        pose.left_elbow, pose.left_shoulder, pose.left_hip
      ),
      right_shoulder_angle: this.calculateAngle(
        pose.right_elbow, pose.right_shoulder, pose.right_hip
      ),
      left_elbow_angle: this.calculateAngle(
        pose.left_wrist, pose.left_elbow, pose.left_shoulder
      ),
      right_elbow_angle: this.calculateAngle(
        pose.right_wrist, pose.right_elbow, pose.right_shoulder
      ),
      left_hip_angle: this.calculateAngle(
        pose.left_knee, pose.left_hip, pose.left_shoulder
      ),
      right_hip_angle: this.calculateAngle(
        pose.right_knee, pose.right_hip, pose.right_shoulder
      ),
      left_knee_angle: this.calculateAngle(
        pose.left_ankle, pose.left_knee, pose.left_hip
      ),
      right_knee_angle: this.calculateAngle(
        pose.right_ankle, pose.right_knee, pose.right_hip
      ),
      spine_angle: this.calculateSpineAngle(pose),
      neck_angle: this.calculateNeckAngle(pose),
      shoulder_symmetry: this.calculateSymmetry(
        pose.left_shoulder.y, pose.right_shoulder.y
      ),
      hip_symmetry: this.calculateSymmetry(
        pose.left_hip.y, pose.right_hip.y
      ),
      knee_symmetry: this.calculateSymmetry(
        pose.left_knee.y, pose.right_knee.y
      )
    };
  }

  // 📐 CALCULAR ÁNGULO ENTRE TRES PUNTOS
  private calculateAngle(pointA: PoseLandmark, pointB: PoseLandmark, pointC: PoseLandmark): number {
    // Vector BA
    const vectorBA = {
      x: pointA.x - pointB.x,
      y: pointA.y - pointB.y
    };

    // Vector BC
    const vectorBC = {
      x: pointC.x - pointB.x,
      y: pointC.y - pointB.y
    };

    // Calcular ángulo usando producto punto
    const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
    const magnitudeBA = Math.sqrt(vectorBA.x * vectorBA.x + vectorBA.y * vectorBA.y);
    const magnitudeBC = Math.sqrt(vectorBC.x * vectorBC.x + vectorBC.y * vectorBC.y);

    if (magnitudeBA === 0 || magnitudeBC === 0) {
      return 0;
    }

    const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle)); // Clamp para evitar NaN
    const angleRad = Math.acos(clampedCos);
    
    return (angleRad * 180) / Math.PI;
  }

  // 🔧 CALCULAR ÁNGULO DE LA COLUMNA
  private calculateSpineAngle(pose: PoseKeypoints): number {
    const midShoulder = {
      x: (pose.left_shoulder.x + pose.right_shoulder.x) / 2,
      y: (pose.left_shoulder.y + pose.right_shoulder.y) / 2
    };

    const midHip = {
      x: (pose.left_hip.x + pose.right_hip.x) / 2,
      y: (pose.left_hip.y + pose.right_hip.y) / 2
    };

    const deltaX = midShoulder.x - midHip.x;
    const deltaY = midShoulder.y - midHip.y;
    
    const angleRad = Math.atan2(Math.abs(deltaX), Math.abs(deltaY));
    return 90 - (angleRad * 180) / Math.PI;
  }

  // 🔧 CALCULAR ÁNGULO DEL CUELLO
  private calculateNeckAngle(pose: PoseKeypoints): number {
    const midShoulder = {
      x: (pose.left_shoulder.x + pose.right_shoulder.x) / 2,
      y: (pose.left_shoulder.y + pose.right_shoulder.y) / 2
    };

    const deltaX = pose.nose.x - midShoulder.x;
    const deltaY = pose.nose.y - midShoulder.y;
    
    const angleRad = Math.atan2(Math.abs(deltaX), Math.abs(deltaY));
    return 90 - (angleRad * 180) / Math.PI;
  }

  // ⚖️ CALCULAR SIMETRÍA ENTRE DOS PUNTOS
  private calculateSymmetry(leftValue: number, rightValue: number): number {
    return Math.abs(leftValue - rightValue) * 100;
  }

  // 📊 SEGUIMIENTO DE FPS
  private startFpsTracking(): void {
    const updateFps = () => {
      if (!this.isRunning) return;

      const now = Date.now();
      if (now - this.lastFpsUpdate >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
        this.fpsStream.next(fps);
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }

      requestAnimationFrame(updateFps);
    };

    updateFps();
  }

  // 📊 ACTUALIZAR MÉTRICAS DE RENDIMIENTO
  private updatePerformanceMetrics(processingTime: number): void {
    this.frameCount++;
    this.processingTimes.push(processingTime);

    if (this.processingTimes.length > 30) {
      this.processingTimes.shift();
    }
  }

  // 🧹 LIMPIAR RECURSOS
  ngOnDestroy(): void {
    this.stopCamera();
    if (this.pose) {
      this.pose.close();
    }
  }
}