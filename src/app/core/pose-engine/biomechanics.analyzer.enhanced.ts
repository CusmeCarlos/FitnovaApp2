// src/app/core/pose-engine/biomechanics.analyzer.enhanced.ts
// ✅ ANALIZADOR BIOMECÁNICO MEJORADO CON VALIDACIÓN CIENTÍFICA

import { Injectable } from '@angular/core';
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  PostureErrorType,
  ExerciseType,
  RepetitionPhase
} from '../../shared/models/pose.models';

import { PrecisionValidator, PrecisionMetrics, PerformanceMetrics } from './precision-validator';
import { 
  ADVANCED_EXERCISE_DEFINITIONS, 
  AdvancedErrorDetector,
  BIOMECHANICAL_THRESHOLDS
} from '../config/advanced-exercise-definitions';

@Injectable({
  providedIn: 'root'
})
export class EnhancedBiomechanicsAnalyzer {
  
  private currentExercise: ExerciseType | null = null;
  private currentPhase: RepetitionPhase = RepetitionPhase.IDLE;
  private repetitionCounter = 0;
  private lastErrorTimestamps: Map<PostureErrorType, number> = new Map();
  
  // ✅ NUEVOS: Buffers mejorados para análisis científico
  private angleHistory: BiomechanicalAngles[] = [];
  private phaseHistory: RepetitionPhase[] = [];
  private poseHistory: PoseKeypoints[] = [];
  private readonly SMOOTHING_WINDOW = 5; // Aumentado para mejor precisión
  private readonly ERROR_COOLDOWN = 2000; // Reducido para detección más responsiva
  private readonly VALIDATION_WINDOW = 30; // Ventana para validación científica

  // ✅ NUEVOS: Calidad y validación científica
  private qualityHistory: number[] = [];
  private precisionValidator: PrecisionValidator;
  private frameProcessingTimes: number[] = [];
  
  // ✅ NUEVOS: Métricas científicas
  private sessionStartTime = 0;
  private totalFramesProcessed = 0;
  private scientificErrors: PostureError[] = [];

  constructor() {
    console.log('🧠 Enhanced BiomechanicsAnalyzer inicializado');
    this.precisionValidator = new PrecisionValidator();
    this.sessionStartTime = performance.now();
  }

  // 🎯 CONFIGURAR EJERCICIO ACTUAL
  setCurrentExercise(exerciseType: ExerciseType): void {
    this.currentExercise = exerciseType;
    this.resetAnalysis();
    
    // ✅ NUEVO: Inicializar validación científica
    this.precisionValidator.startValidation();
    
    console.log(`🎯 Ejercicio configurado: ${exerciseType} con validación científica`);
  }

  // 🔄 ANÁLISIS PRINCIPAL MEJORADO
  analyzeFrame(
    pose: PoseKeypoints, 
    angles: BiomechanicalAngles
  ): {
    errors: PostureError[];
    phase: RepetitionPhase;
    repetitionCount: number;
    qualityScore: number;
    // ✅ NUEVOS: Métricas científicas
    precisionMetrics?: PrecisionMetrics;
    performanceMetrics?: PerformanceMetrics;
    scientificValidation?: {
      isWithinTargets: boolean;
      angularAccuracy: number;
      correlationCoefficient: number;
    };
  } {
    
    const frameStartTime = performance.now();
    
    if (!this.currentExercise) {
      return {
        errors: [],
        phase: RepetitionPhase.IDLE,
        repetitionCount: 0,
        qualityScore: 0
      };
    }

    // ✅ MEJORADO: Verificar validez con umbrales científicos
    if (!this.isPoseValidScientific(pose)) {
      return {
        errors: [],
        phase: RepetitionPhase.IDLE,
        repetitionCount: this.repetitionCounter,
        qualityScore: 0
      };
    }

    // ✅ NUEVO: Almacenar en historial para análisis científico
    this.storeFrameData(pose, angles);
    
    // ✅ MEJORADO: Suavizar datos con algoritmo científico
    const smoothedAngles = this.smoothAnglesScientific(angles);
    const smoothedPose = this.smoothPoseScientific(pose);
    
    // Detectar fase actual del ejercicio
    const newPhase = this.detectExercisePhase(smoothedAngles);
    const smoothedPhase = this.smoothPhase(newPhase);
    
    // ✅ MEJORADO: Detectar errores con algoritmos científicos
    const basicErrors = this.detectPostureErrors(smoothedPose, smoothedAngles);
    const scientificErrors = this.detectScientificErrors(smoothedPose, smoothedAngles);
    const allErrors = [...basicErrors, ...scientificErrors];
    
    // Contar repeticiones
    if (this.isRepetitionComplete(smoothedPhase)) {
      this.repetitionCounter++;
      console.log(`🔢 Repetición completada: ${this.repetitionCounter}`);
    }
    
    // ✅ MEJORADO: Calcular puntuación de calidad científica
    const qualityScore = this.calculateScientificQuality(allErrors, smoothedAngles, smoothedPose);
    
    this.currentPhase = smoothedPhase;
    
    // ✅ NUEVO: Validar precisión científica
    const frameEndTime = performance.now();
    this.precisionValidator.validateFrame(smoothedPose, smoothedAngles, frameStartTime);
    this.frameProcessingTimes.push(frameEndTime - frameStartTime);
    this.totalFramesProcessed++;
    
    // ✅ NUEVO: Obtener métricas cada 30 frames
    let precisionMetrics, performanceMetrics, scientificValidation;
    if (this.totalFramesProcessed % 30 === 0) {
      const validationReport = this.precisionValidator.getValidationReport();
      precisionMetrics = validationReport.precision;
      performanceMetrics = validationReport.performance;
      scientificValidation = {
        isWithinTargets: validationReport.isWithinTargets,
        angularAccuracy: validationReport.precision.angularAccuracy,
        correlationCoefficient: validationReport.precision.correlationCoefficient
      };
    }
    
    return {
      errors: allErrors,
      phase: smoothedPhase,
      repetitionCount: this.repetitionCounter,
      qualityScore: qualityScore,
      precisionMetrics,
      performanceMetrics,
      scientificValidation
    };
  }

