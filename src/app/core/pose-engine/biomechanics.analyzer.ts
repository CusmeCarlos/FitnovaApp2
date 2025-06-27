// src/app/core/pose-engine/biomechanics.analyzer.ts
// ✅ DETECCIÓN REAL Y PRECISA DE ERRORES

import { Injectable } from '@angular/core';
import { 
  PoseKeypoints, 
  BiomechanicalAngles, 
  PostureError, 
  PostureErrorType,
  ExerciseType,
  RepetitionPhase,
  MovementAnalysis
} from '../../shared/models/pose.models';

export enum ReadinessState {
  NOT_READY = 'NOT_READY',
  GETTING_READY = 'GETTING_READY',
  READY_TO_START = 'READY_TO_START',
  EXERCISING = 'EXERCISING'
}

@Injectable({
  providedIn: 'root'
})
export class BiomechanicsAnalyzer {
  
  private currentExercise: ExerciseType = ExerciseType.SQUATS;
  private currentPhase: RepetitionPhase = RepetitionPhase.IDLE;
  private repetitionCounter = 0;
  private lastErrorTimestamps: Map<PostureErrorType, number> = new Map();
  
  // ✅ NUEVOS: Estados de preparación
  private readinessState: ReadinessState = ReadinessState.NOT_READY;
  private readyFramesCount = 0;
  private readonly FRAMES_TO_CONFIRM_READY = 15;
  private movementDetected = false;
  private lastAngleSnapshot: BiomechanicalAngles | null = null;
  
  // ✅ NUEVOS: Control de errores reales
  private exerciseFramesCount = 0; // Contar frames ejercitándose
  private readonly MIN_EXERCISE_FRAMES = 30; // 1 segundo a 30fps antes de evaluar errores
  private outOfPositionFrames = 0;
  private readonly MAX_OUT_OF_POSITION_FRAMES = 90; // 3 segundos fuera de posición
  
  // ✅ BUFFERS PARA ANÁLISIS TEMPORAL
  private angleHistory: BiomechanicalAngles[] = [];
  private phaseHistory: RepetitionPhase[] = [];
  private readonly SMOOTHING_WINDOW = 5; // Aumentado para mejor estabilidad
  private readonly ERROR_COOLDOWN = 4000; // 4 segundos entre errores iguales
  private readonly MOVEMENT_THRESHOLD = 6; // grados de cambio para detectar movimiento
  
  // ✅ CONTADORES DE FASE PARA REPETICIONES
  private phaseTransitions = {
    topCount: 0,
    bottomCount: 0,
    lastPhase: RepetitionPhase.IDLE
  };

  constructor() {
    console.log('🧠 BiomechanicsAnalyzer inicializado con detección real');
  }

  setCurrentExercise(exerciseType: ExerciseType): void {
    this.currentExercise = exerciseType;
    this.resetAnalysis();
    console.log(`🎯 Ejercicio configurado: ${exerciseType}`);
  }

  // 🔄 ANÁLISIS PRINCIPAL CON DETECCIÓN REAL
  analyzeMovement(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
    // ✅ VERIFICAR SI EL USUARIO ESTÁ COMPLETO EN PANTALLA
    const isUserCompletelyVisible = this.checkUserCompleteness(pose);
    
    if (!isUserCompletelyVisible) {
      this.resetToNotReady();
      return this.createBasicAnalysis([], RepetitionPhase.IDLE, 0, 0);
    }

    // ✅ DETECTAR ESTADO DE PREPARACIÓN
    this.updateReadinessState(pose, angles);

    // ✅ SOLO ANALIZAR SI ESTÁ EJERCITÁNDOSE
    if (this.readinessState === ReadinessState.EXERCISING) {
      return this.performRealExerciseAnalysis(pose, angles);
    } else {
      // En estado de preparación - solo verificar postura inicial
      return this.performReadinessAnalysis(pose, angles);
    }
  }

  // 🔍 VERIFICAR SI EL USUARIO ESTÁ COMPLETO EN PANTALLA
  private checkUserCompleteness(pose: PoseKeypoints): boolean {
    const requiredJoints = [
      'left_shoulder', 'right_shoulder',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle'
    ];

    const visibleJoints = requiredJoints.filter(joint => {
      const point = pose[joint];
      return point && point.visibility > 0.7;
    });

    const completenessRatio = visibleJoints.length / requiredJoints.length;
    
    return completenessRatio >= 0.8; // 80% de las articulaciones visibles
  }

