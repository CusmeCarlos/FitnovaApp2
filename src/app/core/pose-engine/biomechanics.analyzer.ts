// src/app/core/pose-engine/biomechanics.analyzer.ts
// ✅ ANALIZADOR BIOMECÁNICO CORREGIDO - INCREMENTO 2

import { Injectable } from '@angular/core';
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  PostureErrorType,
  ExerciseType,
  RepetitionPhase
} from '../../shared/models/pose.models';
import { EXERCISE_DEFINITIONS } from '../config/exercise-definitions';

@Injectable({
  providedIn: 'root'
})
export class BiomechanicsAnalyzer {
  
  private currentExercise: ExerciseType | null = null;
  private currentPhase: RepetitionPhase = RepetitionPhase.IDLE;
  private repetitionCounter = 0;
  private lastErrorTimestamps: Map<PostureErrorType, number> = new Map();
  
  // Buffer para suavizar detecciones y evitar falsos positivos
  private angleHistory: BiomechanicalAngles[] = [];
  private phaseHistory: RepetitionPhase[] = [];
  private readonly SMOOTHING_WINDOW = 3;
  private readonly ERROR_COOLDOWN = 3000; // 2 segundos entre detecciones del mismo error

  // Calidad de movimiento
  private qualityHistory: number[] = [];

  constructor() {
    console.log('🧠 BiomechanicsAnalyzer inicializado');
  }

  // 🎯 CONFIGURAR EJERCICIO ACTUAL
  setCurrentExercise(exerciseType: ExerciseType): void {
    this.currentExercise = exerciseType;
    this.resetAnalysis();
    console.log(`🎯 Ejercicio configurado: ${exerciseType}`);
  }

  // 🔄 ANÁLISIS PRINCIPAL
  analyzeFrame(
    pose: PoseKeypoints, 
    angles: BiomechanicalAngles
  ): {
    errors: PostureError[];
    phase: RepetitionPhase;
    repetitionCount: number;
    qualityScore: number;
  } {
    
    if (!this.currentExercise) {
      return {
        errors: [],
        phase: RepetitionPhase.IDLE,
        repetitionCount: 0,
        qualityScore: 0
      };
    }

    // Verificar visibilidad mínima de landmarks clave
    if (!this.isPoseValid(pose)) {
      return {
        errors: [],
        phase: RepetitionPhase.IDLE,
        repetitionCount: this.repetitionCounter,
        qualityScore: 0
      };
    }

    // Suavizar ángulos
    const smoothedAngles = this.smoothAngles(angles);
    
    // Detectar fase actual del ejercicio
    const newPhase = this.detectExercisePhase(smoothedAngles);
    const smoothedPhase = this.smoothPhase(newPhase);
    
    // Detectar errores posturales
    const errors = this.detectPostureErrors(pose, smoothedAngles);
    
    // Contar repeticiones
    if (this.isRepetitionComplete(smoothedPhase)) {
      this.repetitionCounter++;
      console.log(`🔢 Repetición completada: ${this.repetitionCounter}`);
    }
    
    // Calcular puntuación de calidad
    const qualityScore = this.calculateQualityScore(errors, smoothedAngles);
    
    this.currentPhase = smoothedPhase;
    
    return {
      errors: errors,
      phase: smoothedPhase,
      repetitionCount: this.repetitionCounter,
      qualityScore: qualityScore
    };
  }

  // ✅ VERIFICAR VALIDEZ DE LA POSE
  private isPoseValid(pose: PoseKeypoints): boolean {
    const keyLandmarks = [
      pose.left_shoulder, pose.right_shoulder,
      pose.left_hip, pose.right_hip,
      pose.left_knee, pose.right_knee
    ];
    
    const validLandmarks = keyLandmarks.filter(landmark => landmark.visibility > 0.5);
    return validLandmarks.length >= 4;
  }

