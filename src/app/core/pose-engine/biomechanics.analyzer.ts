// src/app/core/pose-engine/biomechanics.analyzer.ts
// ✅ ANALIZADOR BIOMECÁNICO SIMPLIFICADO Y CORREGIDO

import { Injectable } from '@angular/core';
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  PostureErrorType,
  ExerciseType, 
  RepetitionPhase 
} from '../../shared/models/pose.models';

@Injectable({
  providedIn: 'root'
})
export class BiomechanicsAnalyzer {
  
  private currentExercise: ExerciseType = ExerciseType.SQUATS;
  private repetitionCounter = 0;
  private currentPhase: RepetitionPhase = RepetitionPhase.IDLE;
  private lastPhase: RepetitionPhase = RepetitionPhase.IDLE;

  // ✅ AGREGAR ESTAS PROPIEDADES
  private sessionStartTime: number | null = null;
  private previousAngles: BiomechanicalAngles | null = null;
  
  // ✅ COOLDOWN PARA EVITAR SPAM DE ERRORES
  private lastErrorTimestamps = new Map<PostureErrorType, number>();
  private readonly ERROR_COOLDOWN = 20000; // 20 segundos
  
  // ✅ UMBRALES SIMPLIFICADOS Y EFECTIVOS
  private readonly THRESHOLDS = {
    // Sentadillas
    SQUAT: {
      knee_min: 70,        // Ángulo mínimo de rodilla (muy flexionada)
      knee_max: 170,       // Ángulo máximo de rodilla (extendida)
      hip_min: 45,         // Ángulo mínimo de cadera
      trunk_max: 20        // Inclinación máxima del tronco
    },
    
    // Flexiones  
    PUSHUP: {
      elbow_min: 60,       // Ángulo mínimo de codo (flexionado)
      elbow_max: 170,      // Ángulo máximo de codo (extendido)
      hip_min: 160,        // Línea corporal recta
      hip_max: 185
    },
    
    // Plancha
    PLANK: {
      hip_min: 160,        // Línea corporal recta
      hip_max: 185,
      elbow_angle: 90      // Ángulo de codo en plancha
    }
  };

  constructor() {
    console.log('🧠 BiomechanicsAnalyzer inicializado');
  }

  // 🎯 ESTABLECER EJERCICIO ACTUAL
  setCurrentExercise(exercise: ExerciseType): void {
    console.log(`🏋️ Ejercicio establecido: ${exercise}`);
    this.currentExercise = exercise;
    this.repetitionCounter = 0;
    this.currentPhase = RepetitionPhase.IDLE;
    this.lastErrorTimestamps.clear();
  }

  // 🔍 ANALIZAR MOVIMIENTO PRINCIPAL
  analyzeMovement(pose: PoseKeypoints, angles: BiomechanicalAngles): {
    errors: PostureError[];
    phase: RepetitionPhase;
    repetitionCount: number;
    qualityScore: number;
  } {
    
    console.log('🧠 === ANALIZANDO MOVIMIENTO ===');
    console.log('📊 Ejercicio actual:', this.currentExercise);
    console.log('📐 Ángulos recibidos:', angles);

    // Verificar que tenemos datos válidos
    if (!this.isPoseValid(pose) || !angles) {
      console.log('❌ Pose o ángulos inválidos');
      return {
        errors: [],
        phase: RepetitionPhase.IDLE,
        repetitionCount: this.repetitionCounter,
        qualityScore: 0
      };
    }

    // Detectar errores posturales
    const errors = this.detectPostureErrors(pose, angles);
    console.log('🚨 Errores detectados:', errors.length);

    // Detectar fase del ejercicio
    const newPhase = this.detectExercisePhase(angles);
    
    // Contar repeticiones
    if (this.isRepetitionComplete(newPhase)) {
      this.repetitionCounter++;
      console.log(`🔢 Repetición completada: ${this.repetitionCounter}`);
    }
    
    this.currentPhase = newPhase;

    // Calcular puntuación de calidad
    const qualityScore = this.calculateQualityScore(errors, angles);

    return {
      errors,
      phase: this.currentPhase,
      repetitionCount: this.repetitionCounter,
      qualityScore
    };
  }