  // 🚦 ACTUALIZAR ESTADO DE PREPARACIÓN
  private updateReadinessState(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    const isInCorrectStartPosition = this.checkStartingPosition(pose, angles);
    const hasMovement = this.detectMovement(angles);

    switch (this.readinessState) {
      case ReadinessState.NOT_READY:
        if (isInCorrectStartPosition) {
          this.readinessState = ReadinessState.GETTING_READY;
          this.readyFramesCount = 1;
          console.log('🔄 Usuario se está preparando...');
        }
        break;

      case ReadinessState.GETTING_READY:
        if (isInCorrectStartPosition) {
          this.readyFramesCount++;
          if (this.readyFramesCount >= this.FRAMES_TO_CONFIRM_READY) {
            this.readinessState = ReadinessState.READY_TO_START;
            console.log('✅ Usuario LISTO para empezar ejercicio');
          }
        } else {
          this.readinessState = ReadinessState.NOT_READY;
          this.readyFramesCount = 0;
        }
        break;

      case ReadinessState.READY_TO_START:
        if (hasMovement) {
          this.readinessState = ReadinessState.EXERCISING;
          this.exerciseFramesCount = 0; // ✅ Resetear contador de frames
          this.movementDetected = true;
          console.log('🏃 Usuario comenzó a ejercitarse');
        } else if (!isInCorrectStartPosition) {
          this.readinessState = ReadinessState.NOT_READY;
          this.readyFramesCount = 0;
        }
        break;

      case ReadinessState.EXERCISING:
        // ✅ VERIFICAR SI SIGUE EN POSICIÓN PARA EJERCITARSE
        if (isInCorrectStartPosition || hasMovement) {
          this.outOfPositionFrames = 0; // Reset contador
          this.exerciseFramesCount++; // Incrementar frames ejercitándose
        } else {
          this.outOfPositionFrames++;
          // Si está fuera de posición por mucho tiempo, volver a preparación
          if (this.outOfPositionFrames >= this.MAX_OUT_OF_POSITION_FRAMES) {
            console.log('⚠️ Usuario fuera de posición por mucho tiempo');
            this.readinessState = ReadinessState.NOT_READY;
            this.exerciseFramesCount = 0;
            this.outOfPositionFrames = 0;
          }
        }
        break;
    }
  }

// 🎯 VERIFICAR POSICIÓN INICIAL CORRECTA (MEJORADA - FRONTAL Y PERFIL)
private checkStartingPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
  switch (this.currentExercise) {
    case ExerciseType.SQUATS:
      return this.checkSquatStartPosition(pose, angles);
    case ExerciseType.PUSHUPS:
      return this.checkPushupStartPosition(pose, angles);
    case ExerciseType.PLANK:
      return this.checkPlankStartPosition(pose, angles);
    default:
      return true;
  }
}

// 🦵 VERIFICAR POSICIÓN INICIAL DE SENTADILLAS (FRONTAL Y PERFIL)
private checkSquatStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
  const leftKnee = angles.left_knee_angle || 0;
  const rightKnee = angles.right_knee_angle || 0;
  const avgKneeAngle = (leftKnee + rightKnee) / 2;

  // ✅ DETECTAR SI ESTÁ DE FRENTE O DE PERFIL
  const isProfileView = this.detectProfileView(pose);
  
  if (isProfileView) {
    console.log('👁️ Usuario de PERFIL detectado');
    return this.checkProfileSquatPosition(pose, angles);
  } else {
    console.log('👁️ Usuario de FRENTE detectado');
    return this.checkFrontalSquatPosition(pose, angles);
  }
}