  // 📊 SUAVIZADO DE ÁNGULOS
  private smoothAngles(angles: BiomechanicalAngles): BiomechanicalAngles {
    this.angleHistory.push(angles);
    
    if (this.angleHistory.length > this.SMOOTHING_WINDOW) {
      this.angleHistory.shift();
    }
    
    if (this.angleHistory.length === 1) {
      return angles;
    }
    
    // Calcular promedio móvil
    const smoothed: BiomechanicalAngles = {};
    const keys = Object.keys(angles) as (keyof BiomechanicalAngles)[];
    
    keys.forEach(key => {
      const values = this.angleHistory
        .map(frame => frame[key])
        .filter(val => val !== undefined) as number[];
      
      if (values.length > 0) {
        smoothed[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });
    
    return smoothed;
  }

  // 🔄 SUAVIZADO DE FASES
  private smoothPhase(newPhase: RepetitionPhase): RepetitionPhase {
    this.phaseHistory.push(newPhase);
    
    if (this.phaseHistory.length > this.SMOOTHING_WINDOW) {
      this.phaseHistory.shift();
    }
    
    // Si la mayoría de las fases recientes son iguales, usar esa fase
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

  // 🔍 DETECCIÓN DE FASE DEL EJERCICIO
  private detectExercisePhase(angles: BiomechanicalAngles): RepetitionPhase {
    if (!this.currentExercise) return RepetitionPhase.IDLE;

    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.detectSquatPhase(angles);
      
      case ExerciseType.PUSHUPS:
        return this.detectPushupPhase(angles);
        
      case ExerciseType.PLANK:
        return RepetitionPhase.BOTTOM; // Isométrico
        
      default:
        return RepetitionPhase.IDLE;
    }
  }

  // 🦵 DETECCIÓN DE FASE DE SENTADILLAS
  private detectSquatPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;
    
    // Umbrales más precisos
    if (avgKneeAngle > 160) {
      return RepetitionPhase.TOP;
    } else if (avgKneeAngle < 90) {
      return RepetitionPhase.BOTTOM;
    } else {
      // Determinar dirección basada en historial
      if (this.angleHistory.length >= 2) {
        const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
        const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
        const prevAvgKnee = (prevLeftKnee + prevRightKnee) / 2;
        
        return avgKneeAngle < prevAvgKnee ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
      }
      return RepetitionPhase.ECCENTRIC;
    }
  }

  // 💪 DETECCIÓN DE FASE DE FLEXIONES
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

  // ✅ DETECCIÓN DE REPETICIÓN COMPLETA
  private isRepetitionComplete(currentPhase: RepetitionPhase): boolean {
    // Una repetición se completa cuando vamos de CONCENTRIC a TOP
    return this.currentPhase === RepetitionPhase.CONCENTRIC && currentPhase === RepetitionPhase.TOP;
  }

  // ⚠️ DETECCIÓN DE ERRORES POSTURALES
  // ⚠️ DETECCIÓN DE ERRORES POSTURALES
private detectPostureErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
  if (!this.currentExercise) return [];

  const exerciseConfig = EXERCISE_DEFINITIONS[this.currentExercise];
  const errors: PostureError[] = [];
  const now = Date.now();

  // ✅ EVALUAR SOLO 1 ERROR PRINCIPAL POR FRAME PARA EVITAR SPAM
  const mainErrorRules = exerciseConfig.errorDetectionRules.slice(0, 2);

  for (const rule of mainErrorRules) {
    // Verificar cooldown del error
    const lastDetection = this.lastErrorTimestamps.get(rule.errorType) || 0;
    if (now - lastDetection < this.ERROR_COOLDOWN) {
      continue;
    }

    // Evaluar condición específica del error
    const errorDetected = this.evaluateErrorCondition(rule, pose, angles);
    
    if (errorDetected) {
      // ✅ VERIFICAR CONFIANZA MÍNIMA ANTES DE AGREGAR ERROR
      const confidence = this.calculateErrorConfidence(rule, pose);
      
      if (confidence > 0.7) { // Solo errores con alta confianza
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
        console.log(`⚠️ Error detectado: ${rule.errorType} (confianza: ${confidence.toFixed(2)})`);
        
        // ✅ SOLO DETECTAR 1 ERROR POR FRAME
        break;
      }
    }
  }

  return errors;
}