  // ✅ NUEVO: Validez científica de la pose
  private isPoseValidScientific(pose: PoseKeypoints): boolean {
    const keyLandmarks = [
      pose.left_shoulder, pose.right_shoulder,
      pose.left_hip, pose.right_hip,
      pose.left_knee, pose.right_knee,
      pose.left_ankle, pose.right_ankle
    ];
    
    // ✅ Umbral científico más estricto
    const validLandmarks = keyLandmarks.filter(landmark => landmark.visibility > 0.7);
    const validityRatio = validLandmarks.length / keyLandmarks.length;
    
    // ✅ Verificar estabilidad temporal
    const isTemporallyStable = this.checkTemporalStability(pose);
    
    return validityRatio >= 0.75 && isTemporallyStable; // 75% de landmarks válidos
  }

  // ✅ NUEVO: Verificar estabilidad temporal
  private checkTemporalStability(pose: PoseKeypoints): boolean {
    if (this.poseHistory.length < 3) return true;
    
    const prevPose = this.poseHistory[this.poseHistory.length - 1];
    const keyPoints = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];
    
    let totalMovement = 0;
    let validComparisons = 0;
    
    keyPoints.forEach(pointName => {
      const current = (pose as any)[pointName];
      const previous = (prevPose as any)[pointName];
      
      if (current && previous && current.visibility > 0.7 && previous.visibility > 0.7) {
        const movement = Math.sqrt(
          Math.pow(current.x - previous.x, 2) + 
          Math.pow(current.y - previous.y, 2)
        );
        totalMovement += movement;
        validComparisons++;
      }
    });
    
    if (validComparisons === 0) return false;
    
