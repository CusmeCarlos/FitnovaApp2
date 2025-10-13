// src/app/core/pose-engine/pose-detection.engine.ts
// ✅ MOTOR DE DETECCIÓN COMPLETO PARA EXAMEN

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
    mediaPipeLoadedPromise: Promise<any>;
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
  private readonly FPS_UPDATE_INTERVAL = 1000; // 1 segundo

  constructor() {
    console.log('🎬 PoseDetectionEngine constructor');
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

  // 🚀 INICIALIZAR MEDIAPIPE
  async initializeMediaPipe(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ MediaPipe ya inicializado');
      return;
    }

    try {
      console.log('🔧 Esperando MediaPipe...');
      this.statusStream.next('loading');

      // ✅ ESPERAR A QUE MEDIAPIPE SE CARGUE
      if (window.mediaPipeLoadedPromise) {
        await window.mediaPipeLoadedPromise;
      } else {
        await this.waitForMediaPipe();
      }

      console.log('🔧 Inicializando MediaPipe Pose...');

      // ✅ CREAR INSTANCIA DE POSE
      this.pose = new window.Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      // ✅ CONFIGURACIÓN RÁPIDA Y PRECISA
      await this.pose.setOptions({
        modelComplexity: 1, // ✅ Balance entre velocidad y precisión
        enableSegmentation: false,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        selfieMode: true
      });

      // ✅ CONFIGURAR CALLBACK DE RESULTADOS
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

  // ⏳ ESPERAR A QUE MEDIAPIPE SE CARGUE (FALLBACK)
  private waitForMediaPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 segundos
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        if (window.Pose && window.Camera && window.drawConnectors && window.POSE_CONNECTIONS) {
          console.log('✅ MediaPipe cargado después de', attempts, 'intentos');
          clearInterval(checkInterval);
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('❌ MediaPipe no se cargó después de', maxAttempts, 'intentos');
          clearInterval(checkInterval);
          reject(new Error('MediaPipe failed to load'));
        }
      }, 100);
    });
  }

  // 📹 INICIAR CÁMARA
  async startCamera(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      console.log('📹 === INICIANDO CÁMARA ===');

      // 1. Asegurar que MediaPipe esté inicializado
      if (!this.isInitialized) {
        await this.initializeMediaPipe();
      }

      // 2. Obtener stream de cámara OPTIMIZADO
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
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
  
      // ✅ CONVERTIR A NUESTRO FORMATO
      const poseKeypoints = this.convertToKeypoints(results.poseLandmarks);
      
      // ✅ CALCULAR ÁNGULOS
      const angles = this.calculateAngles(poseKeypoints);
      
      // ✅ EMITIR DATOS
      this.poseStream.next(poseKeypoints);
      this.anglesStream.next(angles);
      
      // ✅ ACTUALIZAR FPS
      this.updateFps();
      
    } catch (error) {
      console.error('❌ Error procesando pose:', error);
    }
  }

  // 🔄 CONVERTIR LANDMARKS A KEYPOINTS
  private convertToKeypoints(landmarks: any[]): PoseKeypoints {
    // ✅ MAPEO DE ÍNDICES DE MEDIAPIPE A NUESTROS NOMBRES
    const landmarkMapping = {
      0: 'nose',
      1: 'left_eye_inner', 2: 'left_eye', 3: 'left_eye_outer',
      4: 'right_eye_inner', 5: 'right_eye', 6: 'right_eye_outer',
      7: 'left_ear', 8: 'right_ear',
      9: 'mouth_left', 10: 'mouth_right',
      11: 'left_shoulder', 12: 'right_shoulder',
      13: 'left_elbow', 14: 'right_elbow',
      15: 'left_wrist', 16: 'right_wrist',
      17: 'left_pinky', 18: 'right_pinky',
      19: 'left_index', 20: 'right_index',
      21: 'left_thumb', 22: 'right_thumb',
      23: 'left_hip', 24: 'right_hip',
      25: 'left_knee', 26: 'right_knee',
      27: 'left_ankle', 28: 'right_ankle',
      29: 'left_heel', 30: 'right_heel',
      31: 'left_foot_index', 32: 'right_foot_index'
    };

    const keypoints: any = {};

    landmarks.forEach((landmark: any, index: number) => {
      const keypointName = landmarkMapping[index as keyof typeof landmarkMapping];
      if (keypointName) {
        keypoints[keypointName] = {
          x: landmark.x,
          y: landmark.y,
          z: landmark.z || 0,
          visibility: landmark.visibility || 1
        };
      }
    });

    return keypoints as PoseKeypoints;
  }

  // 📐 CALCULAR ÁNGULOS BIOMECÁNICOS (CORREGIDO)