  // 🔬 EVALUACIÓN DE CONDICIONES DE ERROR
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

  // 🦵 DETECCIÓN DE VALGO DE RODILLAS
  private detectKneeValgus(pose: PoseKeypoints, threshold: number): boolean {
    const kneeDistance = Math.abs(pose.left_knee.x - pose.right_knee.x);
    const hipDistance = Math.abs(pose.left_hip.x - pose.right_hip.x);
    
    if (hipDistance === 0) return false;
    
    const kneeToHipRatio = kneeDistance / hipDistance;
    return kneeToHipRatio < threshold;
  }

  // 🎯 OBTENER ARTICULACIONES AFECTADAS
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

  // 🎲 CALCULAR CONFIANZA EN LA DETECCIÓN
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

  // 🔍 OBTENER LANDMARK POR ARTICULACIÓN
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

  // 🏆 CALCULAR PUNTUACIÓN DE CALIDAD
  private calculateQualityScore(errors: PostureError[], angles: BiomechanicalAngles): number {
    if (!this.currentExercise) return 0;

    let baseScore = 100;

    // Penalizar por errores
    errors.forEach(error => {
      const penalty = Math.min(error.severity * 3, 30); // Máximo 30 puntos de penalización por error
      baseScore -= penalty;
    });

    // Bonificar por rango de movimiento adecuado
    const romBonus = this.calculateROMBonus(angles);
    baseScore += romBonus;

    // Bonificar por simetría
    const symmetryBonus = this.calculateSymmetryBonus(angles);
    baseScore += symmetryBonus;

    // Asegurar que esté entre 0-100
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));
    
    // Almacenar en historial para promedio
    this.qualityHistory.push(finalScore);
    if (this.qualityHistory.length > 30) {
      this.qualityHistory.shift();
    }
    
    return finalScore;
  }

  // 📏 CALCULAR BONUS POR RANGO DE MOVIMIENTO
  private calculateROMBonus(angles: BiomechanicalAngles): number {
    if (!this.currentExercise) return 0;

    const config = EXERCISE_DEFINITIONS[this.currentExercise];
    let bonus = 0;

    // Evaluar ángulos clave según el ejercicio
    Object.keys(config.angleThresholds).forEach(angleKey => {
      const threshold = config.angleThresholds[angleKey];
      const currentAngle = this.getAngleValue(angleKey, angles);
      
      if (currentAngle !== null) {
        const idealDistance = Math.abs(currentAngle - threshold.ideal);
        if (idealDistance < 10) {
          bonus += 3;
        } else if (idealDistance < 20) {
          bonus += 1;
        }
      }
    });

    return Math.min(bonus, 10); // Máximo 10 puntos de bonus
  }

  // ⚖️ CALCULAR BONUS POR SIMETRÍA
  private calculateSymmetryBonus(angles: BiomechanicalAngles): number {
    let bonus = 0;

    // Evaluar simetría
    if (angles.shoulder_symmetry !== undefined && angles.shoulder_symmetry < 5) {
      bonus += 2;
    }

    if (angles.hip_symmetry !== undefined && angles.hip_symmetry < 5) {
      bonus += 2;
    }

    if (angles.knee_symmetry !== undefined && angles.knee_symmetry < 5) {
      bonus += 2;
    }

    return bonus;
  }

  // 🔢 OBTENER VALOR DE ÁNGULO
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
    this.qualityHistory = [];
    this.lastErrorTimestamps.clear();
    console.log('🔄 Análisis biomecánico reiniciado');
  }

  // 📊 OBTENER ESTADÍSTICAS
  getSessionStats(): {
    repetitions: number;
    averageQuality: number;
    currentPhase: RepetitionPhase;
  } {
    const avgQuality = this.qualityHistory.length > 0 
      ? Math.round(this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length)
      : 0;

    return {
      repetitions: this.repetitionCounter,
      averageQuality: avgQuality,
      currentPhase: this.currentPhase
    };
  }

  // 🧹 LIMPIAR RECURSOS
  cleanup(): void {
    this.resetAnalysis();
    this.currentExercise = null;
  }
}