    const avgMovement = totalMovement / validComparisons;
    return avgMovement < 0.1; // Máximo 10cm de movimiento entre frames
  }

  // ✅ NUEVO: Almacenar datos para análisis científico
  private storeFrameData(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    this.poseHistory.push(pose);
    this.angleHistory.push(angles);
    
    // Mantener ventana de validación
    if (this.poseHistory.length > this.VALIDATION_WINDOW) {
      this.poseHistory.shift();
    }
    if (this.angleHistory.length > this.VALIDATION_WINDOW) {
      this.angleHistory.shift();
    }
  }

  // ✅ MEJORADO: Suavizado científico de ángulos
  private smoothAnglesScientific(angles: BiomechanicalAngles): BiomechanicalAngles {
    if (this.angleHistory.length < this.SMOOTHING_WINDOW) {
      return angles;
    }
    
    const recentAngles = this.angleHistory.slice(-this.SMOOTHING_WINDOW);
    const smoothed: BiomechanicalAngles = {};
    
    // ✅ Aplicar filtro Gaussiano ponderado
    const weights = this.generateGaussianWeights(this.SMOOTHING_WINDOW);
    
    Object.keys(angles).forEach(key => {
      const angleKey = key as keyof BiomechanicalAngles;
      const values = recentAngles.map(frame => frame[angleKey]).filter(val => val !== undefined) as number[];
      
      if (values.length === this.SMOOTHING_WINDOW) {
        let weightedSum = 0;
        let weightSum = 0;
        
        values.forEach((value, index) => {
          const weight = weights[index];
          weightedSum += value * weight;
          weightSum += weight;
        });
        
        smoothed[angleKey] = weightSum > 0 ? weightedSum / weightSum : angles[angleKey];
      } else {
        smoothed[angleKey] = angles[angleKey];
      }
    });
    
    return smoothed;
  }

  // ✅ NUEVO: Suavizado científico de poses
  private smoothPoseScientific(pose: PoseKeypoints): PoseKeypoints {
    if (this.poseHistory.length < this.SMOOTHING_WINDOW) {
      return pose;
    }
    
    const recentPoses = this.poseHistory.slice(-this.SMOOTHING_WINDOW);
    const smoothed: any = {};
    const weights = this.generateGaussianWeights(this.SMOOTHING_WINDOW);
    
    Object.keys(pose).forEach(landmarkKey => {
      const landmark = (pose as any)[landmarkKey];
      if (landmark && typeof landmark === 'object' && 'x' in landmark) {
        const landmarkData = recentPoses.map(p => (p as any)[landmarkKey]).filter(l => l && l.visibility > 0.5);
        
        if (landmarkData.length === this.SMOOTHING_WINDOW) {
          let x = 0, y = 0, z = 0, visibility = 0, weightSum = 0;
          
          landmarkData.forEach((data, index) => {
            const weight = weights[index];
            x += data.x * weight;
            y += data.y * weight;
            z += data.z * weight;
            visibility += data.visibility * weight;
            weightSum += weight;
          });
          
          if (weightSum > 0) {
            smoothed[landmarkKey] = {
              x: x / weightSum,
              y: y / weightSum,
              z: z / weightSum,
              visibility: visibility / weightSum
            };
          } else {
            smoothed[landmarkKey] = landmark;
          }
        } else {
          smoothed[landmarkKey] = landmark;
        }
      }
    });
    
    return smoothed as PoseKeypoints;
  }

  // ✅ NUEVO: Generar pesos Gaussianos
  private generateGaussianWeights(windowSize: number): number[] {
    const weights: number[] = [];
    const sigma = windowSize / 3; // Desviación estándar
    const center = (windowSize - 1) / 2;
    
    for (let i = 0; i < windowSize; i++) {
      const distance = Math.abs(i - center);
      const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
      weights.push(weight);
    }
    
    return weights;
  }

  // ✅ MEJORADO: Detección de errores científicos
  private detectScientificErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    if (!this.currentExercise) return [];

    const exerciseConfig = ADVANCED_EXERCISE_DEFINITIONS[this.currentExercise];
    const errors: PostureError[] = [];
    const now = Date.now();

    // ✅ Aplicar algoritmos científicos específicos
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        errors.push(...this.detectSquatScientificErrors(pose, angles, now));
        break;
      case ExerciseType.PUSHUPS:
        errors.push(...this.detectPushupScientificErrors(pose, angles, now));
        break;
      case ExerciseType.LUNGES:
        errors.push(...this.detectLungeScientificErrors(pose, angles, now));
        break;
      case ExerciseType.PLANK:
        errors.push(...this.detectPlankScientificErrors(pose, angles, now));
        break;
      case ExerciseType.BICEP_CURLS:
        errors.push(...this.detectBicepCurlScientificErrors(pose, angles, now));
        break;
    }

    return errors;
  }

  // ✅ NUEVO: Detección científica para sentadillas
  private detectSquatScientificErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    
    // 🔬 Butt Wink científico
    if (AdvancedErrorDetector.detectButtWink(pose, angles)) {
      if (this.checkErrorCooldown(PostureErrorType.BUTT_WINK, timestamp)) {
        errors.push({
          type: PostureErrorType.BUTT_WINK,
          severity: 8,
          description: 'Pérdida de curvatura lumbar (butt wink científico)',
          recommendation: 'Mejora movilidad de tobillo y cadera, fortalece core',
          affectedJoints: ['spine', 'pelvis', 'hip'],
          confidence: 0.92,
          timestamp
        });
      }
    }
    
    // 🔬 Heel Rise científico
    if (AdvancedErrorDetector.detectHeelRise(pose, angles)) {
      if (this.checkErrorCooldown(PostureErrorType.HEEL_RISE, timestamp)) {
        errors.push({
          type: PostureErrorType.HEEL_RISE,
          severity: 7,
          description: 'Levantamiento de talones detectado científicamente',
          recommendation: 'Mejora dorsiflexión de tobillo, considera calzado especializado',
          affectedJoints: ['left_ankle', 'right_ankle'],
          confidence: 0.88,
          timestamp
        });
      }
    }
    
    // 🔬 Knee Valgus dinámico
    if (AdvancedErrorDetector.detectDynamicKneeValgus(pose, angles)) {
      if (this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
        errors.push({
          type: PostureErrorType.KNEE_VALGUS,
          severity: 9,
          description: 'Valgo dinámico de rodillas detectado',
          recommendation: 'Fortalece glúteos y rotadores externos de cadera',
          affectedJoints: ['left_knee', 'right_knee', 'left_hip', 'right_hip'],
          confidence: 0.89,
          timestamp
        });
      }
    }
    
    // 🔬 Profundidad con análisis biomecánico
    const thighParallelAngle = this.calculateThighParallelAngle(pose);
    if (thighParallelAngle > BIOMECHANICAL_THRESHOLDS.SQUAT_KNEE_RANGE.critical) {
      if (this.checkErrorCooldown(PostureErrorType.SHALLOW_DEPTH, timestamp)) {
        errors.push({
          type: PostureErrorType.SHALLOW_DEPTH,
          severity: 6,
          description: `Profundidad insuficiente: ${thighParallelAngle.toFixed(1)}° sobre paralelo`,
          recommendation: 'Aumenta profundidad gradualmente manteniendo técnica',
          affectedJoints: ['left_knee', 'right_knee'],
          confidence: 0.94,
          timestamp
        });
      }
    }
    
    return errors;
  }

  // ✅ NUEVO: Detección científica para flexiones
  private detectPushupScientificErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    
    // 🔬 Análisis de línea corporal
    const bodyLineDeviation = this.calculateBodyLineDeviation(pose);
    if (bodyLineDeviation > 0.05) { // 5cm de desviación
      const errorType = bodyLineDeviation > 0 ? PostureErrorType.SAGGING_HIPS : PostureErrorType.RAISED_HIPS;
      
      if (this.checkErrorCooldown(errorType, timestamp)) {
        errors.push({
          type: errorType,
          severity: 8,
          description: `Desviación de línea corporal: ${(bodyLineDeviation * 100).toFixed(1)}cm`,
          recommendation: 'Mantén línea recta desde cabeza hasta talones',
          affectedJoints: ['spine', 'hip', 'core'],
          confidence: 0.91,
          timestamp
        });
      }
    }
    
    // 🔬 Análisis de rango de movimiento
    const chestToFloorDistance = this.calculateChestToFloorDistance(pose);
    if (chestToFloorDistance > 0.08 && this.currentPhase === RepetitionPhase.BOTTOM) { // 8cm del suelo
      if (this.checkErrorCooldown(PostureErrorType.PARTIAL_ROM, timestamp)) {
        errors.push({
          type: PostureErrorType.PARTIAL_ROM,
          severity: 5,
          description: `ROM incompleto: ${(chestToFloorDistance * 100).toFixed(1)}cm del suelo`,
          recommendation: 'Baja hasta que pecho casi toque el suelo',
          affectedJoints: ['left_elbow', 'right_elbow'],
          confidence: 0.87,
          timestamp
        });
      }
    }
    
    return errors;
  }

  // ✅ NUEVO: Detección científica para estocadas
  private detectLungeScientificErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    
    // 🔬 Análisis de desplazamiento de rodilla
    const kneeForwardDisplacement = this.calculateKneeForwardDisplacement(pose);
    if (kneeForwardDisplacement > 0.05) { // 5cm sobre el pie
      if (this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
        errors.push({
          type: PostureErrorType.KNEE_VALGUS,
          severity: 7,
          description: `Rodilla muy adelantada: ${(kneeForwardDisplacement * 100).toFixed(1)}cm`,
          recommendation: 'Da un paso más largo, mantén peso en talón',
          affectedJoints: ['front_knee'],
          confidence: 0.86,
          timestamp
        });
      }
    }
    
    return errors;
  }

  // ✅ NUEVO: Detección científica para plancha
  private detectPlankScientificErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    
    // 🔬 Análisis de alineación de codos
    const elbowShoulderMisalignment = this.calculateElbowShoulderMisalignment(pose);
    if (elbowShoulderMisalignment > 0.05) { // 5cm de desalineación
      if (this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
        errors.push({
          type: PostureErrorType.POOR_ALIGNMENT,
          severity: 5,
          description: `Codos desalineados: ${(elbowShoulderMisalignment * 100).toFixed(1)}cm`,
          recommendation: 'Posiciona codos directamente bajo los hombros',
          affectedJoints: ['left_elbow', 'right_elbow'],
          confidence: 0.89,
          timestamp
        });
      }
    }
    
    return errors;
  }

  // ✅ NUEVO: Detección científica para curl de bíceps
  private detectBicepCurlScientificErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    
    // 🔬 Análisis de velocidad angular
    const angularVelocity = this.calculateAngularVelocity(angles, 'elbow');
    if (angularVelocity > 3.0) { // rad/s
      if (this.checkErrorCooldown(PostureErrorType.EXCESSIVE_SPEED, timestamp)) {
        errors.push({
          type: PostureErrorType.EXCESSIVE_SPEED,
          severity: 6,
          description: `Velocidad excesiva: ${angularVelocity.toFixed(1)} rad/s`,
          recommendation: 'Controla velocidad, usa solo fuerza de bíceps',
          affectedJoints: ['left_elbow', 'right_elbow'],
          confidence: 0.83,
          timestamp
        });
      }
    }
    
    // 🔬 Estabilidad de codos
    const elbowDisplacement = this.calculateElbowDisplacement(pose);
    if (elbowDisplacement > 0.03) { // 3cm de movimiento
      if (this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
        errors.push({
          type: PostureErrorType.POOR_ALIGNMENT,
          severity: 5,
          description: `Codos inestables: ${(elbowDisplacement * 100).toFixed(1)}cm`,
          recommendation: 'Mantén codos fijos pegados al torso',
          affectedJoints: ['left_elbow', 'right_elbow'],
          confidence: 0.91,
          timestamp
        });
      }
    }
    
    return errors;
  }

  // ✅ MEJORADO: Verificar cooldown de errores
  private checkErrorCooldown(errorType: PostureErrorType, timestamp: number): boolean {
    const lastDetection = this.lastErrorTimestamps.get(errorType) || 0;
    if (timestamp - lastDetection >= this.ERROR_COOLDOWN) {
      this.lastErrorTimestamps.set(errorType, timestamp);
      return true;
    }
    return false;
  }

  // ✅ MEJORADO: Calcular puntuación de calidad científica
  private calculateScientificQuality(errors: PostureError[], angles: BiomechanicalAngles, pose: PoseKeypoints): number {
    if (!this.currentExercise) return 0;

    let baseScore = 100;

    // ✅ Penalización científica por errores
    errors.forEach(error => {
      const scientificPenalty = this.calculateScientificPenalty(error);
      baseScore -= scientificPenalty;
    });

    // ✅ Bonificación por precisión biomecánica
    const biomechanicalBonus = this.calculateBiomechanicalBonus(angles);
    baseScore += biomechanicalBonus;

    // ✅ Bonificación por estabilidad temporal
    const stabilityBonus = this.calculateStabilityBonus(pose);
    baseScore += stabilityBonus;

    // ✅ Bonificación por rango de movimiento óptimo
    const romBonus = this.calculateOptimalROMBonus(angles);
    baseScore += romBonus;

    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));
    
    this.qualityHistory.push(finalScore);
    if (this.qualityHistory.length > 50) { // Aumentado para mejor análisis
      this.qualityHistory.shift();
    }
    
    return finalScore;
  }

  // ✅ NUEVO: Calcular penalización científica
  private calculateScientificPenalty(error: PostureError): number {
    const basePenalty = error.severity * 2;
    const confidenceFactor = error.confidence;
    const scientificFactor = this.getScientificFactor(error.type);
    
    return basePenalty * confidenceFactor * scientificFactor;
  }

  // ✅ NUEVO: Factor científico por tipo de error
  private getScientificFactor(errorType: PostureErrorType): number {
    const scientificFactors: { [key in PostureErrorType]: number } = {
      [PostureErrorType.KNEE_VALGUS]: 1.5,        // Muy importante biomecánicamente
      [PostureErrorType.BUTT_WINK]: 1.4,          // Riesgo de lesión lumbar
      [PostureErrorType.FORWARD_LEAN]: 1.2,       // Altera patrones de movimiento
      [PostureErrorType.HEEL_RISE]: 1.3,          // Afecta cadena cinética
      [PostureErrorType.SAGGING_HIPS]: 1.3,       // Compromete estabilidad
      [PostureErrorType.RAISED_HIPS]: 1.1,        // Reduce activación muscular
      [PostureErrorType.SHALLOW_DEPTH]: 1.0,      // Limita beneficios
      [PostureErrorType.PARTIAL_ROM]: 1.0,        // Subóptimo pero no peligroso
      [PostureErrorType.ELBOW_FLARE]: 1.2,        // Riesgo de impingement
      [PostureErrorType.HEAD_POSITION]: 0.8,      // Menos crítico
      [PostureErrorType.ASYMMETRY]: 1.3,          // Importante para equilibrio
      [PostureErrorType.POOR_ALIGNMENT]: 1.1,     // Afecta eficiencia
      [PostureErrorType.INSUFFICIENT_DEPTH]: 1.0, // Similar a shallow depth
      [PostureErrorType.EXCESSIVE_SPEED]: 1.2     // Reduce control motor
    };
    
    return scientificFactors[errorType] || 1.0;
  }

  // ✅ Métodos auxiliares de cálculo biomecánico continuarán...
  
  // (Los métodos básicos existentes se mantienen igual)
  private detectExercisePhase(angles: BiomechanicalAngles): RepetitionPhase {
    if (!this.currentExercise) return RepetitionPhase.IDLE;

    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.detectSquatPhase(angles);
      case ExerciseType.PUSHUPS:
        return this.detectPushupPhase(angles);
      case ExerciseType.PLANK:
        return RepetitionPhase.BOTTOM;
      default:
        return RepetitionPhase.IDLE;
    }
  }

  private detectSquatPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;
    
    if (avgKneeAngle > 160) {
      return RepetitionPhase.TOP;
    } else if (avgKneeAngle < 90) {
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
        const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
        const prevAvgKnee = (prevLeftKnee + prevRightKnee) / 2;
        
        return avgKneeAngle < prevAvgKnee ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
      }
      return RepetitionPhase.ECCENTRIC;
    }
  }

  private smoothPhase(newPhase: RepetitionPhase): RepetitionPhase {
    this.phaseHistory.push(newPhase);
    
    if (this.phaseHistory.length > this.SMOOTHING_WINDOW) {
      this.phaseHistory.shift();
    }
    
    const phaseCounts = new Map<RepetitionPhase, number>();
    this.phaseHistory.forEach(phase => {
      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1);
    });
    
    let mostCommonPhase = newPhase;
    let maxCount = 0;
    
    phaseCounts.forEach((count, phase) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonPhase = phase;
      }
    });
    
    return mostCommonPhase;
  }

  private isRepetitionComplete(currentPhase: RepetitionPhase): boolean {
    return this.currentPhase === RepetitionPhase.CONCENTRIC && currentPhase === RepetitionPhase.TOP;
  }

  private detectPostureErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    if (!this.currentExercise) return [];

    const exerciseConfig = ADVANCED_EXERCISE_DEFINITIONS[this.currentExercise];
    const errors: PostureError[] = [];
    const now = Date.now();

    const mainErrorRules = exerciseConfig.errorDetectionRules.slice(0, 2);

    for (const rule of mainErrorRules) {
      const lastDetection = this.lastErrorTimestamps.get(rule.errorType) || 0;
      if (now - lastDetection < this.ERROR_COOLDOWN) {
        continue;
      }

      const errorDetected = this.evaluateErrorCondition(rule, pose, angles);
      
      if (errorDetected) {
        const confidence = this.calculateErrorConfidence(rule, pose);
        
        if (confidence > 0.7) {
          errors.push({
            type: rule.errorType,
            severity: rule.severity,
            description: rule.message,
            recommendation: rule.recommendation,
            affectedJoints: this.getAffectedJoints(rule.errorType),
            confidence: confidence,
            timestamp: now
          });
          
          this.lastErrorTimestamps.set(rule.errorType, now);
          break;
        }
      }
    }

    return errors;
  }

  private evaluateErrorCondition(rule: any, pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    switch (rule.errorType) {
      case PostureErrorType.KNEE_VALGUS:
        return this.detectKneeValgus(pose, rule.threshold);
      case PostureErrorType.FORWARD_LEAN:
        return (angles.spine_angle || 90) < rule.threshold;
      case PostureErrorType.SHALLOW_DEPTH:
        const avgKneeAngle = ((angles.left_knee_angle || 0) + (angles.right_knee_angle || 0)) / 2;
        return avgKneeAngle > rule.threshold && this.currentPhase === RepetitionPhase.BOTTOM;
      case PostureErrorType.SAGGING_HIPS:
        const avgHipAngle = ((angles.left_hip_angle || 0) + (angles.right_hip_angle || 0)) / 2;
        return avgHipAngle < rule.threshold;
      case PostureErrorType.RAISED_HIPS:
        const avgHipAngle2 = ((angles.left_hip_angle || 0) + (angles.right_hip_angle || 0)) / 2;
        return avgHipAngle2 > rule.threshold;
      default:
        return false;
    }
  }

  private detectKneeValgus(pose: PoseKeypoints, threshold: number): boolean {
    const kneeDistance = Math.abs(pose.left_knee.x - pose.right_knee.x);
    const hipDistance = Math.abs(pose.left_hip.x - pose.right_hip.x);
    
    if (hipDistance === 0) return false;
    
    const kneeToHipRatio = kneeDistance / hipDistance;
    return kneeToHipRatio < threshold;
  }

  private getAffectedJoints(errorType: PostureErrorType): string[] {
    const jointMap: { [key in PostureErrorType]: string[] } = {
      [PostureErrorType.KNEE_VALGUS]: ['left_knee', 'right_knee'],
      [PostureErrorType.FORWARD_LEAN]: ['spine', 'hip'],
      [PostureErrorType.HEEL_RISE]: ['left_ankle', 'right_ankle'],
      [PostureErrorType.BUTT_WINK]: ['spine', 'pelvis'],
      [PostureErrorType.SHALLOW_DEPTH]: ['left_knee', 'right_knee'],
      [PostureErrorType.SAGGING_HIPS]: ['hip', 'spine'],
      [PostureErrorType.RAISED_HIPS]: ['hip', 'spine'],
      [PostureErrorType.PARTIAL_ROM]: ['left_elbow', 'right_elbow'],
      [PostureErrorType.ELBOW_FLARE]: ['left_elbow', 'right_elbow'],
      [PostureErrorType.HEAD_POSITION]: ['neck'],
      [PostureErrorType.ASYMMETRY]: ['left_shoulder', 'right_shoulder'],
      [PostureErrorType.POOR_ALIGNMENT]: ['spine'],
      [PostureErrorType.INSUFFICIENT_DEPTH]: ['left_knee', 'right_knee'],
      [PostureErrorType.EXCESSIVE_SPEED]: ['all']
    };

    return jointMap[errorType] || [];
  }

  private calculateErrorConfidence(rule: any, pose: PoseKeypoints): number {
    const affectedJoints = this.getAffectedJoints(rule.errorType);
    let totalVisibility = 0;
    let jointCount = 0;

    affectedJoints.forEach(joint => {
      const landmark = this.getLandmarkByJoint(joint, pose);
      if (landmark) {
        totalVisibility += landmark.visibility;
        jointCount++;
      }
    });

    return jointCount > 0 ? totalVisibility / jointCount : 0;
  }

  private getLandmarkByJoint(jointName: string, pose: PoseKeypoints): any {
    const jointMap: { [key: string]: any } = {
      'left_knee': pose.left_knee,
      'right_knee': pose.right_knee,
      'left_hip': pose.left_hip,
      'right_hip': pose.right_hip,
      'left_ankle': pose.left_ankle,
      'right_ankle': pose.right_ankle,
      'left_elbow': pose.left_elbow,
      'right_elbow': pose.right_elbow,
      'left_shoulder': pose.left_shoulder,
      'right_shoulder': pose.right_shoulder,
      'spine': pose.left_shoulder,
      'neck': pose.nose
    };

    return jointMap[jointName];
  }

  // ✅ NUEVOS MÉTODOS DE CÁLCULO BIOMECÁNICO

  private calculateThighParallelAngle(pose: PoseKeypoints): number {
    // Calcular ángulo del muslo respecto a horizontal
    const leftThighAngle = Math.atan2(
      pose.left_knee.y - pose.left_hip.y,
      pose.left_knee.x - pose.left_hip.x
    ) * 180 / Math.PI;
    
    const rightThighAngle = Math.atan2(
      pose.right_knee.y - pose.right_hip.y,
      pose.right_knee.x - pose.right_hip.x
    ) * 180 / Math.PI;
    
    return (Math.abs(leftThighAngle) + Math.abs(rightThighAngle)) / 2;
  }

  private calculateBodyLineDeviation(pose: PoseKeypoints): number {
    // Calcular desviación de la línea corporal ideal
    const head = pose.nose;
    const shoulderMid = {
      x: (pose.left_shoulder.x + pose.right_shoulder.x) / 2,
      y: (pose.left_shoulder.y + pose.right_shoulder.y) / 2
    };
    const hipMid = {
      x: (pose.left_hip.x + pose.right_hip.x) / 2,
      y: (pose.left_hip.y + pose.right_hip.y) / 2
    };
    const ankleMid = {
      x: (pose.left_ankle.x + pose.right_ankle.x) / 2,
      y: (pose.left_ankle.y + pose.right_ankle.y) / 2
    };
    
    // Calcular línea ideal desde hombros hasta tobillos
    const idealSlope = (ankleMid.y - shoulderMid.y) / (ankleMid.x - shoulderMid.x);
    const idealIntercept = shoulderMid.y - idealSlope * shoulderMid.x;
    
    // Calcular desviación de caderas de la línea ideal
    const idealHipY = idealSlope * hipMid.x + idealIntercept;
    return hipMid.y - idealHipY; // Positivo = caderas altas, Negativo = caderas bajas
  }

  private calculateChestToFloorDistance(pose: PoseKeypoints): number {
    // Estimar distancia del pecho al suelo
    const chestY = (pose.left_shoulder.y + pose.right_shoulder.y) / 2;
    const floorReference = Math.max(pose.left_ankle.y, pose.right_ankle.y);
    
    // Normalizar considerando altura de la persona
    const personHeight = Math.abs(pose.nose.y - floorReference);
    const chestToFloor = Math.abs(chestY - floorReference);
    
    return chestToFloor / personHeight; // Ratio normalizado
  }

  private calculateKneeForwardDisplacement(pose: PoseKeypoints): number {
    // Calcular desplazamiento hacia adelante de la rodilla respecto al pie
    const leftDisplacement = Math.abs(pose.left_knee.x - pose.left_ankle.x);
    const rightDisplacement = Math.abs(pose.right_knee.x - pose.right_ankle.x);
    
    return Math.max(leftDisplacement, rightDisplacement);
  }

  private calculateElbowShoulderMisalignment(pose: PoseKeypoints): number {
    // Calcular desalineación entre codos y hombros
    const leftMisalignment = Math.abs(pose.left_elbow.x - pose.left_shoulder.x);
    const rightMisalignment = Math.abs(pose.right_elbow.x - pose.right_shoulder.x);
    
    return Math.max(leftMisalignment, rightMisalignment);
  }

  private calculateAngularVelocity(angles: BiomechanicalAngles, joint: string): number {
    if (this.angleHistory.length < 2) return 0;
    
    const currentAngle = this.getCurrentJointAngle(angles, joint);
    const previousAngle = this.getCurrentJointAngle(this.angleHistory[this.angleHistory.length - 2], joint);
    
    const deltaAngle = Math.abs(currentAngle - previousAngle) * Math.PI / 180; // Convertir a radianes
    const deltaTime = 1/30; // Asumiendo 30 FPS
    
    return deltaAngle / deltaTime;
  }

  private getCurrentJointAngle(angles: BiomechanicalAngles, joint: string): number {
    switch (joint) {
      case 'elbow':
        return ((angles.left_elbow_angle || 0) + (angles.right_elbow_angle || 0)) / 2;
      case 'knee':
        return ((angles.left_knee_angle || 0) + (angles.right_knee_angle || 0)) / 2;
      case 'hip':
        return ((angles.left_hip_angle || 0) + (angles.right_hip_angle || 0)) / 2;
      default:
        return 0;
    }
  }

  private calculateElbowDisplacement(pose: PoseKeypoints): number {
    if (this.poseHistory.length < 2) return 0;
    
    const prevPose = this.poseHistory[this.poseHistory.length - 2];
    
    const leftDisplacement = Math.sqrt(
      Math.pow(pose.left_elbow.x - prevPose.left_elbow.x, 2) +
      Math.pow(pose.left_elbow.y - prevPose.left_elbow.y, 2)
    );
    
    const rightDisplacement = Math.sqrt(
      Math.pow(pose.right_elbow.x - prevPose.right_elbow.x, 2) +
      Math.pow(pose.right_elbow.y - prevPose.right_elbow.y, 2)
    );
    
    return Math.max(leftDisplacement, rightDisplacement);
  }

  private calculateBiomechanicalBonus(angles: BiomechanicalAngles): number {
    if (!this.currentExercise) return 0;

    const exerciseConfig = ADVANCED_EXERCISE_DEFINITIONS[this.currentExercise];
    let bonus = 0;

    Object.keys(exerciseConfig.angleThresholds).forEach(angleKey => {
      const threshold = exerciseConfig.angleThresholds[angleKey];
      const currentAngle = this.getAngleValue(angleKey, angles);
      
      if (currentAngle !== null) {
        const idealDistance = Math.abs(currentAngle - threshold.ideal);
        if (idealDistance < 5) {
          bonus += 5; // Bonus mayor para precisión científica
        } else if (idealDistance < 10) {
          bonus += 2;
        }
      }
    });

    return Math.min(bonus, 15); // Máximo 15 puntos de bonus
  }

  private calculateStabilityBonus(pose: PoseKeypoints): number {
    if (this.poseHistory.length < 5) return 0;
    
    const recentPoses = this.poseHistory.slice(-5);
    const keyLandmarks = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];
    
    let stabilityScore = 0;
    let validComparisons = 0;
    
    keyLandmarks.forEach(landmarkKey => {
      const movements = [];
      
      for (let i = 1; i < recentPoses.length; i++) {
        const current = (recentPoses[i] as any)[landmarkKey];
        const previous = (recentPoses[i-1] as any)[landmarkKey];
        
        if (current && previous && current.visibility > 0.7 && previous.visibility > 0.7) {
          const movement = Math.sqrt(
            Math.pow(current.x - previous.x, 2) + 
            Math.pow(current.y - previous.y, 2)
          );
          movements.push(movement);
        }
      }
      
      if (movements.length > 0) {
        const avgMovement = movements.reduce((a, b) => a + b, 0) / movements.length;
        const stability = Math.max(0, 10 - avgMovement * 100); // Menos movimiento = más bonus
        stabilityScore += stability;
        validComparisons++;
      }
    });
    
    return validComparisons > 0 ? stabilityScore / validComparisons : 0;
  }

  private calculateOptimalROMBonus(angles: BiomechanicalAngles): number {
    if (!this.currentExercise) return 0;
    
    let bonus = 0;
    
    // Bonus por usar rango completo sin errores
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        const avgKneeAngle = ((angles.left_knee_angle || 0) + (angles.right_knee_angle || 0)) / 2;
        if (avgKneeAngle < 100 && this.currentPhase === RepetitionPhase.BOTTOM) {
          bonus += 5; // Bonus por profundidad adecuada
        }
        break;
        
      case ExerciseType.PUSHUPS:
        const avgElbowAngle = ((angles.left_elbow_angle || 0) + (angles.right_elbow_angle || 0)) / 2;
        if (avgElbowAngle < 90 && this.currentPhase === RepetitionPhase.BOTTOM) {
          bonus += 5; // Bonus por rango completo
        }
        break;
    }
    
    return bonus;
  }

  private getAngleValue(angleKey: string, angles: BiomechanicalAngles): number | null {
    switch (angleKey) {
      case 'knee_angle':
        const leftKnee = angles.left_knee_angle || 0;
        const rightKnee = angles.right_knee_angle || 0;
        return (leftKnee + rightKnee) / 2;
      case 'hip_angle':
        const leftHip = angles.left_hip_angle || 0;
        const rightHip = angles.right_hip_angle || 0;
        return (leftHip + rightHip) / 2;
      case 'elbow_angle':
        const leftElbow = angles.left_elbow_angle || 0;
        const rightElbow = angles.right_elbow_angle || 0;
        return (leftElbow + rightElbow) / 2;
      case 'spine_angle':
        return angles.spine_angle || null;
      default:
        return null;
    }
  }

  // 🔄 REINICIAR ANÁLISIS
  private resetAnalysis(): void {
    this.currentPhase = RepetitionPhase.IDLE;
    this.repetitionCounter = 0;
    this.angleHistory = [];
    this.phaseHistory = [];
    this.poseHistory = [];
    this.qualityHistory = [];
    this.frameProcessingTimes = [];
    this.scientificErrors = [];
    this.lastErrorTimestamps.clear();
    this.totalFramesProcessed = 0;
    this.sessionStartTime = performance.now();
    console.log('🔄 Análisis biomecánico científico reiniciado');
  }

  // 📊 OBTENER ESTADÍSTICAS CIENTÍFICAS
  getEnhancedSessionStats(): {
    repetitions: number;
    averageQuality: number;
    currentPhase: RepetitionPhase;
    scientificMetrics: {
      totalFramesProcessed: number;
      averageProcessingTime: number;
      qualityTrend: 'improving' | 'stable' | 'declining';
      biomechanicalAccuracy: number;
    };
    validationReport?: any;
  } {
    const avgQuality = this.qualityHistory.length > 0 
      ? Math.round(this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length)
      : 0;

    // Calcular tendencia de calidad
    let qualityTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (this.qualityHistory.length >= 10) {
      const recent = this.qualityHistory.slice(-5);
      const previous = this.qualityHistory.slice(-10, -5);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
      
      if (recentAvg > previousAvg + 5) {
        qualityTrend = 'improving';
      } else if (recentAvg < previousAvg - 5) {
        qualityTrend = 'declining';
      }
    }

    // Calcular tiempo promedio de procesamiento
    const avgProcessingTime = this.frameProcessingTimes.length > 0
      ? this.frameProcessingTimes.reduce((a, b) => a + b, 0) / this.frameProcessingTimes.length
      : 0;

    return {
      repetitions: this.repetitionCounter,
      averageQuality: avgQuality,
      currentPhase: this.currentPhase,
      scientificMetrics: {
        totalFramesProcessed: this.totalFramesProcessed,
        averageProcessingTime: Math.round(avgProcessingTime * 100) / 100,
        qualityTrend,
        biomechanicalAccuracy: avgQuality // Simplificado por ahora
      },
      validationReport: this.precisionValidator.getValidationReport()
    };
  }

  // 🔬 OBTENER REPORTE CIENTÍFICO COMPLETO
  getScientificReport(): {
    sessionDuration: number;
    frameRate: number;
    errorDistribution: { [key: string]: number };
    biomechanicalAnalysis: {
      averageAngularAccuracy: number;
      movementStability: number;
      temporalConsistency: number;
    };
    recommendations: string[];
  } {
    const sessionDuration = (performance.now() - this.sessionStartTime) / 1000;
    const frameRate = this.totalFramesProcessed / sessionDuration;
    
    // Distribución de errores
    const errorDistribution: { [key: string]: number } = {};
    this.scientificErrors.forEach(error => {
      errorDistribution[error.type] = (errorDistribution[error.type] || 0) + 1;
    });
    
    // Análisis biomecánico
    const validationReport = this.precisionValidator.getValidationReport();
    
    // Recomendaciones basadas en datos
    const recommendations: string[] = [];
    
    if (validationReport.precision.angularAccuracy < 85) {
      recommendations.push('Mejorar estabilidad postural para mayor precisión angular');
    }
    
    if (validationReport.performance.fps < 25) {
      recommendations.push('Optimizar rendimiento del dispositivo para mejor detección');
    }
    
    if (this.qualityHistory.length > 0) {
      const avgQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
      if (avgQuality < 70) {
        recommendations.push('Enfocarse en técnica básica antes de aumentar intensidad');
      }
    }
    
    return {
      sessionDuration: Math.round(sessionDuration),
      frameRate: Math.round(frameRate),
      errorDistribution,
      biomechanicalAnalysis: {
        averageAngularAccuracy: validationReport.precision.angularAccuracy,
        movementStability: validationReport.precision.frameStability,
        temporalConsistency: validationReport.precision.temporalConsistency
      },
      recommendations
    };
  }
  // ✅ MÉTODOS FALTANTES PARA AGREGAR AL EnhancedBiomechanicsAnalyzer
