// src/app/core/pose-engine/biomechanics.analyzer.ts
// ✅ CORRECCIÓN COMPLETA - DETECCIÓN QUE SÍ FUNCIONA

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
  
  // ✅ Estados de preparación
  private readinessState: ReadinessState = ReadinessState.NOT_READY;
  private readyFramesCount = 0;
  private readonly FRAMES_TO_CONFIRM_READY = 15;
  private movementDetected = false;
  private lastAngleSnapshot: BiomechanicalAngles | null = null;
  
  // ✅ Control de errores reales
  private exerciseFramesCount = 0;
  private readonly MIN_EXERCISE_FRAMES = 30;
  private outOfPositionFrames = 0;
  private readonly MAX_OUT_OF_POSITION_FRAMES = 90;
  
  // ✅ BUFFERS PARA ANÁLISIS TEMPORAL
  private angleHistory: BiomechanicalAngles[] = [];
  private phaseHistory: RepetitionPhase[] = [];
  private readonly SMOOTHING_WINDOW = 5;
  private readonly ERROR_COOLDOWN = 4000; // 4 segundos entre errores iguales
  private readonly MOVEMENT_THRESHOLD = 6;
  
  // ✅ CONTADORES DE FASE PARA REPETICIONES
  private phaseTransitions = {
    topCount: 0,
    bottomCount: 0,
    lastPhase: RepetitionPhase.IDLE
  };

  private wasReady = false; // Para evitar logs repetitivos

  constructor() {
    console.log('🧠 BiomechanicsAnalyzer inicializado con detección CORREGIDA');
  }

  setCurrentExercise(exerciseType: ExerciseType): void {
    this.currentExercise = exerciseType;
    this.resetAnalysis();
    console.log(`🎯 Ejercicio configurado: ${exerciseType}`);
  }

  // 🔄 MÉTODO PRINCIPAL DE ANÁLISIS (CORREGIDO)
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

  // ============================================================================
  // ✅ MÉTODOS DE DETECCIÓN CORREGIDOS
  // ============================================================================

  // 4. ✅ DETECCIÓN DE PERFIL MEJORADA - MÁS SENSIBLE
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
  
  // ✅ UMBRAL MÁS SENSIBLE PARA PERFIL
  const avgDistance = (shoulderDistance + hipDistance) / 2;
  const isProfile = avgDistance < 0.10; // MÁS SENSIBLE
  
  console.log(`👁️ Detección: dist=${avgDistance.toFixed(3)} → ${isProfile ? '📐 PERFIL' : '👥 FRONTAL'}`);
  
  return isProfile;
}

  private checkBothFeetOnGround(pose: PoseKeypoints): boolean {
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;
    
    // ✅ REQUERIR ALTA VISIBILIDAD
    if (!leftAnkle || !rightAnkle || 
        leftAnkle.visibility < 0.8 || rightAnkle.visibility < 0.8) {
      return true; // Si no se detecta claramente, no molestar
    }
    
    // ✅ VERIFICAR ALTURA SIMILAR - MÁS ESTRICTO
    const ankleHeightDiff = Math.abs(leftAnkle.y - rightAnkle.y);
    const bothFeetDown = ankleHeightDiff < 0.04; // MUY ESTRICTO
    
    if (!bothFeetDown) {
      console.log(`🚨 PIE LEVANTADO: diferencia=${ankleHeightDiff.toFixed(3)}`);
    }
    
    return bothFeetDown;
  }

  private checkFeetSpacing(pose: PoseKeypoints): boolean {
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;
    
    // ✅ REQUERIR ALTA VISIBILIDAD
    if (!leftAnkle || !rightAnkle || 
        leftAnkle.visibility < 0.8 || rightAnkle.visibility < 0.8) {
      return true; // Si no se detecta claramente, no molestar
    }
    
    // ✅ SEPARACIÓN HORIZONTAL - MÁS ESTRICTO
    const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
    const properSpacing = feetDistance > 0.12; // MÁS ESTRICTO
    
    if (!properSpacing) {
      console.log(`🚨 PIES MUY JUNTOS: distancia=${feetDistance.toFixed(3)}`);
    }
    
    return properSpacing;
  }


  // 3. ✅ DETECCIÓN CONSISTENTE DE RODILLAS - MÁS ESTRICTA
