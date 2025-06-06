// src/app/core/pose-engine/biomechanics.analyzer.ts
// Analizador biomecánico basado en literatura científica

import { Injectable } from '@angular/core';
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  PostureErrorType,
  ExerciseType,
  ExerciseRepetition,
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
  
  // Buffer para suavizar detecciones
  private angleHistory: BiomechanicalAngles[] = [];
  private readonly SMOOTHING_WINDOW = 5;
  private readonly ERROR_COOLDOWN = 1500; // ms entre detecciones del mismo error

  constructor() {}

  // 🎯 CONFIGURAR EJERCICIO ACTUAL
  setCurrentExercise(exerciseType: ExerciseType): void {
    this.currentExercise = exerciseType;
    this.resetAnalysis();
    console.log(`🎯 Ejercicio configurado: ${exerciseType}`);
  }

  // 🔄 ANÁLISIS PRINCIPAL - LLAMADO EN CADA FRAME
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
    // ✅ VERIFICAR VISIBILIDAD MÍNIMA
  const keyLandmarks = [pose.left_shoulder, pose.right_shoulder, pose.left_hip, pose.right_hip];
  const validLandmarks = keyLandmarks.filter(landmark => landmark.visibility > 0.5);
  
  if (validLandmarks.length < 3) {
    console.log('⚠️ Pose con poca visibilidad, saltando análisis');
    return {
      errors: [],
      phase: RepetitionPhase.IDLE,
      repetitionCount: this.repetitionCounter,
      qualityScore: 0
    };
  }

    // Suavizar ángulos usando buffer histórico
    const smoothedAngles = this.smoothAngles(angles);
    
    // Detectar fase actual del ejercicio
    const newPhase = this.detectExercisePhase(smoothedAngles);
    
    // Detectar errores posturales
    const errors = this.detectPostureErrors(pose, smoothedAngles);
    
    // Contar repeticiones
    if (this.isRepetitionComplete(newPhase)) {
      this.repetitionCounter++;
      console.log(`🔢 Repetición completada: ${this.repetitionCounter}`);
    }
    
    // Calcular puntuación de calidad
    const qualityScore = this.calculateQualityScore(errors, smoothedAngles);
    
    this.currentPhase = newPhase;
    
    return {
      errors: errors,
      phase: newPhase,
      repetitionCount: this.repetitionCounter,
      qualityScore: qualityScore
    };
  }

  // 📊 SUAVIZADO DE ÁNGULOS USANDO MEDIA MÓVIL
  private smoothAngles(angles: BiomechanicalAngles): BiomechanicalAngles {
    this.angleHistory.push(angles);
    
    // Mantener solo los últimos N frames
    if (this.angleHistory.length > this.SMOOTHING_WINDOW) {
      this.angleHistory.shift();
    }
    
    if (this.angleHistory.length === 1) {
      return angles; // No hay suficiente historia para suavizar
    }
    
    // Calcular media móvil para cada ángulo
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
    const avgKneeAngle = ((angles.left_knee_angle || 0) + (angles.right_knee_angle || 0)) / 2;
    
    if (avgKneeAngle > 150) {
      return RepetitionPhase.TOP;
    } else if (avgKneeAngle < 100) {
      return RepetitionPhase.BOTTOM;
    } else {
      // Determinar si va hacia abajo o arriba basado en historial
      if (this.angleHistory.length >= 2) {
        const prevAvgKnee = ((this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 0) + 
                            (this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 0)) / 2;
        
        return avgKneeAngle < prevAvgKnee ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
      }
      return RepetitionPhase.ECCENTRIC;
    }
  }

  // 💪 DETECCIÓN DE FASE DE FLEXIONES
  private detectPushupPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const avgElbowAngle = ((angles.left_elbow_angle || 0) + (angles.right_elbow_angle || 0)) / 2;
    
    if (avgElbowAngle > 160) {
      return RepetitionPhase.TOP;
    } else if (avgElbowAngle < 90) {
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevAvgElbow = ((this.angleHistory[this.angleHistory.length - 2].left_elbow_angle || 0) + 
                             (this.angleHistory[this.angleHistory.length - 2].right_elbow_angle || 0)) / 2;
        
        return avgElbowAngle < prevAvgElbow ? RepetitionPhase.ECCENTRIC : RepetitionPhase.CONCENTRIC;
      }
      return RepetitionPhase.ECCENTRIC;
    }
  }

  // ✅ DETECCIÓN DE REPETICIÓN COMPLETA
  private isRepetitionComplete(currentPhase: RepetitionPhase): boolean {
    // Una repetición se completa cuando vamos de TOP -> ECCENTRIC -> BOTTOM -> CONCENTRIC -> TOP
    return this.currentPhase === RepetitionPhase.CONCENTRIC && currentPhase === RepetitionPhase.TOP;
  }

  // ⚠️ DETECCIÓN DE ERRORES POSTURALES
  private detectPostureErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    if (!this.currentExercise) return [];

    const exerciseConfig = EXERCISE_DEFINITIONS[this.currentExercise];
    const errors: PostureError[] = [];
    const now = Date.now();

    // Evaluar cada regla de error del ejercicio
    exerciseConfig.errorDetectionRules.forEach(rule => {
      // Verificar cooldown del error
      const lastDetection = this.lastErrorTimestamps.get(rule.errorType) || 0;
      if (now - lastDetection < this.ERROR_COOLDOWN) {
        return; // Skip si está en cooldown
      }

      // Evaluar condición específica del error
      const errorDetected = this.evaluateErrorCondition(rule, pose, angles);
      
      if (errorDetected) {
        errors.push({
          type: rule.errorType,
          severity: rule.severity,
          description: rule.message,
          recommendation: rule.recommendation,
          affectedJoints: this.getAffectedJoints(rule.errorType),
          confidence: this.calculateErrorConfidence(rule, pose, angles),
          timestamp: now
        });
        
        this.lastErrorTimestamps.set(rule.errorType, now);
        console.log(`⚠️ Error detectado: ${rule.errorType} - ${rule.message}`);
      }
    });

    return errors;
  }

  // 🔬 EVALUACIÓN DE CONDICIONES DE ERROR
  private evaluateErrorCondition(rule: any, pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    switch (rule.errorType) {
      case PostureErrorType.KNEE_VALGUS:
        return this.detectKneeValgus(pose, rule.threshold);
      
      case PostureErrorType.FORWARD_LEAN:
        return (angles.spine_angle || 90) < rule.threshold;
      
      case PostureErrorType.HEEL_RISE:
        return this.detectHeelRise(pose, rule.threshold);
      
      case PostureErrorType.SHALLOW_DEPTH:
        const avgKneeAngle = ((angles.left_knee_angle || 0) + (angles.right_knee_angle || 0)) / 2;
        return avgKneeAngle > rule.threshold && this.currentPhase === RepetitionPhase.BOTTOM;
      
      case PostureErrorType.SAGGING_HIPS:
        const avgHipAngle = ((angles.left_hip_angle || 0) + (angles.right_hip_angle || 0)) / 2;
        return avgHipAngle < rule.threshold;
      
      case PostureErrorType.RAISED_HIPS:
        const avgHipAngle2 = ((angles.left_hip_angle || 0) + (angles.right_hip_angle || 0)) / 2;
        return avgHipAngle2 > rule.threshold;
      
      case PostureErrorType.PARTIAL_ROM:
        const avgElbowAngle = ((angles.left_elbow_angle || 0) + (angles.right_elbow_angle || 0)) / 2;
        return avgElbowAngle > rule.threshold && this.currentPhase === RepetitionPhase.BOTTOM;
      
      default:
        return false;
    }
  }

  // 🦵 DETECCIÓN ESPECÍFICA DE VALGO DE RODILLAS
  private detectKneeValgus(pose: PoseKeypoints, threshold: number): boolean {
    // Calcular la distancia entre rodillas respecto al ancho de cadera
    const kneeDistance = Math.abs(pose.left_knee.x - pose.right_knee.x);
    const hipDistance = Math.abs(pose.left_hip.x - pose.right_hip.x);
    
    const kneeToHipRatio = kneeDistance / hipDistance;
    return kneeToHipRatio < threshold;
  }

  // 👠 DETECCIÓN DE LEVANTAMIENTO DE TALONES
  private detectHeelRise(pose: PoseKeypoints, threshold: number): boolean {
    // Comparar altura de talones vs dedos de los pies
    const leftHeelRise = pose.left_heel.y - pose.left_foot_index.y;
    const rightHeelRise = pose.right_heel.y - pose.right_foot_index.y;
    
    return leftHeelRise > threshold || rightHeelRise > threshold;
  }

  // 🎯 OBTENER ARTICULACIONES AFECTADAS POR ERROR
  private getAffectedJoints(errorType: PostureErrorType): string[] {
    const jointMap: { [key in PostureErrorType]: string[] } = {
      [PostureErrorType.KNEE_VALGUS]: ['left_knee', 'right_knee'],
      [PostureErrorType.FORWARD_LEAN]: ['spine', 'hip'],
      [PostureErrorType.HEEL_RISE]: ['left_ankle', 'right_ankle'],
      [PostureErrorType.BUTT_WINK]: ['spine', 'pelvis'],
      [PostureErrorType.SHALLOW_DEPTH]: ['left_knee', 'right_knee', 'hip'],
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

  // 🎲 CALCULAR CONFIANZA EN LA DETECCIÓN DEL ERROR
  private calculateErrorConfidence(rule: any, pose: PoseKeypoints, angles: BiomechanicalAngles): number {
    // Basado en la visibilidad de los landmarks relevantes
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

  // 🔍 OBTENER LANDMARK POR NOMBRE DE ARTICULACIÓN
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
      'spine': pose.left_shoulder, // Aproximación
      'neck': pose.nose
    };

    return jointMap[jointName];
  }

  // 🏆 CALCULAR PUNTUACIÓN DE CALIDAD DEL MOVIMIENTO
  private calculateQualityScore(errors: PostureError[], angles: BiomechanicalAngles): number {
    if (!this.currentExercise) return 0;

    const exerciseConfig = EXERCISE_DEFINITIONS[this.currentExercise];
    let baseScore = 100;

    // Penalizar por errores
    errors.forEach(error => {
      const penalty = error.severity * 2; // Cada punto de severidad = -2 puntos
      baseScore -= penalty;
    });

    // Bonificar por rango de movimiento adecuado
    const romBonus = this.calculateROMBonus(angles);
    baseScore += romBonus;

    // Bonificar por simetría
    const symmetryBonus = this.calculateSymmetryBonus(angles);
    baseScore += symmetryBonus;

    // Asegurar que esté entre 0-100
    return Math.max(0, Math.min(100, Math.round(baseScore)));
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
        // Bonificar si está cerca del ángulo ideal
        const idealDistance = Math.abs(currentAngle - threshold.ideal);
        if (idealDistance < 10) {
          bonus += 5; // +5 puntos por ángulo ideal
        } else if (idealDistance < 20) {
          bonus += 2; // +2 puntos por ángulo aceptable
        }
      }
    });

    return Math.min(bonus, 20); // Máximo 20 puntos de bonus
  }

  // ⚖️ CALCULAR BONUS POR SIMETRÍA
  private calculateSymmetryBonus(angles: BiomechanicalAngles): number {
    let bonus = 0;

    // Evaluar simetría de hombros
    if (angles.shoulder_symmetry !== undefined && angles.shoulder_symmetry < 5) {
      bonus += 3;
    }

    // Evaluar simetría de caderas
    if (angles.hip_symmetry !== undefined && angles.hip_symmetry < 5) {
      bonus += 3;
    }

    // Evaluar simetría de rodillas
    if (angles.knee_symmetry !== undefined && angles.knee_symmetry < 5) {
      bonus += 4;
    }

    return bonus;
  }

  // 🔢 OBTENER VALOR DE ÁNGULO POR CLAVE
  private getAngleValue(angleKey: string, angles: BiomechanicalAngles): number | null {
    const angleMap: { [key: string]: keyof BiomechanicalAngles } = {
      'knee_angle': 'left_knee_angle', // Promedio se calculará
      'hip_angle': 'left_hip_angle',
      'elbow_angle': 'left_elbow_angle',
      'spine_angle': 'spine_angle',
      'shoulder_angle': 'left_shoulder_angle'
    };

    const mappedKey = angleMap[angleKey];
    if (!mappedKey) return null;

    // Para ángulos bilaterales, calcular promedio
    if (angleKey === 'knee_angle') {
      const left = angles.left_knee_angle || 0;
      const right = angles.right_knee_angle || 0;
      return (left + right) / 2;
    } else if (angleKey === 'hip_angle') {
      const left = angles.left_hip_angle || 0;
      const right = angles.right_hip_angle || 0;
      return (left + right) / 2;
    } else if (angleKey === 'elbow_angle') {
      const left = angles.left_elbow_angle || 0;
      const right = angles.right_elbow_angle || 0;
      return (left + right) / 2;
    }

    return angles[mappedKey] || null;
  }

  // 🔄 REINICIAR ANÁLISIS
  private resetAnalysis(): void {
    this.currentPhase = RepetitionPhase.IDLE;
    this.repetitionCounter = 0;
    this.angleHistory = [];
    this.lastErrorTimestamps.clear();
    console.log('🔄 Análisis biomecánico reiniciado');
  }

  // 📊 OBTENER ESTADÍSTICAS DE LA SESIÓN
  getSessionStats(): {
    repetitions: number;
    averageQuality: number;
    mostCommonErrors: PostureErrorType[];
    currentPhase: RepetitionPhase;
  } {
    // Esta función se expandirá para incluir estadísticas más detalladas
    return {
      repetitions: this.repetitionCounter,
      averageQuality: 0, // Se calculará con historial de calidad
      mostCommonErrors: [], // Se calculará con historial de errores
      currentPhase: this.currentPhase
    };
  }

  // 🧹 LIMPIAR RECURSOS
  cleanup(): void {
    this.resetAnalysis();
    this.currentExercise = null;
  }
}