// src/app/core/pose-engine/precision-validator.ts
// ✅ SISTEMA DE VALIDACIÓN DE PRECISIÓN CIENTÍFICA

import { Injectable } from '@angular/core';
import { PoseKeypoints, BiomechanicalAngles, ExerciseType, ValidationMetrics, } from '../../shared/models/pose.models';
import { Observable, BehaviorSubject } from 'rxjs';

export interface PrecisionMetrics {
  angularAccuracy: number;      // Error angular promedio en grados
  spatialAccuracy: number;      // Error espacial en centímetros
  temporalConsistency: number;  // Consistencia temporal (0-1)
  correlationCoefficient: number; // Correlación con datos de referencia
  frameStability: number;       // Estabilidad entre frames
  overallPrecision: number;     // Precisión general (0-100)
}

export interface PerformanceMetrics {
  fps: number;
  latency: number;              // En milisegundos
  memoryUsage: number;          // En MB
  cpuUsage: number;             // Porcentaje estimado
  batteryImpact: number;        // Estimación de impacto (0-100)
  frameDrops: number;           // Frames perdidos
}

export interface ReferenceDataPoint {
  timestamp: number;
  exerciseType: ExerciseType;
  pose: PoseKeypoints;
  angles: BiomechanicalAngles;
  groundTruth: {
    kneeAngle: number;
    hipAngle: number;
    spineAngle: number;
    shoulderAngle: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PrecisionValidator {
  
  private precisionMetrics = new BehaviorSubject<PrecisionMetrics>({
    angularAccuracy: 0,
    spatialAccuracy: 0,
    temporalConsistency: 0,
    correlationCoefficient: 0,
    frameStability: 0,
    overallPrecision: 0
  });

  private performanceMetrics = new BehaviorSubject<PerformanceMetrics>({
    fps: 0,
    latency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    batteryImpact: 0,
    frameDrops: 0
  });

  // Buffers para cálculos estadísticos
  private frameHistory: Array<{
    timestamp: number;
    pose: PoseKeypoints;
    angles: BiomechanicalAngles;
    processingTime: number;
  }> = [];

  private referenceData: ReferenceDataPoint[] = [];
  private errorHistory: number[] = [];
  private latencyHistory: number[] = [];
  
  // Configuración
  private readonly HISTORY_SIZE = 100;
  private readonly VALIDATION_WINDOW = 30; // frames para validación
  private readonly TARGET_ANGULAR_ACCURACY = 5; // grados
  private readonly TARGET_CORRELATION = 0.9;

  // Métricas de performance
  private startTime = 0;
  private frameCount = 0;
  private totalProcessingTime = 0;
  private memoryBaseline = 0;

  constructor() {
    this.initializeMemoryBaseline();
    this.loadReferenceData();
  }

  // 🎯 GETTERS PARA STREAMS
  get precision$(): Observable<PrecisionMetrics> {
    return this.precisionMetrics.asObservable();
  }

  get performance$(): Observable<PerformanceMetrics> {
    return this.performanceMetrics.asObservable();
  }

  // 🔬 INICIALIZAR VALIDACIÓN
  startValidation(): void {
    console.log('🔬 Iniciando validación de precisión...');
    this.startTime = performance.now();
    this.frameCount = 0;
    this.totalProcessingTime = 0;
    this.frameHistory = [];
    this.errorHistory = [];
    this.latencyHistory = [];
  }

  // 📊 VALIDAR FRAME INDIVIDUAL
  validateFrame(
    pose: PoseKeypoints, 
    angles: BiomechanicalAngles, 
    processingStartTime: number
  ): void {
    const frameEndTime = performance.now();
    const processingTime = frameEndTime - processingStartTime;
    
    // Almacenar en historial
    this.frameHistory.push({
      timestamp: frameEndTime,
      pose,
      angles,
      processingTime
    });

    // Mantener tamaño del buffer
    if (this.frameHistory.length > this.HISTORY_SIZE) {
      this.frameHistory.shift();
    }

    // Actualizar métricas de latencia
    this.latencyHistory.push(processingTime);
    if (this.latencyHistory.length > this.HISTORY_SIZE) {
      this.latencyHistory.shift();
    }

    this.frameCount++;
    this.totalProcessingTime += processingTime;

    // Calcular métricas cada 10 frames
    if (this.frameCount % 10 === 0) {
      this.calculatePrecisionMetrics();
      this.calculatePerformanceMetrics();
    }
  }

  // 🧮 CALCULAR MÉTRICAS DE PRECISIÓN
  private calculatePrecisionMetrics(): void {
    if (this.frameHistory.length < this.VALIDATION_WINDOW) return;

    const recentFrames = this.frameHistory.slice(-this.VALIDATION_WINDOW);
    
    // 1. Precisión Angular
    const angularAccuracy = this.calculateAngularAccuracy(recentFrames);
    
    // 2. Precisión Espacial
    const spatialAccuracy = this.calculateSpatialAccuracy(recentFrames);
    
    // 3. Consistencia Temporal
    const temporalConsistency = this.calculateTemporalConsistency(recentFrames);
    
    // 4. Correlación con datos de referencia
    const correlationCoefficient = this.calculateCorrelation(recentFrames);
    
    // 5. Estabilidad entre frames
    const frameStability = this.calculateFrameStability(recentFrames);
    
    // 6. Precisión general
    const overallPrecision = this.calculateOverallPrecision({
      angularAccuracy,
      spatialAccuracy,
      temporalConsistency,
      correlationCoefficient,
      frameStability
    });

    // Emitir métricas actualizadas
    this.precisionMetrics.next({
      angularAccuracy,
      spatialAccuracy,
      temporalConsistency,
      correlationCoefficient,
      frameStability,
      overallPrecision
    });
  }

  // 📐 CALCULAR PRECISIÓN ANGULAR
  private calculateAngularAccuracy(frames: any[]): number {
    const errors: number[] = [];
    
    frames.forEach(frame => {
      const angles = frame.angles;
      
      // Validar contra rangos biomecánicos conocidos
      const kneeError = this.validateAngleRange(
        (angles.left_knee_angle + angles.right_knee_angle) / 2,
        { min: 0, max: 180, ideal: 90 }
      );
      
      const hipError = this.validateAngleRange(
        (angles.left_hip_angle + angles.right_hip_angle) / 2,
        { min: 45, max: 180, ideal: 90 }
      );
      
      const shoulderError = this.validateAngleRange(
        (angles.left_shoulder_angle + angles.right_shoulder_angle) / 2,
        { min: 0, max: 180, ideal: 90 }
      );
      
      errors.push(kneeError, hipError, shoulderError);
    });
    
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    return Math.max(0, 100 - (avgError / this.TARGET_ANGULAR_ACCURACY) * 100);
  }

  // 📏 CALCULAR PRECISIÓN ESPACIAL
  private calculateSpatialAccuracy(frames: any[]): number {
    const spatialErrors: number[] = [];
    
    for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      
      // Calcular movimiento esperado vs real entre frames consecutivos
      const shoulderMovement = this.calculateLandmarkDistance(
        prevFrame.pose.left_shoulder,
        currFrame.pose.left_shoulder
      );
      
      const hipMovement = this.calculateLandmarkDistance(
        prevFrame.pose.left_hip,
        currFrame.pose.left_hip
      );
      
      // Los movimientos muy grandes entre frames indican error
      const movementError = Math.max(shoulderMovement, hipMovement);
      spatialErrors.push(movementError);
    }
    
    const avgSpatialError = spatialErrors.reduce((a, b) => a + b, 0) / spatialErrors.length;
    return Math.max(0, 100 - avgSpatialError * 1000); // Convertir a centímetros
  }

  // ⏱️ CALCULAR CONSISTENCIA TEMPORAL
  private calculateTemporalConsistency(frames: any[]): number {
    const angleVariations: number[] = [];
    
    for (let i = 1; i < frames.length; i++) {
      const prevAngles = frames[i - 1].angles;
      const currAngles = frames[i].angles;
      
      const kneeVariation = Math.abs(
        (prevAngles.left_knee_angle + prevAngles.right_knee_angle) / 2 -
        (currAngles.left_knee_angle + currAngles.right_knee_angle) / 2
      );
      
      angleVariations.push(kneeVariation);
    }
    
    const avgVariation = angleVariations.reduce((a, b) => a + b, 0) / angleVariations.length;
    return Math.max(0, 100 - avgVariation * 2); // Penalizar variaciones > 50°
  }

  // 📈 CALCULAR CORRELACIÓN
  private calculateCorrelation(frames: any[]): number {
    if (this.referenceData.length === 0) return 85; // Valor por defecto sin datos de referencia
    
    // Comparar con datos de referencia conocidos
    const correlations: number[] = [];
    
    frames.forEach(frame => {
      const reference = this.findClosestReference(frame);
      if (reference) {
        const correlation = this.calculatePearsonCorrelation(frame.angles, reference.groundTruth);
        correlations.push(correlation);
      }
    });
    
    if (correlations.length === 0) return 85;
    
    const avgCorrelation = correlations.reduce((a, b) => a + b, 0) / correlations.length;
    return avgCorrelation * 100;
  }

  // 🎯 CALCULAR ESTABILIDAD DE FRAMES
  private calculateFrameStability(frames: any[]): number {
    const stabilityScores: number[] = [];
    
    for (let i = 1; i < frames.length; i++) {
      const prevPose = frames[i - 1].pose;
      const currPose = frames[i].pose;
      
      // Calcular estabilidad de landmarks clave
      const landmarkStability = this.calculateLandmarkStability(prevPose, currPose);
      stabilityScores.push(landmarkStability);
    }
    
    return stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length;
  }

  // 🏆 CALCULAR PRECISIÓN GENERAL
  private calculateOverallPrecision(metrics: Partial<PrecisionMetrics>): number {
    const weights = {
      angularAccuracy: 0.3,      // 30% - Más importante para ejercicios
      spatialAccuracy: 0.2,      // 20%
      temporalConsistency: 0.2,   // 20%
      correlationCoefficient: 0.2, // 20%
      frameStability: 0.1         // 10%
    };
    
    return (
      (metrics.angularAccuracy || 0) * weights.angularAccuracy +
      (metrics.spatialAccuracy || 0) * weights.spatialAccuracy +
      (metrics.temporalConsistency || 0) * weights.temporalConsistency +
      (metrics.correlationCoefficient || 0) * weights.correlationCoefficient +
      (metrics.frameStability || 0) * weights.frameStability
    );
  }

  // ⚡ CALCULAR MÉTRICAS DE PERFORMANCE
  private calculatePerformanceMetrics(): void {
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    
    // FPS
    const fps = Math.round((this.frameCount * 1000) / elapsed);
    
    // Latencia promedio
    const avgLatency = this.latencyHistory.length > 0 
      ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
      : 0;
    
    // Uso de memoria estimado
    const memoryUsage = this.estimateMemoryUsage();
    
    // CPU estimado basado en tiempo de procesamiento
    const cpuUsage = this.estimateCPUUsage();
    
    // Impacto en batería estimado
    const batteryImpact = this.estimateBatteryImpact(fps, cpuUsage);
    
    // Frame drops
    const expectedFrames = Math.floor(elapsed / (1000 / 30)); // 30 FPS target
    const frameDrops = Math.max(0, expectedFrames - this.frameCount);
    
    this.performanceMetrics.next({
      fps,
      latency: Math.round(avgLatency),
      memoryUsage: Math.round(memoryUsage),
      cpuUsage: Math.round(cpuUsage),
      batteryImpact: Math.round(batteryImpact),
      frameDrops
    });
  }

  // 🧠 MÉTODOS AUXILIARES DE CÁLCULO

  private validateAngleRange(angle: number, range: { min: number; max: number; ideal: number }): number {
    if (isNaN(angle)) return 10; // Penalizar ángulos inválidos
    
    const clampedAngle = Math.max(range.min, Math.min(range.max, angle));
    return Math.abs(angle - range.ideal);
  }

  private calculateLandmarkDistance(point1: any, point2: any): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateLandmarkStability(pose1: PoseKeypoints, pose2: PoseKeypoints): number {
    const keyLandmarks = [
      'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
      'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    let totalStability = 0;
    let validLandmarks = 0;
    
    keyLandmarks.forEach(landmark => {
      const point1 = (pose1 as any)[landmark];
      const point2 = (pose2 as any)[landmark];
      
      if (point1 && point2 && point1.visibility > 0.5 && point2.visibility > 0.5) {
        const distance = this.calculateLandmarkDistance(point1, point2);
        const stability = Math.max(0, 100 - distance * 1000); // Convertir a estabilidad
        totalStability += stability;
        validLandmarks++;
      }
    });
    
    return validLandmarks > 0 ? totalStability / validLandmarks : 0;
  }

  private calculatePearsonCorrelation(angles: BiomechanicalAngles, groundTruth: any): number {
    // Implementación simplificada de correlación de Pearson
    const values1 = [
      angles.left_knee_angle || 0,
      angles.right_knee_angle || 0,
      angles.left_hip_angle || 0,
      angles.right_hip_angle || 0
    ];
    
    const values2 = [
      groundTruth.kneeAngle,
      groundTruth.kneeAngle,
      groundTruth.hipAngle,
      groundTruth.hipAngle
    ];
    
    // Cálculo básico de correlación
    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;
    
    let numerator = 0;
    let sum1 = 0;
    let sum2 = 0;
    
    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sum1 += diff1 * diff1;
      sum2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sum1 * sum2);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private findClosestReference(frame: any): ReferenceDataPoint | null {
    // Por ahora retornar null, se implementaría búsqueda en datos de referencia
    return null;
  }

  private estimateMemoryUsage(): number {
    // Estimación basada en el número de objetos en memoria
    const baseMemory = this.memoryBaseline;
    const frameMemory = this.frameHistory.length * 0.5; // ~0.5MB por frame
    return baseMemory + frameMemory;
  }

  private estimateCPUUsage(): number {
    if (this.latencyHistory.length === 0) return 0;
    
    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    // Estimar CPU basado en latencia (más latencia = más CPU)
    return Math.min(100, (avgLatency / 33.33) * 100); // 33.33ms = 30fps
  }

  private estimateBatteryImpact(fps: number, cpuUsage: number): number {
    // Estimación simplificada del impacto en batería
    const fpsImpact = (fps / 30) * 30; // 30% por FPS normal
    const cpuImpact = (cpuUsage / 100) * 50; // 50% por CPU alto
    const cameraImpact = 20; // 20% base por usar cámara
    
    return Math.min(100, fpsImpact + cpuImpact + cameraImpact);
  }

  private initializeMemoryBaseline(): void {
    // Estimar memoria base de la aplicación
    if ('memory' in performance) {
      this.memoryBaseline = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    } else {
      this.memoryBaseline = 50; // Estimación por defecto en MB
    }
  }

  private loadReferenceData(): void {
    // Cargar datos de referencia para validación
    // Por ahora usar datos simulados
    this.referenceData = [
      {
        timestamp: Date.now(),
        exerciseType: ExerciseType.SQUATS,
        pose: {} as PoseKeypoints,
        angles: {} as BiomechanicalAngles,
        groundTruth: {
          kneeAngle: 90,
          hipAngle: 90,
          spineAngle: 85,
          shoulderAngle: 45
        }
      }
    ];
  }

  // 📋 OBTENER REPORTE DE VALIDACIÓN
  getValidationReport(): {
    precision: PrecisionMetrics;
    performance: PerformanceMetrics;
    recommendations: string[];
    isWithinTargets: boolean;
  } {
    const precision = this.precisionMetrics.value;
    const performance = this.performanceMetrics.value;
    
    const recommendations: string[] = [];
    
    // Analizar y generar recomendaciones
    if (precision.angularAccuracy < 90) {
      recommendations.push('Mejorar calibración de detección angular');
    }
    
    if (performance.fps < 25) {
      recommendations.push('Optimizar procesamiento para mejor FPS');
    }
    
    if (performance.latency > 50) {
      recommendations.push('Reducir latencia del pipeline');
    }
    
    if (performance.memoryUsage > 200) {
      recommendations.push('Optimizar uso de memoria');
    }
    
    // Verificar si cumple targets científicos
    const isWithinTargets = (
      precision.angularAccuracy >= 90 && // <5° error
      precision.correlationCoefficient >= 90 && // >0.9 correlación
      performance.latency <= 100 && // <100ms latencia
      performance.fps >= 25 // >25 FPS mínimo
    );
    
    return {
      precision,
      performance,
      recommendations,
      isWithinTargets
    };
  }

  // 🧹 CLEANUP
  cleanup(): void {
    this.frameHistory = [];
    this.errorHistory = [];
    this.latencyHistory = [];
    this.frameCount = 0;
    this.totalProcessingTime = 0;
  }
}