private checkKneePosition(pose: PoseKeypoints): boolean {
  const leftKnee = pose.left_knee;
  const rightKnee = pose.right_knee;
  
  // ✅ REQUERIR ALTA VISIBILIDAD
  if (!leftKnee || !rightKnee || 
      leftKnee.visibility < 0.8 || rightKnee.visibility < 0.8) {
    return true; // Si no se detecta claramente, no molestar
  }
  
  // ✅ DISTANCIA ENTRE RODILLAS - MÁS ESTRICTO
  const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
  const goodKneePosition = kneeDistance > 0.08; // MÁS ESTRICTO
  
  if (!goodKneePosition) {
    console.log(`🚨 RODILLAS MUY JUNTAS: distancia=${kneeDistance.toFixed(3)}`);
  }
  
  return goodKneePosition;
}

  // ============================================================================
  // ✅ DETECCIÓN DE ERRORES ESPECÍFICOS - CORREGIDA
  // ============================================================================

  // 🦵 DETECCIÓN DE ERRORES COMPLETA (FRONTAL Y PERFIL) - CORREGIDA
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

  // 👥 DETECTAR ERRORES FRONTALES - CORREGIDO
  private detectFrontalSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // 🔴 CRÍTICO: RODILLAS MUY JUNTAS (KNEE VALGUS)
    if (!this.checkKneePosition(pose) && this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
      errors.push({
        type: PostureErrorType.KNEE_VALGUS,
        severity: 9, // ROJO CRÍTICO
        description: 'Rodillas colapsadas hacia adentro',
        recommendation: 'CRÍTICO: Separa las rodillas, empuja hacia afuera',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.9,
        timestamp
      });
      console.log('🔴 DETECTADO: Rodillas muy juntas (CRÍTICO)');
    }
    
    // 🟠 MODERADO: PIES MUY JUNTOS
    if (!this.checkFeetSpacing(pose) && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: 5, // NARANJA
        description: 'Pies muy juntos para sentadilla',
        recommendation: 'Abre más las piernas, separa los pies',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.8,
        timestamp
      });
      console.log('🟠 DETECTADO: Pies muy juntos');
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
      console.log('🔴 DETECTADO: Un pie levantado (CRÍTICO)');
    }

    return errors;
  }