// 👥 VERIFICAR POSICIÓN FRONTAL
private checkFrontalSquatPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
  const leftKnee = angles.left_knee_angle || 0;
  const rightKnee = angles.right_knee_angle || 0;
  const avgKneeAngle = (leftKnee + rightKnee) / 2;

  // ✅ RODILLAS EXTENDIDAS
  const kneesExtended = avgKneeAngle > 140;
  
  // ✅ VERIFICAR ARTICULACIONES VISIBLES
  const importantJoints = [
    pose.left_shoulder, pose.right_shoulder,
    pose.left_hip, pose.right_hip,
    pose.left_knee, pose.right_knee,
    pose.left_ankle, pose.right_ankle
  ];
  
  const goodVisibility = importantJoints.filter(joint => 
    joint && joint.visibility > 0.6
  ).length >= 6;

  // ✅ VERIFICAR QUE AMBOS PIES ESTÉN EN EL SUELO
  const bothFeetOnGround = this.checkBothFeetOnGround(pose);
  
  // ✅ VERIFICAR SEPARACIÓN DE PIES
  const feetProperlySpaced = this.checkFeetSpacing(pose);

  const isReady = kneesExtended && goodVisibility && bothFeetOnGround && feetProperlySpaced;
  
  console.log(`🦵 Posición frontal: rodillas=${avgKneeAngle.toFixed(1)}°, visible=${goodVisibility}, pies=${bothFeetOnGround}, separación=${feetProperlySpaced} → ${isReady ? 'LISTO' : 'NO LISTO'}`);
  
  return isReady;
}
// 📐 VERIFICAR POSICIÓN DE PERFIL
private checkProfileSquatPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
  // ✅ PARA PERFIL, USAR UN SOLO LADO (EL MÁS VISIBLE)
  const leftKnee = angles.left_knee_angle || 0;
  const rightKnee = angles.right_knee_angle || 0;
  
  // Usar el lado más visible
  const leftVisible = pose.left_knee?.visibility || 0;
  const rightVisible = pose.right_knee?.visibility || 0;
  
  const kneeAngle = leftVisible > rightVisible ? leftKnee : rightKnee;
  
  // ✅ RODILLA EXTENDIDA
  const kneeExtended = kneeAngle > 140;
  
  // ✅ VERIFICAR ARTICULACIONES CLAVE PARA PERFIL
  const keyJoints = [
    pose.nose, pose.left_shoulder, pose.right_shoulder,
    pose.left_hip, pose.right_hip, pose.left_knee, pose.right_knee
  ];
  
  const goodVisibility = keyJoints.filter(joint => 
    joint && joint.visibility > 0.5
  ).length >= 5;

  const isReady = kneeExtended && goodVisibility;
  
  console.log(`📐 Posición perfil: rodilla=${kneeAngle.toFixed(1)}°, visible=${goodVisibility} → ${isReady ? 'LISTO' : 'NO LISTO'}`);
  
  return isReady;
}
// 👣 VERIFICAR QUE AMBOS PIES ESTÉN EN EL SUELO
private checkBothFeetOnGround(pose: PoseKeypoints): boolean {
  const leftAnkle = pose.left_ankle;
  const rightAnkle = pose.right_ankle;
  
  if (!leftAnkle || !rightAnkle) return false;
  
  // ✅ VERIFICAR QUE LOS TOBILLOS ESTÉN A ALTURA SIMILAR (NO UNO LEVANTADO)
  const ankleHeightDiff = Math.abs(leftAnkle.y - rightAnkle.y);
  const bothFeetDown = ankleHeightDiff < 0.1; // Diferencia máxima permitida
  
  console.log(`👣 Diferencia altura tobillos: ${ankleHeightDiff.toFixed(3)} → ${bothFeetDown ? 'AMBOS PIES ABAJO' : 'UN PIE LEVANTADO'}`);
  
  return bothFeetDown;
}
// 📏 VERIFICAR SEPARACIÓN DE PIES
private checkFeetSpacing(pose: PoseKeypoints): boolean {
  const leftAnkle = pose.left_ankle;
  const rightAnkle = pose.right_ankle;
  
  if (!leftAnkle || !rightAnkle) return false;
  
  // ✅ CALCULAR SEPARACIÓN HORIZONTAL
  const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
  const properSpacing = feetDistance > 0.1; // Separación mínima
  
  console.log(`📏 Separación pies: ${feetDistance.toFixed(3)} → ${properSpacing ? 'BIEN SEPARADOS' : 'MUY JUNTOS'}`);
  
  return properSpacing;
}
  private wasReady = false; // Para evitar logs repetitivos