  // ✅ VALIDAR POSE
  private isPoseValid(pose: PoseKeypoints): boolean {
    const requiredJoints = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];
    return requiredJoints.every(joint => pose[joint] && pose[joint].visibility > 0.5);
  }

// 🚨 DETECTAR ERRORES POSTURALES (CON MENSAJES POSITIVOS)
private detectPostureErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
  const errors: PostureError[] = [];
  const timestamp = Date.now();

  // ✅ NO DETECTAR NADA SI ESTÁ EN REPOSO O RECIÉN INICIANDO
  if (this.currentPhase === RepetitionPhase.IDLE) {
    console.log('😴 En reposo - sin detección');
    return errors;
  }

  // ✅ NO DETECTAR NADA EN LOS PRIMEROS 3 SEGUNDOS
  if (!this.sessionStartTime) {
    this.sessionStartTime = timestamp;
  }
  
  const sessionDuration = timestamp - this.sessionStartTime;
  if (sessionDuration < 3000) { // 3 segundos de gracia
    console.log('⏰ Período de gracia - sin detección');
    return errors;
  }

  // ✅ SOLO DETECTAR SI HAY MOVIMIENTO REAL
  if (!this.hasSignificantMovement(angles)) {
    console.log('🤷 Sin movimiento significativo');
    return errors;
  }

  // ✅ VERIFICAR POSTURA BUENA PRIMERO
  if (this.checkGoodPosture(angles)) {
    if (this.checkErrorCooldown('GOOD_POSTURE' as PostureErrorType, timestamp)) {
      console.log('✅ POSTURA EXCELENTE - Generando mensaje positivo');
      errors.push({
        type: 'GOOD_POSTURE' as PostureErrorType,
        severity: 2, // Verde
        description: '¡Excelente técnica!',
        recommendation: 'Continúa así, tu postura es perfecta',
        affectedJoints: [],
        confidence: 0.95,
        timestamp
      });
    }
    return errors; // ✅ SALIR AQUÍ SI LA POSTURA ES BUENA
  }

  console.log(`🔍 Detectando errores para ${this.currentExercise}`);

  switch (this.currentExercise) {
    case ExerciseType.SQUATS:
      errors.push(...this.detectSquatErrorsStrict(pose, angles, timestamp));
      break;
    case ExerciseType.PUSHUPS:
      errors.push(...this.detectPushupErrors(pose, angles, timestamp));
      break;
    case ExerciseType.PLANK:
      errors.push(...this.detectPlankErrors(pose, angles, timestamp));
      break;
  }

  console.log(`✅ Errores detectados: ${errors.length}`);
  return errors;
}

// ✅ VERIFICAR SI LA POSTURA ES BUENA
private checkGoodPosture(angles: BiomechanicalAngles): boolean {
  const avgKneeAngle = this.getAverageKneeAngle(angles);
  const trunkAngle = angles.trunk_angle || 0;
  
  // ✅ Criterios para postura buena
  const isGoodPosture = (
    avgKneeAngle > 70 &&     // Rodillas no muy flexionadas
    avgKneeAngle < 170 &&    // Rodillas no muy extendidas
    trunkAngle < 25          // Tronco no muy inclinado
  );
  
  if (isGoodPosture) {
    console.log(`✅ POSTURA BUENA: Rodilla=${avgKneeAngle.toFixed(1)}°, Tronco=${trunkAngle.toFixed(1)}°`);
  } else {
    console.log(`❌ POSTURA REGULAR: Rodilla=${avgKneeAngle.toFixed(1)}°, Tronco=${trunkAngle.toFixed(1)}°`);
  }
  
  return isGoodPosture;
}

// ✅ VERIFICAR SI HAY MOVIMIENTO REAL
// ✅ VERIFICAR MOVIMIENTO SIGNIFICATIVO (MEJORADO)
private hasSignificantMovement(angles: BiomechanicalAngles): boolean {
  if (!this.previousAngles) {
    this.previousAngles = { ...angles };
    return true; // Primera detección cuenta como movimiento
  }

  const leftKneeDiff = Math.abs((angles.left_knee_angle || 0) - (this.previousAngles.left_knee_angle || 0));
  const rightKneeDiff = Math.abs((angles.right_knee_angle || 0) - (this.previousAngles.right_knee_angle || 0));
  const avgKneeDiff = (leftKneeDiff + rightKneeDiff) / 2;

  // ✅ UMBRAL MÁS SENSIBLE PARA CONTAR MOVIMIENTOS
  const hasMovement = avgKneeDiff > 3; // Reducido de 8 a 3 grados
  
  if (hasMovement) {
    console.log(`🔄 MOVIMIENTO: Diferencia rodilla promedio=${avgKneeDiff.toFixed(1)}°`);
  }
  
  this.previousAngles = { ...angles };
  return hasMovement;
}

