// src/app/core/pose-engine/pose-detection.engine.ts
// ✅ ENGINE RECONSTRUIDO - INCREMENTO 2 CORREGIDO

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

      // Configurar opciones
      await this.pose.setOptions({
        modelComplexity: 1,
        enableSegmentation: false,
        smoothLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
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
      
      // Verificar que la pose sea válida
      if (!this.isPoseValid(poseKeypoints)) {
        this.poseStream.next(null);
        this.anglesStream.next(null);
        return;
      }

      // Calcular ángulos
      const angles = this.calculateBiomechanicalAngles(poseKeypoints);

      // Emitir resultados
      this.poseStream.next(poseKeypoints);
      this.anglesStream.next(angles);

      // Actualizar FPS
      this.updateFpsCounter();

    } catch (error) {
      console.error('❌ Error procesando resultados:', error);
    }
  }

  // ✅ VALIDAR POSE
  private isPoseValid(pose: PoseKeypoints): boolean {
    const keyLandmarks = [
      pose.left_shoulder, pose.right_shoulder,
      pose.left_hip, pose.right_hip,
      pose.left_knee, pose.right_knee
    ];
    
    const validLandmarks = keyLandmarks.filter(landmark => landmark.visibility > 0.5);
    return validLandmarks.length >= 4;
  }

  // 🔄 CONVERTIR LANDMARKS
  private convertToKeypoints(landmarks: any[]): PoseKeypoints {
    const createLandmark = (index: number): PoseLandmark => ({
      x: landmarks[index]?.x || 0,
      y: landmarks[index]?.y || 0,
      z: landmarks[index]?.z || 0,
      visibility: landmarks[index]?.visibility || 0
    });

    return {
      // Cara y cabeza
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

      // Torso superior
      left_shoulder: createLandmark(11),
      right_shoulder: createLandmark(12),
      left_elbow: createLandmark(13),
      right_elbow: createLandmark(14),
      left_wrist: createLandmark(15),
      right_wrist: createLandmark(16),

      // Manos
      left_pinky: createLandmark(17),
      right_pinky: createLandmark(18),
      left_index: createLandmark(19),
      right_index: createLandmark(20),
      left_thumb: createLandmark(21),
      right_thumb: createLandmark(22),

      // Torso y cadera
      left_hip: createLandmark(23),
      right_hip: createLandmark(24),

      // Piernas
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

  // 📐 CALCULAR ÁNGULOS BIOMECÁNICOS
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
    const vectorBA = {
      x: pointA.x - pointB.x,
      y: pointA.y - pointB.y
    };

    const vectorBC = {
      x: pointC.x - pointB.x,
      y: pointC.y - pointB.y
    };

    const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
    const magnitudeBA = Math.sqrt(vectorBA.x * vectorBA.x + vectorBA.y * vectorBA.y);
    const magnitudeBC = Math.sqrt(vectorBC.x * vectorBC.x + vectorBC.y * vectorBC.y);

    if (magnitudeBA === 0 || magnitudeBC === 0) {
      return 0;
    }

    const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    const angleRad = Math.acos(clampedCos);
    
    return (angleRad * 180) / Math.PI;
  }

  // 🔧 CALCULAR ÁNGULO DE COLUMNA
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

  // 🔧 CALCULAR ÁNGULO DE CUELLO
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

  // ⚖️ CALCULAR SIMETRÍA
  private calculateSymmetry(leftValue: number, rightValue: number): number {
    return Math.abs(leftValue - rightValue) * 100;
  }

  // 📊 ACTUALIZAR CONTADOR FPS
  private updateFpsCounter(): void {
    this.frameCount++;
    const now = Date.now();
    
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.fpsStream.next(fps);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  // 📊 INICIAR TRACKING DE FPS
  private startFpsTracking(): void {
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
  }

  // 🛑 DETENER CÁMARA
  async stopCamera(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.camera) {
        this.camera.stop();
        this.camera = null;
      }
      
      this.statusStream.next('ready');
      console.log('🛑 Cámara detenida');

    } catch (error) {
      console.error('❌ Error deteniendo cámara:', error);
    }
  }

  // 🧹 LIMPIEZA
  ngOnDestroy(): void {
    this.stopCamera();
    if (this.pose) {
      this.pose.close();
    }
  }
}