// 👁️ DETECTAR SI ESTÁ DE PERFIL O DE FRENTE
private detectProfileView(pose: PoseKeypoints): boolean {
  const leftShoulder = pose.left_shoulder;
  const rightShoulder = pose.right_shoulder;
  const leftHip = pose.left_hip;
  const rightHip = pose.right_hip;
  
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return false;
  }
  
  // ✅ CALCULAR DISTANCIA ENTRE HOMBROS Y CADERAS
  const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
  const hipDistance = Math.abs(leftHip.x - rightHip.x);
  
  // ✅ SI LAS DISTANCIAS SON MUY PEQUEÑAS, ESTÁ DE PERFIL
  const avgDistance = (shoulderDistance + hipDistance) / 2;
  console.log(`👁️ Distancia promedio hombros/caderas: ${avgDistance.toFixed(3)}`);
  
  return avgDistance < 0.15; // Umbral para detectar perfil
}
  // 💪 VERIFICAR POSICIÓN INICIAL DE FLEXIONES
  private checkPushupStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const leftElbow = angles.left_elbow_angle || 0;
    const rightElbow = angles.right_elbow_angle || 0;
    const avgElbowAngle = (leftElbow + rightElbow) / 2;

    const armsExtended = avgElbowAngle > 160;
    const hipAngle = angles.left_hip_angle || 0;
    const bodyAligned = hipAngle > 160 && hipAngle < 185;

    return armsExtended && bodyAligned;
  }

  // 🏋️ VERIFICAR POSICIÓN INICIAL DE PLANCHA
  private checkPlankStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const hipAngle = angles.left_hip_angle || 0;
    return hipAngle > 165 && hipAngle < 185;
  }

  // 🔄 DETECTAR MOVIMIENTO (MEJORADO)
  private detectMovement(angles: BiomechanicalAngles): boolean {
    if (!this.lastAngleSnapshot) {
      this.lastAngleSnapshot = { ...angles };
      return false;
    }

    // ✅ SOLO VERIFICAR MOVIMIENTO DE RODILLAS PARA SENTADILLAS
    const currentKnee = ((angles.left_knee_angle || 0) + (angles.right_knee_angle || 0)) / 2;
    const previousKnee = ((this.lastAngleSnapshot.left_knee_angle || 0) + (this.lastAngleSnapshot.right_knee_angle || 0)) / 2;
    
    const kneeChange = Math.abs(currentKnee - previousKnee);
    
    this.lastAngleSnapshot = { ...angles };
    
    const hasMovement = kneeChange > this.MOVEMENT_THRESHOLD;
    
    if (hasMovement) {
      console.log(`🔄 Movimiento detectado: ${kneeChange.toFixed(1)}° cambio en rodillas`);
    }
    
    return hasMovement;
  }

  // 🏃 ANÁLISIS REAL DURANTE EJERCICIO
  private performRealExerciseAnalysis(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
    // ✅ SOLO ANALIZAR ERRORES DESPUÉS DE CIERTO TIEMPO EJERCITÁNDOSE
    let errors: PostureError[] = [];
    
    if (this.exerciseFramesCount > this.MIN_EXERCISE_FRAMES) {
      // ✅ AHORA SÍ ANALIZAR ERRORES REALES
      errors = this.detectRealPosturalErrors(pose, angles);
    } else {
      // ✅ PERÍODO DE GRACIA - NO DETECTAR ERRORES AÚN
      console.log(`⏳ Período de gracia: ${this.exerciseFramesCount}/${this.MIN_EXERCISE_FRAMES} frames`);
    }

    // Agregar a historia
    this.angleHistory.push(angles);
    if (this.angleHistory.length > this.SMOOTHING_WINDOW) {
      this.angleHistory.shift();
    }

    // Detectar fase actual
    const currentPhase = this.detectPhase(angles);
    this.currentPhase = currentPhase;

    // Contar repeticiones
    this.updateRepetitionCount(currentPhase);

    // Calcular puntuación
    const qualityScore = this.calculateQualityScore(errors, angles);

    return {
      errors,
      phase: currentPhase,
      repetitionCount: this.repetitionCounter,
      qualityScore
    };
  }

  // ⚠️ DETECTAR ERRORES POSTURALES REALES (MEJORADO)
  private detectRealPosturalErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    const errors: PostureError[] = [];
    const timestamp = Date.now();

    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        errors.push(...this.detectRealSquatErrors(pose, angles, timestamp));
        break;
      case ExerciseType.PUSHUPS:
        errors.push(...this.detectPushupErrors(pose, angles, timestamp));
        break;
      case ExerciseType.PLANK:
        errors.push(...this.detectPlankErrors(pose, angles, timestamp));
        break;
      case ExerciseType.LUNGES:
        errors.push(...this.detectLungeErrors(pose, angles, timestamp));
        break;
    }

    return errors;
  }

 // 🦵 DETECCIÓN DE ERRORES COMPLETA (FRONTAL Y PERFIL)
private detectRealSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];
  
  // ✅ DETECTAR ORIENTACIÓN
  const isProfileView = this.detectProfileView(pose);
  
  if (isProfileView) {
    console.log('🔍 ANALIZANDO ERRORES DE PERFIL');
    errors.push(...this.detectProfileSquatErrors(pose, angles, timestamp));
  } else {
    console.log('🔍 ANALIZANDO ERRORES FRONTALES');
    errors.push(...this.detectFrontalSquatErrors(pose, angles, timestamp));
  }
  
  // ✅ ERRORES COMUNES PARA AMBAS ORIENTACIONES
  errors.push(...this.detectCommonSquatErrors(pose, angles, timestamp));
  
  // ✅ PRIORIZAR EL ERROR MÁS SEVERO
  if (errors.length > 1) {
    const mostSevere = errors.reduce((prev, current) => 
      current.severity > prev.severity ? current : prev
    );
    console.log(`🎯 Error priorizado: ${mostSevere.type} (severidad ${mostSevere.severity})`);
    return [mostSevere];
  }

  if (errors.length === 0 && this.exerciseFramesCount > 60) {
    console.log('✅ SENTADILLA PERFECTA detectada');
  }

  return errors;
}
private detectFrontalSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];
  const leftKnee = angles.left_knee_angle || 0;
  const rightKnee = angles.right_knee_angle || 0;

  // 🔴 CRÍTICO: RODILLAS MUY JUNTAS
  if (!this.checkFeetSpacing(pose) && this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
    errors.push({
      type: PostureErrorType.KNEE_VALGUS,
      severity: 8, // ROJO CRÍTICO
      description: 'Rodillas colapsadas hacia adentro',
      recommendation: 'CRÍTICO: Separa las rodillas, empuja hacia afuera',
      affectedJoints: ['left_knee', 'right_knee'],
      confidence: 0.9,
      timestamp
    });
  }
  
  // 🟠 MODERADO: PIES MUY JUNTOS
  const leftAnkle = pose.left_ankle;
  const rightAnkle = pose.right_ankle;
  if (leftAnkle && rightAnkle) {
    const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
    if (feetDistance < 0.08 && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: 5, // NARANJA
        description: 'Pies muy juntos para sentadilla',
        recommendation: 'Abre más las piernas, separa los pies',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.8,
        timestamp
      });
    }
  }

  // 🔴 CRÍTICO: UN PIE LEVANTADO
  if (!this.checkBothFeetOnGround(pose) && this.checkErrorCooldown(PostureErrorType.UNSTABLE_BALANCE, timestamp)) {
    errors.push({
      type: PostureErrorType.UNSTABLE_BALANCE,
      severity: 8, // ROJO CRÍTICO
      description: 'Un pie está levantado',
      recommendation: 'CRÍTICO: Pon ambos pies en el suelo',
      affectedJoints: ['left_ankle', 'right_ankle'],
      confidence: 0.95,
      timestamp
    });
  }

  return errors;
}
// 📐 DETECTAR ERRORES DE PERFIL
private detectProfileSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];
  
  // ✅ USAR EL LADO MÁS VISIBLE
  const leftVisible = pose.left_knee?.visibility || 0;
  const rightVisible = pose.right_knee?.visibility || 0;
  const kneeAngle = leftVisible > rightVisible ? 
    (angles.left_knee_angle || 0) : (angles.right_knee_angle || 0);

  // 🟠 MODERADO: SENTADILLA POCO PROFUNDA (PERFIL)
  if (this.currentPhase === RepetitionPhase.BOTTOM && 
      kneeAngle > 120 && 
      this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
    errors.push({
      type: PostureErrorType.INSUFFICIENT_DEPTH,
      severity: 5, // NARANJA
      description: `Sentadilla poco profunda - ${kneeAngle.toFixed(1)}°`,
      recommendation: 'Baja más, flexiona más las rodillas',
      affectedJoints: ['left_knee', 'right_knee'],
      confidence: 0.8,
      timestamp
    });
  }

  return errors;
}
// 🌐 ERRORES COMUNES (FRONTAL Y PERFIL)
private detectCommonSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];
  const spineAngle = angles.spine_angle || 85;

  // 🔴 CRÍTICO: ESPALDA MUY CURVADA
  if (spineAngle < 60 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
    errors.push({
      type: PostureErrorType.ROUNDED_BACK,
      severity: 8, // ROJO CRÍTICO
      description: `Espalda muy curvada - ${spineAngle.toFixed(1)}°`,
      recommendation: 'CRÍTICO: Endereza la espalda, saca el pecho',
      affectedJoints: ['spine'],
      confidence: 0.9,
      timestamp
    });
  }
  // 🟠 MODERADO: LIGERA CURVATURA
  else if (spineAngle < 75 && this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
    errors.push({
      type: PostureErrorType.FORWARD_LEAN,
      severity: 4, // NARANJA
      description: `Ligera inclinación - ${spineAngle.toFixed(1)}°`,
      recommendation: 'Mantén la espalda más recta',
      affectedJoints: ['spine'],
      confidence: 0.7,
      timestamp
    });
  }

  // 🟠 MODERADO: CABEZA AGACHADA
  const headPosition = this.checkHeadPosition(pose);
  if (!headPosition && this.checkErrorCooldown(PostureErrorType.HEAD_POSITION, timestamp)) {
    errors.push({
      type: PostureErrorType.HEAD_POSITION,
      severity: 4, // NARANJA
      description: 'Cabeza muy agachada',
      recommendation: 'Mira al frente, mantén la cabeza alta',
      affectedJoints: ['nose'],
      confidence: 0.8,
      timestamp
    });
  }

  return errors;
}