// 🏋️ DETECTAR ERRORES SENTADILLAS (CORREGIDO Y LIMPIO)
private detectSquatErrorsStrict(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];
  
  // ✅ VERIFICAR DATOS VÁLIDOS
  if (!angles.left_knee_angle || !angles.right_knee_angle) {
    return errors;
  }

  const avgKneeAngle = this.getAverageKneeAngle(angles);
  const trunkAngle = angles.trunk_angle || 0;
  
  // ✅ LOGS DETALLADOS PARA ENTENDER QUÉ PASA
  console.log(`
🔍 === ANÁLISIS SENTADILLA ===
Rodilla promedio: ${avgKneeAngle.toFixed(1)}°
Ángulo tronco: ${trunkAngle.toFixed(1)}°
Fase actual: ${this.currentPhase}
Timestamp: ${timestamp}
==========================
`);

  // ✅ SOLO EN FASES DE MOVIMIENTO
  if (this.currentPhase === RepetitionPhase.IDLE) {
    console.log('😴 En reposo - sin detección');
    return errors;
  }

  // ✅ CONDICIONES MUCHO MÁS ESTRICTAS
  
  // 1. Knee Valgus SOLO SI ES GRAVÍSIMO
  const kneeValgusRatio = this.calculateKneeValgusRatio(pose);
  if (kneeValgusRatio > 0 && kneeValgusRatio < 0.25) { // EXTREMADAMENTE estricto
    if (this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
      console.log(`🚨 KNEE VALGUS CRÍTICO: ratio=${kneeValgusRatio.toFixed(3)}`);
      errors.push({
        type: PostureErrorType.KNEE_VALGUS,
        severity: 9,
        description: 'CRÍTICO: Rodillas colapsan hacia adentro',
        recommendation: 'Empuja las rodillas hacia afuera inmediatamente',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.95,
        timestamp
      });
    }
  }
  
  // 2. Inclinación del tronco - SOLO SI ES REALMENTE EXTREMA
  else if (trunkAngle > 50) { // ✅ Cambio de 40° a 50° (súper estricto)
    if (this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
      console.log(`🚨 INCLINACIÓN CRÍTICA: ${trunkAngle.toFixed(1)}°`);
      errors.push({
        type: PostureErrorType.FORWARD_LEAN,
        severity: 8,
        description: 'CRÍTICO: Inclinación extrema del tronco',
        recommendation: 'Endereza la espalda gradualmente',
        affectedJoints: ['spine'],
        confidence: 0.90,
        timestamp
      });
    }
  }
  
  // 3. Advertencia leve (opcional)
  else if (trunkAngle > 35 && trunkAngle <= 50) {
    if (this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
      console.log(`⚠️ INCLINACIÓN MODERADA: ${trunkAngle.toFixed(1)}°`);
      errors.push({
        type: PostureErrorType.FORWARD_LEAN,
        severity: 4,
        description: 'Ligera inclinación del tronco',
        recommendation: 'Mantén el pecho un poco más erguido',
        affectedJoints: ['spine'],
        confidence: 0.75,
        timestamp
      });
    }
  }

  if (errors.length > 0) {
    console.log(`🚨 ERRORES GENERADOS: ${errors.length}`);
    errors.forEach(error => {
      console.log(`  - ${error.description} (Severidad: ${error.severity})`);
    });
  } else {
    console.log('✅ Sin errores detectados');
  }

  return errors;
}

