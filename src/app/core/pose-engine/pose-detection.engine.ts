// src/app/core/pose-engine/pose-detection.engine.ts
// ✅ ENGINE COMPLETAMENTE CORREGIDO PARA EXAMEN

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PoseKeypoints, PoseLandmark, BiomechanicalAngles } from '../../shared/models/pose.models';

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

  // Streams reactivos
  private poseStream = new BehaviorSubject<PoseKeypoints | null>(null);
  private anglesStream = new BehaviorSubject<BiomechanicalAngles | null>(null);
  private fpsStream = new BehaviorSubject<number>(0);
  private statusStream = new BehaviorSubject<'loading' | 'ready' | 'running' | 'error'>('loading');

  // Control de FPS
  private frameCount = 0;
  private lastFpsUpdate = Date.now();

  // Control de carga
  private mediaPipeLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    console.log('🎬 PoseDetectionEngine constructor');
    this.checkMediaPipeAvailability();
  }

  // 🎯 GETTERS PARA STREAMS
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

  // 🔍 VERIFICAR DISPONIBILIDAD DE MEDIAPIPE
  private checkMediaPipeAvailability(): void {
    if (window.Pose && window.Camera) {
      console.log('✅ MediaPipe ya disponible');
      this.mediaPipeLoaded = true;
      this.statusStream.next('ready');
    } else {
      console.log('⏳ Esperando MediaPipe...');
      this.waitForMediaPipe();
    }
  }

  // ⏳ ESPERAR A QUE MEDIAPIPE SE CARGUE
  private waitForMediaPipe(): void {
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (window.Pose && window.Camera && window.drawConnectors && window.POSE_CONNECTIONS) {
        console.log('✅ MediaPipe cargado después de', attempts, 'intentos');
        clearInterval(checkInterval);
        this.mediaPipeLoaded = true;
        this.statusStream.next('ready');
      } else if (attempts >= maxAttempts) {
        console.error('❌ MediaPipe no se cargó después de', maxAttempts, 'intentos');
        clearInterval(checkInterval);
        this.statusStream.next('error');
      }
    }, 100);
  }

  // 🚀 INICIALIZAR MEDIAPIPE
  async initializeMediaPipe(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ MediaPipe ya inicializado');
      return;
    }

    if (!this.mediaPipeLoaded) {
      throw new Error('MediaPipe no está disponible');
    }

    try {
      console.log('🔧 Inicializando MediaPipe Pose...');
      this.statusStream.next('loading');

      // Crear instancia de Pose
      this.pose = new window.Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      // ✅ CONFIGURACIÓN OPTIMIZADA PARA EXAMEN
      await this.pose.setOptions({
        modelComplexity: 1,
        enableSegmentation: false,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,  // Menos estricto para mejor detección
        minTrackingConfidence: 0.4,   // Menos estricto para mejor seguimiento
        selfieMode: true
      });

      // Configurar callback de resultados
      this.pose.onResults((results: any) => {
        this.processPoseResults(results);
      });

      this.isInitialized = true;
      this.statusStream.next('ready');
      console.log('✅ MediaPipe inicializado correctamente');

    } catch (error) {
      console.error('❌ Error inicializando MediaPipe:', error);
      this.statusStream.next('error');
      throw error;
    }
  }

  // 📹 INICIAR CÁMARA
  async startCamera(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      console.log('📹 === INICIANDO CÁMARA ===');

      // 1. Asegurar que MediaPipe esté inicializado
      if (!this.isInitialized) {
        await this.initializeMediaPipe();
      }

      // 2. Obtener stream de cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      console.log('✅ Stream de cámara obtenido');

      // 3. Configurar video element
      videoElement.srcObject = stream;
      videoElement.autoplay = true;
      videoElement.muted = true;
      videoElement.playsInline = true;

      // 4. Esperar a que el video esté listo
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          console.log('✅ Video metadata cargada:', {
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight
          });
          resolve();
        };

        if (videoElement.readyState >= 2) {
          onLoadedMetadata();
        } else {
          videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        }
      });

      // 5. Reproducir video
      await videoElement.play();
      console.log('✅ Video reproduciendo');

      // 6. Configurar canvas
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;

      // 7. Iniciar MediaPipe Camera
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

        await this.camera.start();
        console.log('✅ MediaPipe Camera iniciada');
      } else {
        // Fallback manual
        this.startManualProcessing(videoElement);
      }

      // 8. Marcar como corriendo
      this.isRunning = true;
      this.statusStream.next('running');
      this.startFpsTracking();

      console.log('🎉 === CÁMARA INICIADA EXITOSAMENTE ===');

    } catch (error) {
      console.error('❌ Error iniciando cámara:', error);
      this.statusStream.next('error');
      throw error;
    }
  }

  // 🔄 PROCESAMIENTO MANUAL (FALLBACK)
  private startManualProcessing(videoElement: HTMLVideoElement): void {
    console.log('🔄 Iniciando procesamiento manual...');
    
    const processFrame = async () => {
      if (this.isRunning && this.pose && videoElement.readyState >= 2) {
        try {
          await this.pose.send({ image: videoElement });
        } catch (error) {
          console.error('❌ Error en frame manual:', error);
        }
      }
      
      if (this.isRunning) {
        requestAnimationFrame(processFrame);
      }
    };
    
    requestAnimationFrame(processFrame);
  }

  // 🧠 PROCESAR RESULTADOS DE MEDIAPIPE
  private processPoseResults(results: any): void {
    const startTime = performance.now();
  
    try {
      // Verificar si hay landmarks válidos
      if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
        this.poseStream.next(null);
        this.anglesStream.next(null);
        return;
      }
  
      // Convertir a nuestro formato
      const poseKeypoints = this.convertToKeypoints(results.poseLandmarks);
      
      // Calcular ángulos
      const angles = this.calculateAngles(poseKeypoints);
      
      // Emitir datos
      this.poseStream.next(poseKeypoints);
      this.anglesStream.next(angles);
      
      // Actualizar FPS
      this.updateFps();
      
      const processingTime = performance.now() - startTime;
      console.log(`⚡ Frame procesado en ${processingTime.toFixed(2)}ms`);
  
    } catch (error) {
      console.error('❌ Error procesando pose:', error);
      this.poseStream.next(null);
      this.anglesStream.next(null);
    }
  }

  // 🔄 CONVERTIR LANDMARKS A KEYPOINTS
  private convertToKeypoints(landmarks: any[]): PoseKeypoints {
    const keypoints: any = {};
    
    // Mapeo directo de MediaPipe landmarks
    const landmarkMapping = {
      nose: 0,
      left_eye_inner: 1, left_eye: 2, left_eye_outer: 3,
      right_eye_inner: 4, right_eye: 5, right_eye_outer: 6,
      left_ear: 7, right_ear: 8,
      mouth_left: 9, mouth_right: 10,
      left_shoulder: 11, right_shoulder: 12,
      left_elbow: 13, right_elbow: 14,
      left_wrist: 15, right_wrist: 16,
      left_pinky: 17, right_pinky: 18,
      left_index: 19, right_index: 20,
      left_thumb: 21, right_thumb: 22,
      left_hip: 23, right_hip: 24,
      left_knee: 25, right_knee: 26,
      left_ankle: 27, right_ankle: 28,
      left_heel: 29, right_heel: 30,
      left_foot_index: 31, right_foot_index: 32
    };

    Object.entries(landmarkMapping).forEach(([name, index]) => {
      if (landmarks[index]) {
        keypoints[name] = {
          x: landmarks[index].x,
          y: landmarks[index].y,
          z: landmarks[index].z || 0,
          visibility: landmarks[index].visibility || 1
        };
      }
    });

    return keypoints as PoseKeypoints;
  }

  // 📐 CALCULAR ÁNGULOS BIOMECÁNICOS
  private calculateAngles(pose: PoseKeypoints): BiomechanicalAngles {
    const angles: any = {};
    
    try {
      // ✅ ÁNGULOS PRINCIPALES PARA DETECCIÓN
      
      // Ángulos de codo
      if (pose.left_shoulder && pose.left_elbow && pose.left_wrist) {
        angles.left_elbow_angle = this.calculateAngle(
          pose.left_shoulder, pose.left_elbow, pose.left_wrist
        );
      }
      
      if (pose.right_shoulder && pose.right_elbow && pose.right_wrist) {
        angles.right_elbow_angle = this.calculateAngle(
          pose.right_shoulder, pose.right_elbow, pose.right_wrist
        );
      }
      
      // Ángulos de rodilla
      if (pose.left_hip && pose.left_knee && pose.left_ankle) {
        angles.left_knee_angle = this.calculateAngle(
          pose.left_hip, pose.left_knee, pose.left_ankle
        );
      }
      
      if (pose.right_hip && pose.right_knee && pose.right_ankle) {
        angles.right_knee_angle = this.calculateAngle(
          pose.right_hip, pose.right_knee, pose.right_ankle
        );
      }
      
      // Ángulos de cadera
      if (pose.left_shoulder && pose.left_hip && pose.left_knee) {
        angles.left_hip_angle = this.calculateAngle(
          pose.left_shoulder, pose.left_hip, pose.left_knee
        );
      }
      
      if (pose.right_shoulder && pose.right_hip && pose.right_knee) {
        angles.right_hip_angle = this.calculateAngle(
          pose.right_shoulder, pose.right_hip, pose.right_knee
        );
      }

      // ✅ ÁNGULO DEL TRONCO CORREGIDO
        if (pose.left_shoulder && pose.right_shoulder && pose.left_hip && pose.right_hip) {
          const shoulderCenter = {
            x: (pose.left_shoulder.x + pose.right_shoulder.x) / 2,
            y: (pose.left_shoulder.y + pose.right_shoulder.y) / 2
          };
          
          const hipCenter = {
            x: (pose.left_hip.x + pose.right_hip.x) / 2,
            y: (pose.left_hip.y + pose.right_hip.y) / 2
          };
  
  // ✅ CÁLCULO CORRECTO: Diferencia en Y (vertical) vs X (horizontal)
  const deltaY = Math.abs(shoulderCenter.y - hipCenter.y);
  const deltaX = Math.abs(shoulderCenter.x - hipCenter.x);
  
  // ✅ Ángulo de inclinación real
  const angleRad = Math.atan2(deltaX, deltaY);
  angles.trunk_angle = angleRad * (180 / Math.PI);
  
  console.log(`📐 Tronco: deltaX=${deltaX.toFixed(3)}, deltaY=${deltaY.toFixed(3)}, ángulo=${angles.trunk_angle.toFixed(1)}°`);
}
      
    } catch (error) {
      console.error('❌ Error calculando ángulos:', error);
    }
    
    return angles as BiomechanicalAngles;
  }

  // 📐 CALCULAR ÁNGULO ENTRE 3 PUNTOS
  private calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
    try {
      // Vector BA
      const ba = {
        x: a.x - b.x,
        y: a.y - b.y
      };
      
      // Vector BC
      const bc = {
        x: c.x - b.x,
        y: c.y - b.y
      };
      
      // Producto punto
      const dot = ba.x * bc.x + ba.y * bc.y;
      
      // Magnitudes
      const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
      const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
      
      // Ángulo en radianes
      const angleRad = Math.acos(dot / (magBA * magBC));
      
      // Convertir a grados
      const angleDeg = angleRad * (180 / Math.PI);
      
      return isNaN(angleDeg) ? 0 : angleDeg;
      
    } catch (error) {
      console.error('❌ Error calculando ángulo:', error);
      return 0;
    }
  }

  // 📊 ACTUALIZAR FPS
  private updateFps(): void {
    this.frameCount++;
    const now = Date.now();
    
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = this.frameCount;
      this.fpsStream.next(fps);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  // ⏰ INICIAR TRACKING DE FPS
  private startFpsTracking(): void {
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
  }

  // 🛑 PARAR CÁMARA
  async stopCamera(): Promise<void> {
    console.log('🛑 Parando cámara...');
    
    this.isRunning = false;
    
    if (this.camera) {
      try {
        this.camera.stop();
      } catch (error) {
        console.error('❌ Error parando MediaPipe camera:', error);
      }
      this.camera = null;
    }
    
    this.statusStream.next('ready');
    this.fpsStream.next(0);
    console.log('✅ Cámara parada');
  }

  // 🧹 LIMPIAR RECURSOS
  destroy(): void {
    console.log('🧹 Limpiando PoseDetectionEngine...');
    
    this.stopCamera();
    
    if (this.pose) {
      try {
        this.pose.close();
      } catch (error) {
        console.error('❌ Error cerrando Pose:', error);
      }
      this.pose = null;
    }
    
    this.isInitialized = false;
    this.mediaPipeLoaded = false;
    
    console.log('✅ PoseDetectionEngine limpiado');
  }
}