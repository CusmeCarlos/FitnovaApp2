// src/app/core/pose-engine/pose-detection.engine.ts
// Motor principal de detección de poses con MediaPipe

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PoseKeypoints, PoseLandmark, BiomechanicalAngles, ExerciseType } from '../../shared/models/pose.models';

// Declaraciones globales para MediaPipe
declare global {
  interface Window {
    Pose: any;
    Camera: any;
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
      console.log('📦 Cargando MediaPipe scripts...');
      this.statusStream.next('loading');

      // Cargar scripts de MediaPipe desde CDN
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');

      console.log('✅ MediaPipe scripts cargados');
      this.mediaPipeLoaded = true;
      
      // Ahora inicializar MediaPipe
      await this.initializePose();

    } catch (error) {
      console.error('❌ Error cargando MediaPipe:', error);
      this.statusStream.next('error');
      throw error;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verificar si el script ya está cargado
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        console.log(`✅ Script cargado: ${src}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`❌ Error cargando script: ${src}`);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
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

  // 📹 INICIAR CÁMARA Y DETECCIÓN
  // REEMPLAZAR el método startCamera con este:

  async startCamera(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      console.log('📹 Iniciando cámara (versión mejorada)...');
      this.statusStream.next('initializing');
  
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
            duration: videoElement.duration,
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
        
        // Si ya está cargado
        if (videoElement.readyState >= 2) {
          clearTimeout(timeoutId);
          onLoadedMetadata();
        }
      });
  
      // ✅ REPRODUCIR VIDEO
      try {
        await videoElement.play();
        console.log('✅ Video reproduciendo');
      } catch (playError) {
        console.error('❌ Error reproduciendo:', playError);
        // Intentar de nuevo después de interacción del usuario
      }
  
      // ✅ CONFIGURAR CANVAS
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;
  
      console.log('✅ Canvas configurado:', {
        width: canvasElement.width,
        height: canvasElement.height
      });
  
      // ✅ INICIAR BUCLE DE RENDERIZADO
      this.isRunning = true;
      this.statusStream.next('running');
      this.startSimpleRenderLoop(videoElement, canvasElement);
  
      console.log('🎉 Cámara iniciada exitosamente');
  
    } catch (error) {
      console.error('❌ Error iniciando cámara:', error);
      this.statusStream.next('error');
      throw error;
    }
  }


// AGREGAR estos métodos después del método startCamera:

private startSimpleRenderLoop(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  console.log('🎬 Iniciando bucle de renderizado mejorado...');

  let frameCount = 0;
  let lastFpsTime = performance.now();

  const renderFrame = (currentTime: number) => {
    if (!this.isRunning) {
      console.log('🛑 Renderizado detenido');
      return;
    }

    try {
      // 🔧 LIMPIAR CANVAS
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 📹 DIBUJAR VIDEO - MEJORADO
      if (video.readyState >= 2 && video.videoWidth > 0) {
        console.log('🎥 Dibujando frame de video:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          readyState: video.readyState
        });
        
        // Dibujar el video completo en el canvas
        ctx.drawImage(
          video, 
          0, 0, video.videoWidth, video.videoHeight,  // Source
          0, 0, canvas.width, canvas.height           // Destination
        );
        
        // 🎯 OPCIONAL: Aplicar efecto espejo
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          video,
          0, 0, video.videoWidth, video.videoHeight,
          -canvas.width, 0, canvas.width, canvas.height
        );
        ctx.restore();
        
      } else {
        console.warn('⚠️ Video no listo:', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
        
        // 🎨 Dibujar placeholder mientras el video carga
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          'Iniciando cámara...', 
          canvas.width / 2, 
          canvas.height / 2
        );
      }

      // 📊 CALCULAR FPS
      frameCount++;
      if (currentTime - lastFpsTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsTime));
        this.fpsStream.next(fps);
        console.log(`📊 FPS: ${fps}`);
        frameCount = 0;
        lastFpsTime = currentTime;
      }

      // 🤖 SIMULAR POSE BÁSICA PARA TESTING
      this.simulateBasicPose();

    } catch (error) {
      console.error('❌ Error en render loop:', error);
    }

    // 🔄 CONTINUAR BUCLE
    requestAnimationFrame(renderFrame);
  };

  // 🚀 INICIAR BUCLE
  console.log('🚀 Iniciando requestAnimationFrame...');
  requestAnimationFrame(renderFrame);
}

private simulateBasicPose(): void {
  // Pose simulada básica para testing
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

  // Simular ángulos
  const mockAngles: BiomechanicalAngles = {
    left_knee_angle: 90 + Math.random() * 20,
    right_knee_angle: 90 + Math.random() * 20,
    left_elbow_angle: 120 + Math.random() * 30,
    right_elbow_angle: 120 + Math.random() * 30,
    left_hip_angle: 175 + Math.random() * 10,
    right_hip_angle: 175 + Math.random() * 10,
    spine_angle: 85 + Math.random() * 5,
    shoulder_symmetry: Math.random() * 5,
    hip_symmetry: Math.random() * 3,
    knee_symmetry: Math.random() * 4
  };

  this.poseStream.next(mockPose);
  this.anglesStream.next(mockAngles);
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

  // 🧠 PROCESAMIENTO PRINCIPAL DE RESULTADOS
  private processPoseResults(results: any): void {
    if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
      this.poseStream.next(null);
      this.anglesStream.next(null);
      return;
    }

    try {
      const poseKeypoints = this.convertToKeypoints(results.poseLandmarks);
      const angles = this.calculateBiomechanicalAngles(poseKeypoints);
      
      this.poseStream.next(poseKeypoints);
      this.anglesStream.next(angles);

    } catch (error) {
      console.error('❌ Error procesando pose:', error);
    }
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

  // 📐 CÁLCULO DE ÁNGULOS BIOMECÁNICOS
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

    const angleRad = Math.acos(dotProduct / (magnitudeBA * magnitudeBC));
    return (angleRad * 180) / Math.PI;
  }

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

  private calculateSymmetry(leftValue: number, rightValue: number): number {
    return Math.abs(leftValue - rightValue) * 100;
  }

  private updatePerformanceMetrics(processingTime: number): void {
    this.frameCount++;
    this.processingTimes.push(processingTime);

    if (this.processingTimes.length > 30) {
      this.processingTimes.shift();
    }

    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      const avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
      const fps = Math.round(1000 / avgProcessingTime);
      
      this.fpsStream.next(fps);
      this.lastFpsUpdate = now;
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.pose) {
      this.pose.close();
    }
  }
}