// 🦵 CALCULAR RATIO DE KNEE VALGUS (MÉTODO ÚNICO)
private calculateKneeValgusRatio(pose: PoseKeypoints): number {
  if (!pose.left_knee || !pose.right_knee || !pose.left_ankle || !pose.right_ankle) {
    return -1; // Valor inválido
  }

  const kneeDistance = Math.abs(pose.left_knee.x - pose.right_knee.x);
  const ankleDistance = Math.abs(pose.left_ankle.x - pose.right_ankle.x);
  
  if (ankleDistance === 0) return -1;
  
  const valgusRatio = kneeDistance / ankleDistance;
  
  console.log(`🦵 Knee análisis: 
    Distancia rodillas: ${kneeDistance.toFixed(4)}
    Distancia tobillos: ${ankleDistance.toFixed(4)}
    Ratio valgus: ${valgusRatio.toFixed(4)}`);
  
  return valgusRatio;
}

 // 🏋️ DETECTAR ERRORES EN SENTADILLAS (MEJORADO CON COLORES)
private detectSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];

  // 1. ROJO: Rodillas muy juntas (crítico)
  if (this.isKneeValgus(pose)) {
    if (this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
      errors.push({
        type: PostureErrorType.KNEE_VALGUS,
        severity: 9, // ROJO
        description: 'CRÍTICO: Rodillas se colapsan hacia adentro',
        recommendation: 'Para inmediatamente. Empuja las rodillas hacia afuera',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.90,
        timestamp
      });
    }
  }

  // 2. NARANJA: Inclinación moderada del tronco
  const trunkAngle = angles.trunk_angle || 0;
  if (trunkAngle > 15 && trunkAngle <= 25) {
    if (this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
      errors.push({
        type: PostureErrorType.FORWARD_LEAN,
        severity: 5, // NARANJA
        description: 'Inclinación del tronco detectada',
        recommendation: 'Mantén el pecho más erguido y la espalda recta',
        affectedJoints: ['spine'],
        confidence: 0.80,
        timestamp
      });
    }
  }

  // 3. ROJO: Inclinación excesiva del tronco
  if (trunkAngle > 25) {
    if (this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
      errors.push({
        type: PostureErrorType.FORWARD_LEAN,
        severity: 8, // ROJO
        description: 'CRÍTICO: Te inclinas demasiado hacia adelante',
        recommendation: 'Endereza el tronco inmediatamente, riesgo de lesión',
        affectedJoints: ['spine'],
        confidence: 0.85,
        timestamp
      });
    }
  }

  // 4. NARANJA: Profundidad insuficiente
  const avgKneeAngle = this.getAverageKneeAngle(angles);
  if (avgKneeAngle > 110 && avgKneeAngle < 130 && this.currentPhase === RepetitionPhase.BOTTOM) {
    if (this.checkErrorCooldown(PostureErrorType.SHALLOW_DEPTH, timestamp)) {
      errors.push({
        type: PostureErrorType.SHALLOW_DEPTH,
        severity: 4, // NARANJA
        description: 'Puedes bajar un poco más',
        recommendation: 'Intenta llegar hasta que los muslos estén paralelos',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.75,
        timestamp
      });
    }
  }

  return errors;
}

  // 💪 DETECTAR ERRORES EN FLEXIONES
  private detectPushupErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // 1. Caderas muy bajas (sagging hips)
    const avgHipAngle = this.getAverageHipAngle(angles);
    if (avgHipAngle < this.THRESHOLDS.PUSHUP.hip_min) {
      if (this.checkErrorCooldown(PostureErrorType.SAGGING_HIPS, timestamp)) {
        errors.push({
          type: PostureErrorType.SAGGING_HIPS,
          severity: 7,
          description: 'Las caderas se hunden - postura de banana',
          recommendation: 'Contrae el abdomen y mantén el cuerpo recto como una tabla',
          affectedJoints: ['hip', 'core'],
          confidence: 0.82,
          timestamp
        });
      }
    }

    // 2. Caderas muy altas
    if (avgHipAngle > this.THRESHOLDS.PUSHUP.hip_max) {
      if (this.checkErrorCooldown(PostureErrorType.RAISED_HIPS, timestamp)) {
        errors.push({
          type: PostureErrorType.RAISED_HIPS,
          severity: 6,
          description: 'Las caderas están muy altas - postura de montaña',
          recommendation: 'Baja las caderas y mantén el cuerpo en línea recta',
          affectedJoints: ['hip'],
          confidence: 0.78,
          timestamp
        });
      }
    }

    // 3. No bajas lo suficiente con los brazos
    const avgElbowAngle = this.getAverageElbowAngle(angles);
    if (avgElbowAngle > 120 && this.currentPhase === RepetitionPhase.BOTTOM) {
      if (this.checkErrorCooldown(PostureErrorType.SHALLOW_DEPTH, timestamp)) {
        errors.push({
          type: PostureErrorType.SHALLOW_DEPTH,
          severity: 5,
          description: 'No bajas lo suficiente - brazos poco flexionados',
          recommendation: 'Baja hasta que el pecho casi toque el suelo',
          affectedJoints: ['left_elbow', 'right_elbow'],
          confidence: 0.75,
          timestamp
        });
      }
    }

    return errors;
  }

  // 🏃 DETECTAR ERRORES EN PLANCHA
  private detectPlankErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // 1. Caderas muy bajas en plancha
    const avgHipAngle = this.getAverageHipAngle(angles);
    if (avgHipAngle < this.THRESHOLDS.PLANK.hip_min) {
      if (this.checkErrorCooldown(PostureErrorType.SAGGING_HIPS, timestamp)) {
        errors.push({
          type: PostureErrorType.SAGGING_HIPS,
          severity: 7,
          description: 'Las caderas se hunden en la plancha',
          recommendation: 'Contrae el core y sube las caderas a línea recta',
          affectedJoints: ['hip', 'core'],
          confidence: 0.80,
          timestamp
        });
      }
    }

    // 2. Caderas muy altas en plancha
    if (avgHipAngle > this.THRESHOLDS.PLANK.hip_max) {
      if (this.checkErrorCooldown(PostureErrorType.RAISED_HIPS, timestamp)) {
        errors.push({
          type: PostureErrorType.RAISED_HIPS,
          severity: 6,
          description: 'Las caderas están muy altas en la plancha',
          recommendation: 'Baja un poco las caderas para formar línea recta',
          affectedJoints: ['hip'],
          confidence: 0.78,
          timestamp
        });
      }
    }

    return errors;
  }

  // ✅ DETECTAR FASE DEL EJERCICIO
  private detectExercisePhase(angles: BiomechanicalAngles): RepetitionPhase {
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.detectSquatPhase(angles);
      case ExerciseType.PUSHUPS:
        return this.detectPushupPhase(angles);
      case ExerciseType.PLANK:
        return RepetitionPhase.HOLD; // Plancha es isométrica
      default:
        return RepetitionPhase.IDLE;
    }
  }

 // 🏋️ DETECTAR FASE DE SENTADILLA (VERIFICAR UMBRALES)
private detectSquatPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const avgKneeAngle = this.getAverageKneeAngle(angles);
  
  console.log(`📊 CONTEO DEBUG: Rodilla=${avgKneeAngle.toFixed(1)}°, Fase=${this.currentPhase}, Reps=${this.repetitionCounter}`);
  
  // ✅ UMBRALES CLAROS PARA SENTADILLAS
  if (avgKneeAngle > 140) {        // ✅ Posición alta (parado)
    return RepetitionPhase.TOP;
  } 
  else if (avgKneeAngle < 100) {   // ✅ Posición baja (sentadilla)
    return RepetitionPhase.BOTTOM;
  } 
  else {
    // Posición intermedia - determinar dirección
    if (this.currentPhase === RepetitionPhase.TOP) {
      return RepetitionPhase.DESCENDING; // Bajando desde arriba
    } else if (this.currentPhase === RepetitionPhase.BOTTOM) {
      return RepetitionPhase.ASCENDING;  // Subiendo desde abajo
    } else {
      // Mantener fase actual si está en transición
      return this.currentPhase;
    }
  }
}
  // 💪 DETECTAR FASE DE FLEXIÓN
  private detectPushupPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const avgElbowAngle = this.getAverageElbowAngle(angles);
    
    if (avgElbowAngle > 150) {
      return RepetitionPhase.TOP;
    } else if (avgElbowAngle < 90) {
      return RepetitionPhase.BOTTOM;
    } else {
      // Determinar dirección basada en la fase anterior
      if (this.currentPhase === RepetitionPhase.TOP) {
        return RepetitionPhase.DESCENDING;
      } else {
        return RepetitionPhase.ASCENDING;
      }
    }
  }

  // 🔄 VERIFICAR SI SE COMPLETÓ UNA REPETICIÓN (MEJORADO)