// Agrega estos métodos al final de la clase, antes del método cleanup()

// 🔄 DETECCIÓN DE FASE DE FLEXIONES
private detectPushupPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const leftElbow = angles.left_elbow_angle || 180;
  const rightElbow = angles.right_elbow_angle || 180;
  const avgElbowAngle = (leftElbow + rightElbow) / 2;
  
  if (avgElbowAngle > 160) {
    return RepetitionPhase.TOP;
  } else if (avgElbowAngle < 90) {
    return RepetitionPhase.BOTTOM;
  } else {
    if (this.angleHistory.length >= 2) {
      const prevLeftElbow = this.angleHistory[this.angleHistory.length - 2].left_elbow_angle || 180;
      const prevRightElbow = this.angleHistory[this.angleHistory.length - 2].right_elbow_angle || 180;
      const prevAvgElbow = (prevLeftElbow + prevRightElbow) / 2;
      
      return avgElbowAngle < prevAvgElbow ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
    }
    return RepetitionPhase.ECCENTRIC;
  }
}

// 🦵 DETECCIÓN DE FASE DE ESTOCADAS
private detectLungePhase(angles: BiomechanicalAngles): RepetitionPhase {
  // Para estocadas, usar el promedio de ambas rodillas
  const leftKnee = angles.left_knee_angle || 180;
  const rightKnee = angles.right_knee_angle || 180;
  const avgKneeAngle = (leftKnee + rightKnee) / 2;
  
  if (avgKneeAngle > 150) {
    return RepetitionPhase.TOP;
  } else if (avgKneeAngle < 100) {
    return RepetitionPhase.BOTTOM;
  } else {
    if (this.angleHistory.length >= 2) {
      const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
      const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
      const prevAvgKnee = (prevLeftKnee + prevRightKnee) / 2;
      
      return avgKneeAngle < prevAvgKnee ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
    }
    return RepetitionPhase.ECCENTRIC;
  }
}