// 👤 VERIFICAR POSICIÓN DE LA CABEZA
private checkHeadPosition(pose: PoseKeypoints): boolean {
  const nose = pose.nose;
  const leftShoulder = pose.left_shoulder;
  const rightShoulder = pose.right_shoulder;
  
  if (!nose || !leftShoulder || !rightShoulder) return true;
  
  // ✅ CALCULAR ALTURA RELATIVA DE LA CABEZA
  const shoulderAvgY = (leftShoulder.y + rightShoulder.y) / 2;
  const headRelativePosition = nose.y - shoulderAvgY;
  
  // ✅ LA CABEZA DEBE ESTAR CLARAMENTE ARRIBA DE LOS HOMBROS
  const goodHeadPosition = headRelativePosition < -0.1; // Cabeza arriba
  
  console.log(`👤 Posición cabeza: ${headRelativePosition.toFixed(3)} → ${goodHeadPosition ? 'BIEN' : 'AGACHADA'}`);
  
  return goodHeadPosition;
}
  // 🚦 ANÁLISIS EN ESTADO DE PREPARACIÓN
  private performReadinessAnalysis(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
    const errors: PostureError[] = [];
    
    // ✅ SOLO DAR CONSEJOS DE POSICIONAMIENTO SI NO ESTÁ LISTO
    if (this.readinessState === ReadinessState.NOT_READY) {
      const positionErrors = this.checkPositionErrors(pose, angles);
      errors.push(...positionErrors);
    }

    return this.createBasicAnalysis(errors, RepetitionPhase.IDLE, this.repetitionCounter, 70);
  }

  private checkPositionErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    const errors: PostureError[] = [];
    const timestamp = Date.now();
  
    if (this.currentExercise === ExerciseType.SQUATS) {
      
      // ✅ DETECTAR SI ESTÁ DE FRENTE O DE PERFIL
      const isProfileView = this.detectProfileView(pose);
      
      if (!isProfileView) {
        // 🟠 ERRORES DE POSICIÓN FRONTAL
        
        // ERROR: PIES MUY JUNTOS
        if (!this.checkFeetSpacing(pose) && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
          errors.push({
            type: PostureErrorType.POOR_ALIGNMENT,
            severity: 5, // NARANJA - NO PUEDE EMPEZAR
            description: 'Pies muy juntos para hacer sentadillas',
            recommendation: 'Abre más las piernas, separa los pies',
            affectedJoints: ['left_ankle', 'right_ankle'],
            confidence: 0.9,
            timestamp
          });
        }
  
        // ERROR: UN PIE LEVANTADO
        if (!this.checkBothFeetOnGround(pose) && this.checkErrorCooldown(PostureErrorType.UNSTABLE_BALANCE, timestamp)) {
          errors.push({
            type: PostureErrorType.UNSTABLE_BALANCE,
            severity: 6, // NARANJA - NO PUEDE EMPEZAR
            description: 'Un pie está levantado',
            recommendation: 'Pon ambos pies en el suelo',
            affectedJoints: ['left_ankle', 'right_ankle'],
            confidence: 0.95,
            timestamp
          });
        }
      }
  
      // ✅ ERRORES COMUNES (FRONTAL Y PERFIL)
      
      // ERROR: MUY AGACHADO
      const leftKnee = angles.left_knee_angle || 0;
      const rightKnee = angles.right_knee_angle || 0;
      const avgKneeAngle = isProfileView ? 
        Math.max(leftKnee, rightKnee) : // Perfil: usar el más visible
        (leftKnee + rightKnee) / 2;     // Frontal: promedio
  
      if (avgKneeAngle < 120 && this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
        errors.push({
          type: PostureErrorType.INSUFFICIENT_DEPTH,
          severity: 4, // NARANJA
          description: 'Estás muy agachado para empezar',
          recommendation: 'Ponte de pie completamente, estira las piernas',
          affectedJoints: ['left_knee', 'right_knee'],
          confidence: 0.8,
          timestamp
        });
      }
  
      // ERROR: ESPALDA CURVADA INICIAL
      const spineAngle = angles.spine_angle || 85;
      if (spineAngle < 70 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
        errors.push({
          type: PostureErrorType.ROUNDED_BACK,
          severity: 5, // NARANJA
          description: 'Espalda curvada en posición inicial',
          recommendation: 'Endereza la espalda antes de empezar',
          affectedJoints: ['spine'],
          confidence: 0.8,
          timestamp
        });
      }
  
      // ERROR: CABEZA AGACHADA INICIAL
      if (!this.checkHeadPosition(pose) && this.checkErrorCooldown(PostureErrorType.HEAD_POSITION, timestamp)) {
        errors.push({
          type: PostureErrorType.HEAD_POSITION,
          severity: 3, // NARANJA SUAVE
          description: 'Cabeza muy agachada',
          recommendation: 'Levanta la cabeza, mira al frente',
          affectedJoints: ['nose'],
          confidence: 0.7,
          timestamp
        });
      }
    }
  
    return errors;
  }

  // 🔄 RESETEAR A NO LISTO
  private resetToNotReady(): void {
    if (this.readinessState !== ReadinessState.NOT_READY) {
      console.log('🔄 Usuario fuera de cámara - reseteando a NOT_READY');
      this.readinessState = ReadinessState.NOT_READY;
      this.exerciseFramesCount = 0;
      this.outOfPositionFrames = 0;
      this.readyFramesCount = 0;
    }
  }

  // 📊 OBTENER ESTADO DE PREPARACIÓN ACTUAL
  getReadinessState(): ReadinessState {
    return this.readinessState;
  }

  // 📝 OBTENER MENSAJE DE PREPARACIÓN
  getReadinessMessage(): string {
    switch (this.readinessState) {
      case ReadinessState.NOT_READY:
        return 'Posiciónate para hacer el ejercicio';
      case ReadinessState.GETTING_READY:
        return 'Mantén la posición...';
      case ReadinessState.READY_TO_START:
        return '¡Listo para empezar! Comienza el ejercicio';
      case ReadinessState.EXERCISING:
        return 'Ejercitándose';
      default:
        return 'Preparándose...';
    }
  }

  // [MANTENER TODOS LOS MÉTODOS RESTANTES IGUAL]
  // detectPhase, updateRepetitionCount, etc.

  private detectPhase(angles: BiomechanicalAngles): RepetitionPhase {
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.detectSquatPhase(angles);
      case ExerciseType.PUSHUPS:
        return this.detectPushupPhase(angles);
      case ExerciseType.PLANK:
        return RepetitionPhase.HOLD;
      case ExerciseType.LUNGES:
        return this.detectLungePhase(angles);
      default:
        return RepetitionPhase.IDLE;
    }
  }

  private detectSquatPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    if (avgKneeAngle > 140) {
      return RepetitionPhase.TOP;
    } else if (avgKneeAngle < 120) {
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevAngles = this.angleHistory[this.angleHistory.length - 2];
        const prevLeftKnee = prevAngles.left_knee_angle || 180;
        const prevRightKnee = prevAngles.right_knee_angle || 180;
        const prevAvgKnee = (prevLeftKnee + prevRightKnee) / 2;
        
        return avgKneeAngle < prevAvgKnee ? RepetitionPhase.DESCENDING : RepetitionPhase.ASCENDING;
      }
      return RepetitionPhase.DESCENDING;
    }
  }

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
        const prevAngles = this.angleHistory[this.angleHistory.length - 2];
        const prevLeftElbow = prevAngles.left_elbow_angle || 180;
        const prevRightElbow = prevAngles.right_elbow_angle || 180;
        const prevAvgElbow = (prevLeftElbow + prevRightElbow) / 2;
        
        return avgElbowAngle < prevAvgElbow ? RepetitionPhase.DESCENDING : RepetitionPhase.ASCENDING;
      }
      return RepetitionPhase.DESCENDING;
    }
  }

  private detectLungePhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const minKneeAngle = Math.min(leftKnee, rightKnee);

    if (minKneeAngle > 150) {
      return RepetitionPhase.TOP;
    } else if (minKneeAngle < 100) {
      return RepetitionPhase.BOTTOM;
    } else {
      return minKneeAngle < 130 ? RepetitionPhase.DESCENDING : RepetitionPhase.ASCENDING;
    }
  }

  private updateRepetitionCount(currentPhase: RepetitionPhase): void {
    if (currentPhase === RepetitionPhase.TOP && this.phaseTransitions.lastPhase !== RepetitionPhase.TOP) {
      this.phaseTransitions.topCount++;
    }
    
    if (currentPhase === RepetitionPhase.BOTTOM && this.phaseTransitions.lastPhase !== RepetitionPhase.BOTTOM) {
      this.phaseTransitions.bottomCount++;
    }

    const completedCycles = Math.min(this.phaseTransitions.topCount, this.phaseTransitions.bottomCount);
    
    if (completedCycles > this.repetitionCounter) {
      this.repetitionCounter = completedCycles;
      console.log(`🎉 ¡REPETICIÓN COMPLETADA! Total: ${this.repetitionCounter}`);
    }

    this.phaseTransitions.lastPhase = currentPhase;
  }

  private detectPushupErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    const hipAngle = angles.left_hip_angle || 180;
    if (hipAngle < 160 && this.checkErrorCooldown(PostureErrorType.DROPPED_HIPS, timestamp)) {
      errors.push({
        type: PostureErrorType.DROPPED_HIPS,
        severity: 7,
        description: `Caderas caídas (${hipAngle.toFixed(1)}°)`,
        recommendation: 'Contrae el core, mantén cuerpo recto',
        affectedJoints: ['left_hip', 'right_hip'],
        confidence: 0.9,
        timestamp
      });
    }

    const leftElbow = angles.left_elbow_angle || 180;
    const rightElbow = angles.right_elbow_angle || 180;
    if ((leftElbow < 45 || rightElbow < 45) && this.checkErrorCooldown(PostureErrorType.EXCESSIVE_ELBOW_FLARE, timestamp)) {
      errors.push({
        type: PostureErrorType.EXCESSIVE_ELBOW_FLARE,
        severity: 5,
        description: 'Codos muy abiertos, riesgo de lesión',
        recommendation: 'Mantén codos cerca del cuerpo, ángulo 45°',
        affectedJoints: ['left_elbow', 'right_elbow'],
        confidence: 0.85,
        timestamp
      });
    }

    return errors;
  }

  private detectPlankErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    const hipAngle = angles.left_hip_angle || 180;
    if (hipAngle > 185 && this.checkErrorCooldown(PostureErrorType.HIGH_HIPS, timestamp)) {
      errors.push({
        type: PostureErrorType.HIGH_HIPS,
        severity: 6,
        description: `Caderas muy altas (${hipAngle.toFixed(1)}°)`,
        recommendation: 'Baja las caderas, forma línea recta',
        affectedJoints: ['left_hip', 'right_hip'],
        confidence: 0.88,
        timestamp
      });
    }

    if (hipAngle < 160 && this.checkErrorCooldown(PostureErrorType.DROPPED_HIPS, timestamp)) {
      errors.push({
        type: PostureErrorType.DROPPED_HIPS,
        severity: 7,
        description: `Caderas caídas (${hipAngle.toFixed(1)}°)`,
        recommendation: 'Contrae el core, sube las caderas',
        affectedJoints: ['left_hip', 'right_hip'],
        confidence: 0.9,
        timestamp
      });
    }

    return errors;
  }

  private detectLungeErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    const frontKnee = Math.min(angles.left_knee_angle || 180, angles.right_knee_angle || 180);
    if (frontKnee < 80 && this.checkErrorCooldown(PostureErrorType.KNEE_FORWARD, timestamp)) {
      errors.push({
        type: PostureErrorType.KNEE_FORWARD,
        severity: 6,
        description: `Rodilla muy adelantada (${frontKnee.toFixed(1)}°)`,
        recommendation: 'Da un paso más largo, peso en el talón',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.8,
        timestamp
      });
    }

    return errors;
  }

 // ✅ BUSCAR EN biomechanics.analyzer.ts el método checkErrorCooldown