private calculateAngles(pose: PoseKeypoints): BiomechanicalAngles {
  const angles: BiomechanicalAngles = {};

  try {
    // ✅ ÁNGULOS DE CODOS
    angles.left_elbow_angle = this.calculateAngle(
      pose.left_shoulder, pose.left_elbow, pose.left_wrist
    );
    angles.right_elbow_angle = this.calculateAngle(
      pose.right_shoulder, pose.right_elbow, pose.right_wrist
    );

    // ✅ ÁNGULOS DE RODILLAS (CRÍTICO PARA SENTADILLAS)
    angles.left_knee_angle = this.calculateAngle(
      pose.left_hip, pose.left_knee, pose.left_ankle
    );
    angles.right_knee_angle = this.calculateAngle(
      pose.right_hip, pose.right_knee, pose.right_ankle
    );

    // ✅ ÁNGULOS DE CADERAS
    angles.left_hip_angle = this.calculateAngle(
      pose.left_shoulder, pose.left_hip, pose.left_knee
    );
    angles.right_hip_angle = this.calculateAngle(
      pose.right_shoulder, pose.right_hip, pose.right_knee
    );

    // ✅ ÁNGULO DE COLUMNA MEJORADO
    if (pose.left_shoulder && pose.right_shoulder && pose.left_hip && pose.right_hip) {
      const shoulderMidpoint = {
        x: (pose.left_shoulder.x + pose.right_shoulder.x) / 2,
        y: (pose.left_shoulder.y + pose.right_shoulder.y) / 2,
        z: (pose.left_shoulder.z + pose.right_shoulder.z) / 2,
        visibility: 1
      };
      
      const hipMidpoint = {
        x: (pose.left_hip.x + pose.right_hip.x) / 2,
        y: (pose.left_hip.y + pose.right_hip.y) / 2,
        z: (pose.left_hip.z + pose.right_hip.z) / 2,
        visibility: 1
      };

      // ✅ CÁLCULO MÁS PRECISO DE LA COLUMNA
      const spineVector = {
        x: shoulderMidpoint.x - hipMidpoint.x,
        y: shoulderMidpoint.y - hipMidpoint.y
      };
      
      // Ángulo respecto a la vertical (0° = perfectamente vertical)
      const spineAngleRad = Math.atan2(Math.abs(spineVector.x), Math.abs(spineVector.y));
      angles.spine_angle = 90 - (spineAngleRad * 180 / Math.PI);
      
      // ✅ ASEGURAR QUE EL ÁNGULO ESTÉ EN RANGO VÁLIDO
      angles.spine_angle = Math.max(0, Math.min(90, angles.spine_angle));
    }

    // ✅ DEBUG: Imprimir ángulos importantes
    console.log(`📐 Ángulos calculados:`, {
      left_knee: angles.left_knee_angle?.toFixed(1),
      right_knee: angles.right_knee_angle?.toFixed(1),
      spine: angles.spine_angle?.toFixed(1)
    });

  } catch (error) {
    console.error('❌ Error calculando ángulos:', error);
  }

  return angles;
}

// 📐 CALCULAR ÁNGULO ENTRE TRES PUNTOS (MEJORADO)
private calculateAngle(pointA: PoseLandmark, pointB: PoseLandmark, pointC: PoseLandmark): number {
  if (!pointA || !pointB || !pointC) {
    console.warn('⚠️ Puntos faltantes para cálculo de ángulo');
    return 0;
  }
  
  if (pointA.visibility < 0.5 || pointB.visibility < 0.5 || pointC.visibility < 0.5) {
    console.warn('⚠️ Baja visibilidad en puntos para ángulo');
    return 0;
  }

  // ✅ VECTORES MÁS PRECISOS
  const ba = {
    x: pointA.x - pointB.x,
    y: pointA.y - pointB.y
  };

  const bc = {
    x: pointC.x - pointB.x,
    y: pointC.y - pointB.y
  };

  // ✅ PRODUCTO PUNTO
  const dotProduct = ba.x * bc.x + ba.y * bc.y;
  const magnitudeBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magnitudeBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);

  if (magnitudeBA === 0 || magnitudeBC === 0) {
    console.warn('⚠️ Magnitud cero en cálculo de ángulo');
    return 0;
  }

  const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
  
  // ✅ CLAMP MÁS ESTRICTO
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  
  // ✅ CONVERTIR A GRADOS
  const angleRad = Math.acos(clampedCos);
  const angleDeg = angleRad * 180 / Math.PI;

  // ✅ VALIDAR RESULTADO
  if (isNaN(angleDeg) || angleDeg < 0 || angleDeg > 180) {
    console.warn('⚠️ Ángulo inválido calculado:', angleDeg);
    return 0;
  }

  return angleDeg;
}

  // 📊 ACTUALIZAR FPS
  private updateFps(): void {
    this.frameCount++;
    const now = Date.now();
    
    if (now - this.lastFpsUpdate >= this.FPS_UPDATE_INTERVAL) {
      const fps = this.frameCount / ((now - this.lastFpsUpdate) / 1000);
      this.fpsStream.next(Math.round(fps));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  // ⏰ INICIAR TRACKING DE FPS
  private startFpsTracking(): void {
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
  }

  // ⏹️ PARAR CÁMARA
  async stopCamera(): Promise<void> {
    try {
      console.log('⏹️ Parando cámara...');
      
      this.isRunning = false;
      
      // Parar MediaPipe Camera
      if (this.camera) {
        this.camera.stop();
        this.camera = null;
      }
      
      this.statusStream.next('ready');
      console.log('✅ Cámara parada');
      
    } catch (error) {
      console.error('❌ Error parando cámara:', error);
    }
  }

  // 🧹 CLEANUP
  cleanup(): void {
    this.stopCamera();
    this.isInitialized = false;
    this.pose = null;
    this.statusStream.next('loading');
    console.log('🧹 PoseDetectionEngine limpiado');
  }
}