// 9. ✅ CORREGIR: Detección de espalda curvada DURANTE ejercicio (PERFIL)
private detectProfileSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
  const errors: PostureError[] = [];
  
  // ✅ USAR EL LADO MÁS VISIBLE
  const leftVisible = pose.left_knee?.visibility || 0;
  const rightVisible = pose.right_knee?.visibility || 0;
  const kneeAngle = leftVisible > rightVisible ? 
    (angles.left_knee_angle || 0) : (angles.right_knee_angle || 0);

  // ✅ VERIFICAR ESPALDA CURVADA (DE PERFIL) - MÁS SENSIBLE
  const spineAngle = angles.spine_angle || 90;
  if (spineAngle < 75 && this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
    const severity = spineAngle < 60 ? 8 : 5; // CRÍTICO si muy curvada
    errors.push({
      type: PostureErrorType.FORWARD_LEAN,
      severity: severity,
      description: severity > 7 ? 'Espalda muy curvada (crítico)' : 'Endereza la espalda',
      recommendation: severity > 7 ? 'CRÍTICO: Endereza la espalda, saca el pecho' : 'Mantén la espalda más recta',
      affectedJoints: ['spine'],
      confidence: 0.9,
      timestamp
    });
    console.log(`${severity > 7 ? '🔴' : '🟠'} EJERCICIO PERFIL: Espalda curvada ${spineAngle.toFixed(1)}°`);
  }

  // ✅ SENTADILLA POCO PROFUNDA (SOLO EN FASE BOTTOM)
  if (kneeAngle > 110 && this.currentPhase === RepetitionPhase.BOTTOM && 
      this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
    errors.push({
      type: PostureErrorType.INSUFFICIENT_DEPTH,
      severity: 5, // NARANJA
      description: 'No bajas lo suficiente',
      recommendation: 'Baja más, flexiona más las rodillas',
      affectedJoints: ['left_knee', 'right_knee'],
      confidence: 0.8,
      timestamp
    });
    console.log('🟠 EJERCICIO PERFIL: Sentadilla poco profunda');
  }

  return errors;
}

  // ⚙️ DETECTAR ERRORES COMUNES - CORREGIDO
  private detectCommonSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // ✅ VERIFICAR QUE NO ESTÉ MUY AGACHADO (POSICIÓN INICIAL)
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    if (avgKneeAngle < 140 && this.readinessState !== ReadinessState.EXERCISING && 
        this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: 5, // NARANJA
        description: 'Ponte de pie completamente',
        recommendation: 'Extiende las piernas, ponte de pie',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.8,
        timestamp
      });
      console.log('🟠 DETECTADO: Muy agachado en posición inicial');
    }

    return errors;
  }

  // ============================================================================
  // ✅ MÉTODOS AUXILIARES CORREGIDOS
  // ============================================================================

  // 🔍 VERIFICAR SI EL USUARIO ESTÁ COMPLETO EN PANTALLA
  private checkUserCompleteness(pose: PoseKeypoints): boolean {
    const requiredJoints = [
      'left_shoulder', 'right_shoulder',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle'
    ];

    const visibleJoints = requiredJoints.filter(joint => {
      const point = pose[joint as keyof PoseKeypoints];
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
          this.exerciseFramesCount = 0;
          this.movementDetected = true;
          console.log('🏃 Usuario comenzó a ejercitarse');
        } else if (!isInCorrectStartPosition) {
          this.readinessState = ReadinessState.NOT_READY;
          this.readyFramesCount = 0;
        }
        break;

      case ReadinessState.EXERCISING:
        if (isInCorrectStartPosition || hasMovement) {
          this.outOfPositionFrames = 0;
          this.exerciseFramesCount++;
        } else {
          this.outOfPositionFrames++;
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

  // 🎯 VERIFICAR POSICIÓN INICIAL CORRECTA
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

  // 🦵 VERIFICAR POSICIÓN INICIAL DE SENTADILLAS
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

  // 🔄 DETECTAR MOVIMIENTO
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

// 5. ✅ CORREGIR ANÁLISIS DURANTE EJERCICIO - NO MENSAJES ALEATORIOS
private performRealExerciseAnalysis(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
  let errors: PostureError[] = [];
  
  // ✅ SOLO ANALIZAR ERRORES DURANTE MOVIMIENTO ACTIVO
  const isActivelyExercising = this.exerciseFramesCount > this.MIN_EXERCISE_FRAMES && 
      (this.currentPhase === RepetitionPhase.DESCENDING || 
       this.currentPhase === RepetitionPhase.BOTTOM || 
       this.currentPhase === RepetitionPhase.ASCENDING);
  
  if (isActivelyExercising) {
    errors = this.detectRealPosturalErrors(pose, angles);
    console.log(`🏃 ANALIZANDO ERRORES: fase=${this.currentPhase}, errores=${errors.length}`);
  } else {
    console.log(`⏸️ NO ANALIZANDO: frames=${this.exerciseFramesCount}, fase=${this.currentPhase}`);
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
// 6. ✅ CORREGIR DETECCIÓN EN PREPARACIÓN - PERFIL VS FRONTAL
private performReadinessAnalysis(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
  const errors: PostureError[] = [];
  
  // ✅ SOLO DAR CONSEJOS SI NO ESTÁ LISTO
  if (this.readinessState === ReadinessState.NOT_READY) {
    const isProfileView = this.detectProfileView(pose);
    
    if (isProfileView) {
      console.log('📐 ANALIZANDO ERRORES DE PREPARACIÓN - PERFIL');
      const profileErrors = this.checkProfileReadinessErrors(pose, angles);
      errors.push(...profileErrors);
    } else {
      console.log('👥 ANALIZANDO ERRORES DE PREPARACIÓN - FRONTAL');
      const frontalErrors = this.checkFrontalReadinessErrors(pose, angles);
      errors.push(...frontalErrors);
    }
  }

  return this.createBasicAnalysis(errors, RepetitionPhase.IDLE, this.repetitionCounter, 70);
}

// 7. ✅ NUEVO: Errores de preparación SOLO para vista FRONTAL
private checkFrontalReadinessErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
  const errors: PostureError[] = [];
  const timestamp = Date.now();

  // ERROR: PIES MUY JUNTOS (FRONTAL)
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
    console.log('🟠 PREPARACIÓN: Pies muy juntos');
  }

  // ERROR: UN PIE LEVANTADO (FRONTAL)
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
    console.log('🟠 PREPARACIÓN: Un pie levantado');
  }

  // ERROR: MUY AGACHADO (FRONTAL)
  const leftKnee = angles.left_knee_angle || 0;
  const rightKnee = angles.right_knee_angle || 0;
  const avgKneeAngle = (leftKnee + rightKnee) / 2;

  if (avgKneeAngle < 130 && this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
    errors.push({
      type: PostureErrorType.INSUFFICIENT_DEPTH,
      severity: 4, // NARANJA
      description: 'Estás muy agachado para empezar',
      recommendation: 'Ponte de pie completamente, estira las piernas',
      affectedJoints: ['left_knee', 'right_knee'],
      confidence: 0.8,
      timestamp
    });
    console.log('🟠 PREPARACIÓN: Muy agachado');
  }

  return errors;
}

// 8. ✅ CORREGIR: Errores de preparación PERFIL - DETECTAR ESPALDA CURVADA
private checkProfileReadinessErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
  const errors: PostureError[] = [];
  const timestamp = Date.now();

  // ✅ DETECTAR ESPALDA CURVADA EN PERFIL (PREPARACIÓN) - MÁS SENSIBLE
  const spineAngle = angles.spine_angle || 85;
  if (spineAngle < 78 && this.checkErrorCooldown(PostureErrorType.FORWARD_LEAN, timestamp)) {
    const severity = spineAngle < 65 ? 8 : 5; // CRÍTICO si muy curvada
    errors.push({
      type: PostureErrorType.FORWARD_LEAN,
      severity: severity,
      description: severity > 7 ? 'Espalda muy curvada (crítico)' : 'Endereza la espalda',
      recommendation: severity > 7 ? 'CRÍTICO: Endereza la espalda, saca el pecho' : 'Mantén la espalda más recta',
      affectedJoints: ['spine'],
      confidence: 0.9,
      timestamp
    });
    console.log(`${severity > 7 ? '🔴' : '🟠'} PREPARACIÓN PERFIL: Espalda curvada ${spineAngle.toFixed(1)}°`);
  }

  // ✅ VERIFICAR RODILLA EXTENDIDA EN PERFIL
  const leftKnee = angles.left_knee_angle || 0;
  const rightKnee = angles.right_knee_angle || 0;
  const leftVisible = pose.left_knee?.visibility || 0;
  const rightVisible = pose.right_knee?.visibility || 0;
  const kneeAngle = leftVisible > rightVisible ? leftKnee : rightKnee;

  if (kneeAngle < 130 && this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
    errors.push({
      type: PostureErrorType.INSUFFICIENT_DEPTH,
      severity: 4,
      description: 'Ponte de pie completamente',
      recommendation: 'Extiende las piernas, ponte de pie',
      affectedJoints: ['left_knee', 'right_knee'],
      confidence: 0.8,
      timestamp
    });
    console.log('🟠 PREPARACIÓN PERFIL: Muy agachado');
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

  // ============================================================================
  // ✅ MÉTODOS AUXILIARES ESTÁNDAR
  // ============================================================================

  // 11. ✅ CORREGIR COOLDOWN - MÁS AGRESIVO PARA DETECTAR ERRORES
private checkErrorCooldown(errorType: PostureErrorType, timestamp: number): boolean {
  const lastDetection = this.lastErrorTimestamps.get(errorType) || 0;
  
  // ✅ COOLDOWN MÁS CORTO PARA MEJOR DETECCIÓN
  let cooldownTime = 2000; // 2 segundos por defecto
  
  // Errores críticos: cooldown medio
  if (errorType === PostureErrorType.KNEE_VALGUS || 
      errorType === PostureErrorType.FORWARD_LEAN ||
      errorType === PostureErrorType.UNSTABLE_BALANCE) {
    cooldownTime = 2000; // 2 segundos para errores críticos
  }
  
  // Errores de posición: cooldown corto
  if (errorType === PostureErrorType.POOR_ALIGNMENT || 
      errorType === PostureErrorType.INSUFFICIENT_DEPTH) {
    cooldownTime = 1500; // 1.5 segundos para errores de posición
  }
  
  if (timestamp - lastDetection >= cooldownTime) {
    this.lastErrorTimestamps.set(errorType, timestamp);
    return true;
  }
  
  return false;
}


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

  // 12. ✅ CORREGIR FASES DE REPETICIÓN - MÁS ESTRICTAS
private detectSquatPhase(angles: BiomechanicalAngles): RepetitionPhase {
  const leftKnee = angles.left_knee_angle || 180;
  const rightKnee = angles.right_knee_angle || 180;
  const avgKneeAngle = (leftKnee + rightKnee) / 2;

  // ✅ FASES MÁS ESTRICTAS
  if (avgKneeAngle > 150) {
    return RepetitionPhase.TOP;
  } else if (avgKneeAngle < 100) {
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

  private checkPushupStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const leftElbow = angles.left_elbow_angle || 0;
    const rightElbow = angles.right_elbow_angle || 0;
    const avgElbowAngle = (leftElbow + rightElbow) / 2;

    const armsExtended = avgElbowAngle > 160;
    const hipAngle = angles.left_hip_angle || 0;
    const bodyAligned = hipAngle > 160 && hipAngle < 185;

    return armsExtended && bodyAligned;
  }

  private checkPlankStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const hipAngle = angles.left_hip_angle || 0;
    return hipAngle > 165 && hipAngle < 185;
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

  // 1. ✅ CORREGIR "TÉCNICA PERFECTA" - Solo al completar repetición COMPLETA
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

  // ✅ SOLO AL COMPLETAR REPETICIÓN COMPLETA (TOP → BOTTOM → TOP)
  if (errors.length === 0 && 
      this.currentPhase === RepetitionPhase.TOP && 
      this.phaseTransitions.lastPhase === RepetitionPhase.ASCENDING &&
      this.phaseTransitions.topCount > this.phaseTransitions.bottomCount) {
    console.log('🎉 REPETICIÓN PERFECTA COMPLETADA');
    baseScore += 5;
  }

  return Math.max(0, Math.min(100, baseScore));
}

  private createBasicAnalysis(errors: PostureError[], phase: RepetitionPhase, reps: number, quality: number): MovementAnalysis {
    return {
      errors,
      phase,
      repetitionCount: reps,
      qualityScore: quality
    };
  }

  // ============================================================================
  // ✅ MÉTODOS PÚBLICOS
  // ============================================================================

  getReadinessState(): ReadinessState {
    return this.readinessState;
  }

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

  // ✅ MÉTODO DE DEBUG PARA VERIFICAR DETECCIONES
  debugDetections(pose: PoseKeypoints): void {
    console.log('🔍 === DEBUG DETECCIONES ===');
    console.log(`👁️ Vista de perfil: ${this.detectProfileView(pose)}`);
    console.log(`👣 Ambos pies en suelo: ${this.checkBothFeetOnGround(pose)}`);
    console.log(`📏 Separación de pies: ${this.checkFeetSpacing(pose)}`);
    console.log(`🦵 Posición de rodillas: ${this.checkKneePosition(pose)}`);
    console.log(`🚦 Estado de preparación: ${this.readinessState}`);
    console.log('🔍 === FIN DEBUG ===');
  }
}