private isRepetitionComplete(newPhase: RepetitionPhase): boolean {
  console.log(`🔍 REPETITION CHECK: ${this.lastPhase} → ${this.currentPhase} → ${newPhase}`);
  
  // ✅ SECUENCIA COMPLETA: TOP → DESCENDING → BOTTOM → ASCENDING → TOP
  const isComplete = (
    this.lastPhase === RepetitionPhase.ASCENDING && 
    this.currentPhase === RepetitionPhase.ASCENDING &&
    newPhase === RepetitionPhase.TOP
  );
  
  if (isComplete) {
    console.log('🎉 ¡REPETICIÓN COMPLETADA!');
    console.log(`📊 Secuencia: ${this.lastPhase} → ${this.currentPhase} → ${newPhase}`);
  }
  
  // ✅ ACTUALIZAR HISTORIAL DE FASES
  this.lastPhase = this.currentPhase;
  
  return isComplete;
}

  // ⏰ VERIFICAR COOLDOWN DE ERRORES
  private checkErrorCooldown(errorType: PostureErrorType, timestamp: number): boolean {
    const lastDetection = this.lastErrorTimestamps.get(errorType) || 0;
    if (timestamp - lastDetection >= this.ERROR_COOLDOWN) {
      this.lastErrorTimestamps.set(errorType, timestamp);
      return true;
    }
    return false;
  }

  // 📊 CALCULAR PUNTUACIÓN DE CALIDAD
  private calculateQualityScore(errors: PostureError[], angles: BiomechanicalAngles): number {
    let baseScore = 100;
    
    // Penalizar por errores
    errors.forEach(error => {
      baseScore -= error.severity * 2;
    });
    
    return Math.max(0, Math.min(100, baseScore));
  }

  // 🔢 MÉTODOS AUXILIARES PARA ÁNGULOS
  private getAverageKneeAngle(angles: BiomechanicalAngles): number {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    return (leftKnee + rightKnee) / 2;
  }

  private getAverageElbowAngle(angles: BiomechanicalAngles): number {
    const leftElbow = angles.left_elbow_angle || 180;
    const rightElbow = angles.right_elbow_angle || 180;
    return (leftElbow + rightElbow) / 2;
  }

  private getAverageHipAngle(angles: BiomechanicalAngles): number {
    const leftHip = angles.left_hip_angle || 180;
    const rightHip = angles.right_hip_angle || 180;
    return (leftHip + rightHip) / 2;
  }
  

  // 🦵 DETECTAR KNEE VALGUS (rodillas hacia adentro)
  private isKneeValgus(pose: PoseKeypoints): boolean {
    if (!pose.left_knee || !pose.right_knee || !pose.left_ankle || !pose.right_ankle) {
      return false;
    }

    // Calcular distancia entre rodillas vs distancia entre tobillos
    const kneeDistance = Math.abs(pose.left_knee.x - pose.right_knee.x);
    const ankleDistance = Math.abs(pose.left_ankle.x - pose.right_ankle.x);
    
    // Si las rodillas están más juntas que los tobillos, hay valgus
    return kneeDistance < ankleDistance * 0.8;
  }

  // 🔄 RESET DEL CONTADOR
  resetCounter(): void {
    this.repetitionCounter = 0;
    this.currentPhase = RepetitionPhase.IDLE;
    this.lastPhase = RepetitionPhase.IDLE;
    console.log('🔄 Contador reseteado');
  }

  // 📈 OBTENER ESTADÍSTICAS
  getStats(): { repetitions: number; currentPhase: RepetitionPhase } {
    return {
      repetitions: this.repetitionCounter,
      currentPhase: this.currentPhase
    };
  }

  // 🧹 LIMPIAR RECURSOS
  cleanup(): void {
    this.lastErrorTimestamps.clear();
    this.repetitionCounter = 0;
    this.currentPhase = RepetitionPhase.IDLE;
    console.log('🧹 BiomechanicsAnalyzer limpiado');
  }
  
}