// 💪 DETECCIÓN DE FASE DE CURL DE BÍCEPS
private detectBicepCurlPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const leftElbow = angles.left_elbow_angle || 180;
  const rightElbow = angles.right_elbow_angle || 180;
  const avgElbowAngle = (leftElbow + rightElbow) / 2;
  
  // Para curl de bíceps, el rango es más específico
  if (avgElbowAngle > 150) {
    return RepetitionPhase.BOTTOM; // Extensión completa
  } else if (avgElbowAngle < 50) {
    return RepetitionPhase.TOP; // Flexión completa
  } else {
    if (this.angleHistory.length >= 2) {
      const prevLeftElbow = this.angleHistory[this.angleHistory.length - 2].left_elbow_angle || 180;
      const prevRightElbow = this.angleHistory[this.angleHistory.length - 2].right_elbow_angle || 180;
      const prevAvgElbow = (prevLeftElbow + prevRightElbow) / 2;
      
      return avgElbowAngle < prevAvgElbow ? RepetitionPhase.CONCENTRIC : RepetitionPhase.ECCENTRIC;
    }
    return RepetitionPhase.CONCENTRIC;
  }
}



// 🏋️ DETECCIÓN DE FASE DE PESO MUERTO (BÁSICA)
private detectDeadliftPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const leftHip = angles.left_hip_angle || 180;
  const rightHip = angles.right_hip_angle || 180;
  const avgHipAngle = (leftHip + rightHip) / 2;
  
  if (avgHipAngle > 160) {
    return RepetitionPhase.TOP;
  } else if (avgHipAngle < 90) {
    return RepetitionPhase.BOTTOM;
  } else {
    if (this.angleHistory.length >= 2) {
      const prevLeftHip = this.angleHistory[this.angleHistory.length - 2].left_hip_angle || 180;
      const prevRightHip = this.angleHistory[this.angleHistory.length - 2].right_hip_angle || 180;
      const prevAvgHip = (prevLeftHip + prevRightHip) / 2;
      
      return avgHipAngle < prevAvgHip ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
    }
    return RepetitionPhase.ECCENTRIC;
  }
}