// Y REEMPLAZARLO con este código:

// ⏰ VERIFICAR COOLDOWN DE ERRORES (MEJORADO)
private checkErrorCooldown(errorType: PostureErrorType, timestamp: number): boolean {
  const lastDetection = this.lastErrorTimestamps.get(errorType) || 0;
  
  // ✅ COOLDOWN DIFERENTE SEGÚN SEVERIDAD
  let cooldownTime = this.ERROR_COOLDOWN; // 4000ms por defecto
  
  // Errores críticos: cooldown más largo (no molestar tanto)
  if (errorType === PostureErrorType.KNEE_VALGUS || 
      errorType === PostureErrorType.ROUNDED_BACK ||
      errorType === PostureErrorType.POOR_ALIGNMENT) {
    cooldownTime = 6000; // 6 segundos para errores críticos
  }
  
  // Errores moderados: cooldown más corto (corregir más frecuentemente)
  if (errorType === PostureErrorType.ASYMMETRY || 
      errorType === PostureErrorType.FORWARD_LEAN ||
      errorType === PostureErrorType.HEEL_RISE ||
      errorType === PostureErrorType.INSUFFICIENT_DEPTH) {
    cooldownTime = 3000; // 3 segundos para errores moderados
  }
  
  if (timestamp - lastDetection >= cooldownTime) {
    this.lastErrorTimestamps.set(errorType, timestamp);
    console.log(`✅ Error ${errorType} permitido (cooldown: ${cooldownTime}ms)`);
    return true;
  }
  
  const remainingTime = cooldownTime - (timestamp - lastDetection);
  console.log(`⏸️ Error ${errorType} en cooldown (quedan ${remainingTime.toFixed(0)}ms)`);
  return false;
}

  private calculateQualityScore(errors: PostureError[], angles: BiomechanicalAngles): number {
    let baseScore = 100;

    errors.forEach(error => {
      if (error.severity >= 7) {
        baseScore -= 20;
      } else if (error.severity >= 5) {
        baseScore -= 10;
      } else {
        baseScore -= 5;
      }
    });

    if (errors.length === 0) {
      baseScore += 5;
    }

    return Math.max(0, Math.min(100, baseScore));
  }

  generatePositiveMessage(): string {
    const messages = [
      '¡Excelente forma! Sigue así',
      '¡Perfecto! Tu técnica es impecable',
      '¡Muy bien! Mantén esa postura',
      '¡Increíble! Tu forma es excelente',
      '¡Fantástico! Técnica perfecta'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private createBasicAnalysis(errors: PostureError[], phase: RepetitionPhase, reps: number, quality: number): MovementAnalysis {
    return {
      errors,
      phase,
      repetitionCount: reps,
      qualityScore: quality
    };
  }

  private resetAnalysis(): void {
    this.currentPhase = RepetitionPhase.IDLE;
    this.repetitionCounter = 0;
    this.angleHistory = [];
    this.phaseHistory = [];
    this.lastErrorTimestamps.clear();
    this.phaseTransitions = {
      topCount: 0,
      bottomCount: 0,
      lastPhase: RepetitionPhase.IDLE
    };
    this.readinessState = ReadinessState.NOT_READY;
    this.readyFramesCount = 0;
    this.movementDetected = false;
    this.lastAngleSnapshot = null;
    this.exerciseFramesCount = 0;
    this.outOfPositionFrames = 0;
    this.wasReady = false;
    console.log('🔄 Análisis reseteado');
  }

  cleanup(): void {
    this.resetAnalysis();
    console.log('🧹 BiomechanicsAnalyzer limpiado');
  }
}