// 🏋️ DETECCIÓN DE FASE DE PRESS DE BANCA (BÁSICA)
private detectBenchPressPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const leftElbow = angles.left_elbow_angle || 180;
  const rightElbow = angles.right_elbow_angle || 180;
  const avgElbowAngle = (leftElbow + rightElbow) / 2;
  
  if (avgElbowAngle > 160) {
    return RepetitionPhase.TOP;
  } else if (avgElbowAngle < 90) {
    return RepetitionPhase.BOTTOM;
  } else {
    if (this.angleHistory.length >= 2) {
      const prevLeftElbow = this.angleHistory[this.angleHistory.length - 2].left_elbow_angle || 180;
      const prevRightElbow = this.angleHistory[this.angleHistory.length - 2].right_elbow_angle || 180;
      const prevAvgElbow = (prevLeftElbow + prevRightElbow) / 2;
      
      return avgElbowAngle < prevAvgElbow ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
    }
    return RepetitionPhase.ECCENTRIC;
  }
}

// 💪 DETECCIÓN DE FASE DE PRESS DE HOMBROS (BÁSICA)
private detectShoulderPressPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const leftElbow = angles.left_elbow_angle || 180;
  const rightElbow = angles.right_elbow_angle || 180;
  const avgElbowAngle = (leftElbow + rightElbow) / 2;
  
  if (avgElbowAngle > 160) {
    return RepetitionPhase.TOP;
  } else if (avgElbowAngle < 90) {
    return RepetitionPhase.BOTTOM;
  } else {
    if (this.angleHistory.length >= 2) {
      const prevLeftElbow = this.angleHistory[this.angleHistory.length - 2].left_elbow_angle || 180;
      const prevRightElbow = this.angleHistory[this.angleHistory.length - 2].right_elbow_angle || 180;
      const prevAvgElbow = (prevLeftElbow + prevRightElbow) / 2;
      
      return avgElbowAngle < prevAvgElbow ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
    }
    return RepetitionPhase.ECCENTRIC;
  }
}
  // 🧹 LIMPIAR RECURSOS
  cleanup(): void {
    this.resetAnalysis();
    this.currentExercise = null;
    this.precisionValidator.cleanup();
  }
}
