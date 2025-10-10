// src/app/core/pose-engine/biomechanics.analyzer.ts
// ✅ VERSIÓN CORREGIDA - TODOS LOS PROBLEMAS SOLUCIONADOS

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
  
  // ✅ Estados de preparación con buffer
  private readinessState: ReadinessState = ReadinessState.NOT_READY;
  private readyFramesCount = 0;
  private badFramesBuffer = 0; // ✅ NUEVO: Tolerancia a frames malos
  private readonly FRAMES_TO_CONFIRM_READY = 8; // Más accesible
  private readonly MAX_BAD_FRAMES = 20; // Más tolerante
  private movementDetected = false;
  private lastAngleSnapshot: BiomechanicalAngles | null = null;
  private hasStartedExercising = false; // ✅ CRÍTICO: Indica que ya empezó el ejercicio
  
  // ✅ Control de errores reales
  private exerciseFramesCount = 0;
  private readonly MIN_EXERCISE_FRAMES = 30;
  private outOfPositionFrames = 0;
  private readonly MAX_OUT_OF_POSITION_FRAMES = 90;
  
  // ✅ BUFFERS PARA ANÁLISIS TEMPORAL
  private angleHistory: BiomechanicalAngles[] = [];
  private phaseHistory: RepetitionPhase[] = [];
  private readonly SMOOTHING_WINDOW = 5;
  private readonly MOVEMENT_THRESHOLD_FRONTAL = 6; // Para vista frontal
  private readonly MOVEMENT_THRESHOLD_PROFILE = 8; // Para vista de perfil (más sensible)
  
  // ✅ CONTADORES DE FASE PARA REPETICIONES
  private phaseTransitions = {
    topCount: 0,
    bottomCount: 0,
    lastPhase: RepetitionPhase.IDLE
  };

  private wasReady = false;

  constructor() {
    console.log('🧠 BiomechanicsAnalyzer inicializado - VERSIÓN CORREGIDA');
  }

  setCurrentExercise(exerciseType: ExerciseType): void {
    this.currentExercise = exerciseType;
    this.resetAnalysis();
    console.log(`🎯 Ejercicio configurado: ${exerciseType}`);
  }

  // ============================================================================
  // ✅ ANÁLISIS PRINCIPAL - MEJORADO
  // ============================================================================

  analyzeMovement(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
    const isUserCompletelyVisible = this.checkUserCompleteness(pose);

    // 🔥 CRÍTICO: SI YA ESTÁ EJERCITANDO, NO RESETEAR POR VISIBILIDAD TEMPORAL
    if (!isUserCompletelyVisible && this.readinessState !== ReadinessState.EXERCISING) {
      this.resetToNotReady();
      return this.createBasicAnalysis([], RepetitionPhase.IDLE, 0, 0);
    }

    this.updateReadinessState(pose, angles);

    if (this.readinessState === ReadinessState.EXERCISING) {
      return this.performRealExerciseAnalysis(pose, angles);
    } else {
      return this.performReadinessAnalysis(pose, angles);
    }
  }

  // ============================================================================
  // ✅ ACTUALIZAR ESTADO DE PREPARACIÓN - CON BUFFER DE TOLERANCIA
  // ============================================================================

  private updateReadinessState(pose: PoseKeypoints, angles: BiomechanicalAngles): void {
    switch (this.readinessState) {
      case ReadinessState.NOT_READY: {
        const isInCorrectStartPosition = this.checkStartingPosition(pose, angles);
        if (isInCorrectStartPosition) {
          this.readinessState = ReadinessState.GETTING_READY;
          this.readyFramesCount = 1;
          this.badFramesBuffer = 0;
          console.log('🔄 Usuario se está preparando...');
        }
        break;
      }

      case ReadinessState.GETTING_READY: {
        const isInCorrectStartPosition = this.checkStartingPosition(pose, angles);
        if (isInCorrectStartPosition) {
          this.readyFramesCount++;
          this.badFramesBuffer = 0;

          if (this.readyFramesCount >= this.FRAMES_TO_CONFIRM_READY) {
            this.readinessState = ReadinessState.READY_TO_START;
            console.log('✅ Usuario LISTO para empezar ejercicio');
          }
        } else {
          this.badFramesBuffer++;

          if (this.badFramesBuffer > this.MAX_BAD_FRAMES) {
            console.log(`⚠️ Demasiados frames malos (${this.badFramesBuffer}), reseteando`);
            this.readinessState = ReadinessState.NOT_READY;
            this.readyFramesCount = 0;
            this.badFramesBuffer = 0;
          }
        }
        break;
      }

      case ReadinessState.READY_TO_START: {
        const hasMovement = this.detectMovement(angles);
        if (hasMovement) {
          this.readinessState = ReadinessState.EXERCISING;
          this.exerciseFramesCount = 0;
          this.movementDetected = true;
          this.hasStartedExercising = true;
          console.log('🏃 Usuario comenzó a ejercitarse - BLOQUEADO EN EXERCISING');
        } else {
          const isInCorrectStartPosition = this.checkStartingPosition(pose, angles);
          if (!isInCorrectStartPosition) {
            this.badFramesBuffer++;
            if (this.badFramesBuffer > this.MAX_BAD_FRAMES) {
              this.readinessState = ReadinessState.NOT_READY;
              this.readyFramesCount = 0;
              this.badFramesBuffer = 0;
            }
          }
        }
        break;
      }

      case ReadinessState.EXERCISING: {
        // 🔥 CRÍTICO: Durante EXERCISING, SOLO verificar rango de ejercicio
        const isInExerciseRange = this.checkIfInExerciseRange(pose, angles);

        if (isInExerciseRange) {
          // ✅ Usuario está en rango válido de ejercicio
          this.outOfPositionFrames = 0;
          this.exerciseFramesCount++;
        } else {
          // ❌ Usuario fuera del rango de ejercicio
          this.outOfPositionFrames++;

          if (this.outOfPositionFrames >= this.MAX_OUT_OF_POSITION_FRAMES) {
            console.log(`⚠️ FINALIZANDO EJERCICIO - ${this.outOfPositionFrames} frames fuera de rango`);
            this.readinessState = ReadinessState.NOT_READY;
            this.exerciseFramesCount = 0;
            this.outOfPositionFrames = 0;
            this.badFramesBuffer = 0;
            this.repetitionCounter = 0;
            this.hasStartedExercising = false;
          }
        }
        break;
      }
    }
  }

  // ============================================================================
  // ✅ VERIFICACIONES DE POSICIÓN - MEJORADAS
  // ============================================================================

  private checkUserCompleteness(pose: PoseKeypoints): boolean {
    const requiredJoints = [
      'left_shoulder', 'right_shoulder',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle'
    ];

    // 🔥 CRÍTICO: Si ya está ejercitando, ser MÁS PERMISIVO
    const isExercising = this.readinessState === ReadinessState.EXERCISING;
    const visibilityThreshold = isExercising ? 0.5 : 0.7; // Más permisivo durante ejercicio
    const completenessThreshold = isExercising ? 0.6 : 0.8; // Más permisivo durante ejercicio

    const visibleJoints = requiredJoints.filter(joint => {
      const point = pose[joint as keyof PoseKeypoints];
      return point && point.visibility > visibilityThreshold;
    });

    const completenessRatio = visibleJoints.length / requiredJoints.length;
    return completenessRatio >= completenessThreshold;
  }

  // ✅ NUEVO: Verificar si está dentro del rango válido de ejercicio
  private checkIfInExerciseRange(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const isProfileView = this.detectProfileView(pose);
    return isProfileView ?
      this.checkProfileExerciseRange(pose, angles) :
      this.checkFrontalExerciseRange(pose, angles);
  }

  // ✅ Rango válido para ejercicio en PERFIL
  private checkProfileExerciseRange(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const leftKnee = angles.left_knee_angle || 0;
    const rightKnee = angles.right_knee_angle || 0;
    const leftVisible = pose.left_knee?.visibility || 0;
    const rightVisible = pose.right_knee?.visibility || 0;

    // 🔥 SI NO HAY RODILLAS VISIBLES, PERO HAY CADERAS Y TOBILLOS, ASUMIR QUE ESTÁ EN RANGO
    if (leftKnee === 0 && rightKnee === 0) {
      const hasHips = (pose.left_hip?.visibility || 0) > 0.5 || (pose.right_hip?.visibility || 0) > 0.5;
      const hasAnkles = (pose.left_ankle?.visibility || 0) > 0.5 || (pose.right_ankle?.visibility || 0) > 0.5;

      if (hasHips && hasAnkles) {
        console.log(`⚠️ PERFIL: Ángulos=0 pero caderas/tobillos visibles → ASUMIENDO EN RANGO`);
        return true; // Está en sentadilla profunda, MediaPipe no calcula bien el ángulo
      }
    }

    const kneeAngle = leftVisible > rightVisible ? leftKnee : rightKnee;

    // 🔥 SI EL ÁNGULO ES 0 O INVÁLIDO PERO HAY VISIBILIDAD, ASUMIR EN RANGO
    if (kneeAngle === 0 && (leftVisible > 0.3 || rightVisible > 0.3)) {
      console.log(`⚠️ PERFIL: Ángulo=0 pero rodilla visible → ASUMIENDO EN RANGO`);
      return true;
    }

    // ✅ Rango válido MÁS AMPLIO
    const isInRange = kneeAngle >= 20 && kneeAngle <= 180; // Aún más amplio

    // ✅ Verificar visibilidad mínima (más permisivo)
    const hasVisibility = leftVisible > 0.3 || rightVisible > 0.3;

    return isInRange && hasVisibility;
  }

  // ✅ Rango válido para ejercicio en FRONTAL
  private checkFrontalExerciseRange(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const leftKnee = angles.left_knee_angle || 0;
    const rightKnee = angles.right_knee_angle || 0;

    // 🔥 SI AMBOS ÁNGULOS SON 0, VERIFICAR CADERAS/TOBILLOS
    if (leftKnee === 0 && rightKnee === 0) {
      const hasHips = (pose.left_hip?.visibility || 0) > 0.5 && (pose.right_hip?.visibility || 0) > 0.5;
      const hasAnkles = (pose.left_ankle?.visibility || 0) > 0.5 && (pose.right_ankle?.visibility || 0) > 0.5;

      if (hasHips && hasAnkles) {
        console.log(`⚠️ FRONTAL: Ángulos=0 pero caderas/tobillos visibles → ASUMIENDO EN RANGO`);
        return true;
      }
    }

    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    // ✅ Rango válido MÁS AMPLIO
    const isInRange = avgKneeAngle >= 20 && avgKneeAngle <= 180;

    // ✅ Verificar visibilidad (más permisivo)
    const leftVisible = pose.left_knee?.visibility || 0;
    const rightVisible = pose.right_knee?.visibility || 0;
    const hasVisibility = leftVisible > 0.3 || rightVisible > 0.3;

    return isInRange && hasVisibility;
  }

  // ✅ CORREGIDO: Detección de rodillas MÁS SENSIBLE
  private checkKneePosition(pose: PoseKeypoints): boolean {
    const leftKnee = pose.left_knee;
    const rightKnee = pose.right_knee;
    
    if (!leftKnee || !rightKnee || 
        leftKnee.visibility < 0.8 || rightKnee.visibility < 0.8) {
      return true; // Si no se detecta claramente, no molestar
    }
    
    const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
    const goodKneePosition = kneeDistance > 0.13; // ✅ 0.08 → 0.13 (MÁS SENSIBLE)
    
    if (!goodKneePosition) {
      console.log(`🚨 RODILLAS MUY JUNTAS: distancia=${kneeDistance.toFixed(3)}`);
    }
    
    return goodKneePosition;
  }

  // ✅ CORREGIDO: Detección de pie levantado MÁS SENSIBLE
  private checkBothFeetOnGround(pose: PoseKeypoints): boolean {
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;
    
    if (!leftAnkle || !rightAnkle || 
        leftAnkle.visibility < 0.6 || rightAnkle.visibility < 0.6) {
      return true;
    }
    
    const leftHeel = pose.left_heel;
    const rightHeel = pose.right_heel;
    
    let leftFootHeight = leftAnkle.y;
    let rightFootHeight = rightAnkle.y;
    
    if (leftHeel && leftHeel.visibility > 0.5) {
      leftFootHeight = Math.max(leftAnkle.y, leftHeel.y);
    }
    if (rightHeel && rightHeel.visibility > 0.5) {
      rightFootHeight = Math.max(rightAnkle.y, rightHeel.y);
    }
    
    const footHeightDiff = Math.abs(leftFootHeight - rightFootHeight);

    if (footHeightDiff > 0.04) { // ✅ 0.022 → 0.04 (menos falsos positivos)
      console.log(`🚨 PIE LEVANTADO: diferencia=${footHeightDiff.toFixed(3)}`);
      return false;
    }
    
    return true;
  }

  // ✅ MEJORADO: Verificar posición individual de cada pie
  private checkIndividualFootHeight(pose: PoseKeypoints): boolean {
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;
    const leftHip = pose.left_hip;
    const rightHip = pose.right_hip;
    
    if (!leftAnkle || !rightAnkle || !leftHip || !rightHip) return true;
    
    const avgHipHeight = (leftHip.y + rightHip.y) / 2;
    const leftAnkleRelative = leftAnkle.y - avgHipHeight;
    const rightAnkleRelative = rightAnkle.y - avgHipHeight;
    
    // Si algún tobillo está significativamente más alto que el otro
    const heightDiff = Math.abs(leftAnkleRelative - rightAnkleRelative);

      if (heightDiff > 0.05) { // ✅ 0.03 → 0.05 (menos sensible)
        console.log(`🚨 PIE INDIVIDUAL LEVANTADO: diff=${heightDiff.toFixed(3)}`);
        return false;
      }
    
    return true;
  }

  // ✅ CORREGIDO: Separación de pies con RANGO VÁLIDO
  private checkFeetSpacing(pose: PoseKeypoints): boolean {
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;
    
    if (!leftAnkle || !rightAnkle || 
        leftAnkle.visibility < 0.7 || rightAnkle.visibility < 0.7) {
      return true;
    }
    
    const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
    
    // ✅ RANGO VÁLIDO: ni muy juntos (< 0.15) ni muy separados (> 0.40)
    const isGoodSpacing = feetDistance >= 0.12 && feetDistance <= 0.50; // Más flexibilidad
    
    if (!isGoodSpacing) {
      if (feetDistance < 0.15) {
        console.log(`🚨 PIES MUY JUNTOS: distancia=${feetDistance.toFixed(3)}`);
      } else {
        console.log(`🚨 PIES MUY SEPARADOS: distancia=${feetDistance.toFixed(3)}`);
      }
    }
    
    return isGoodSpacing;
  }

  // ============================================================================
  // ✅ ERROR COOLDOWN - MÁS LARGO PARA EVITAR SPAM
  // ============================================================================

  private checkErrorCooldown(errorType: PostureErrorType, timestamp: number): boolean {
    const lastDetection = this.lastErrorTimestamps.get(errorType) || 0;
    
    // ✅ COOLDOWNS MÁS LARGOS
    let cooldownTime = 1500; // 1500
    
    // Errores críticos: cooldown largo
    if (errorType === PostureErrorType.KNEE_VALGUS || 
        errorType === PostureErrorType.ROUNDED_BACK ||
        errorType === PostureErrorType.FORWARD_LEAN) {
      cooldownTime = 4000; // 4 segundos
    }
    
    // Errores de posición: cooldown medio
    if (errorType === PostureErrorType.POOR_ALIGNMENT || 
        errorType === PostureErrorType.UNSTABLE_BALANCE) {
      cooldownTime = 3000; // 3 segundos
    }
    
    // Errores de profundidad: cooldown MUY largo para no molestar
    if (errorType === PostureErrorType.INSUFFICIENT_DEPTH) {
      cooldownTime = 8000; // 8 segundos (antes 2.5)
    }
    
    if (timestamp - lastDetection >= cooldownTime) {
      this.lastErrorTimestamps.set(errorType, timestamp);
      return true;
    }
    
    return false;
  }

  // ============================================================================
  // ✅ DETECCIÓN DE ERRORES FRONTALES - MEJORADA
  // ============================================================================

  private detectFrontalErrors(
    pose: PoseKeypoints, 
    angles: BiomechanicalAngles, 
    isExercising: boolean = false
  ): PostureError[] {
    const errors: PostureError[] = [];
    const timestamp = Date.now();
    const baseSeverity = isExercising ? 8 : 5;
    const logPrefix = isExercising ? '🔴 EJERCICIO' : '🟠 PREPARACIÓN';

    const feetDistance = Math.abs((pose.left_ankle?.x || 0) - (pose.right_ankle?.x || 0));

    // ✅ ERROR: PIES MUY JUNTOS
    if (feetDistance < 0.15 && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: baseSeverity,
        description: isExercising 
          ? 'Pies muy juntos durante sentadilla'
          : 'Pies muy juntos para hacer sentadillas',
        recommendation: 'Abre más las piernas, separa los pies',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.9,
        timestamp
      });
      console.log(`${logPrefix}: Pies muy juntos`);
    }

    // ✅ NUEVO: ERROR PIES MUY SEPARADOS
    if (feetDistance > 0.40 && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: baseSeverity,
        description: isExercising 
          ? 'Piernas muy abiertas durante sentadilla'
          : 'Piernas muy abiertas para hacer sentadillas',
        recommendation: 'Junta un poco los pies, ancho de hombros',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.9,
        timestamp
      });
      console.log(`${logPrefix}: Pies muy separados`);
    }

    // ✅ ERROR: UN PIE LEVANTADO - DETECCIÓN MEJORADA
    if ((!this.checkBothFeetOnGround(pose) || !this.checkIndividualFootHeight(pose)) && 
        this.checkErrorCooldown(PostureErrorType.UNSTABLE_BALANCE, timestamp)) {
      errors.push({
        type: PostureErrorType.UNSTABLE_BALANCE,
        severity: baseSeverity + 1,
        description: isExercising 
          ? 'Un pie está levantado durante ejercicio'
          : 'Un pie está levantado',
        recommendation: isExercising 
          ? 'CRÍTICO: Pon ambos pies en el suelo'
          : 'Pon ambos pies en el suelo',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.95,
        timestamp
      });
      console.log(`${logPrefix}: Un pie levantado`);
    }

    // ✅ ERROR: RODILLAS MUY JUNTAS (SOLO DURANTE EJERCICIO)
    if (isExercising && !this.checkKneePosition(pose) && 
        this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
      errors.push({
        type: PostureErrorType.KNEE_VALGUS,
        severity: 9,
        description: 'Rodillas colapsadas hacia adentro',
        recommendation: 'CRÍTICO: Separa las rodillas, empuja hacia afuera',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.9,
        timestamp
      });
      console.log(`${logPrefix}: Rodillas muy juntas (CRÍTICO)`);
    }

    return errors;
  }

  // ============================================================================
  // ✅ DETECCIÓN DE POCA PROFUNDIDAD - MEJORADA
  // ============================================================================

  private detectProfileSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    const leftVisible = pose.left_knee?.visibility || 0;
    const rightVisible = pose.right_knee?.visibility || 0;
    const kneeAngle = leftVisible > rightVisible ?
      (angles.left_knee_angle || 0) : (angles.right_knee_angle || 0);

    // ✅ ESPALDA CURVADA DURANTE EJERCICIO - MUY PERMISIVO PARA PRINCIPIANTES
    const spineAngle = angles.spine_angle || 85;

    // 🔥 SOLO ALERTAR SI ES REALMENTE PELIGROSO (< 40°)
    if (spineAngle < 40 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
      const severity = spineAngle < 30 ? 9 : 7;
      errors.push({
        type: PostureErrorType.ROUNDED_BACK,
        severity: severity,
        description: severity > 8 ? 'Espalda MUY curvada - cuidado' : 'Espalda algo curvada',
        recommendation: severity > 8 ? 'Intenta enderezar un poco la espalda' : 'Mantén la espalda más recta si puedes',
        affectedJoints: ['spine'],
        confidence: 0.85,
        timestamp
      });
      console.log(`🟠 EJERCICIO PERFIL: Espalda curvada ${spineAngle.toFixed(1)}°`);
    }

    // ✅ SENTADILLA POCO PROFUNDA - SOLO SI ES MUY EVIDENTE Y MUY RARA VEZ
    if (kneeAngle > 130 &&  // Más permisivo: 130° en lugar de 120°
        this.currentPhase === RepetitionPhase.BOTTOM &&
        this.repetitionCounter >= 3 && // Solo mostrar después de 3 repeticiones
        this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
      errors.push({
        type: PostureErrorType.INSUFFICIENT_DEPTH,
        severity: 3, // Severidad muy baja
        description: 'Intenta bajar un poco más',
        recommendation: 'Baja más si puedes, flexiona más las rodillas',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.6,
        timestamp
      });
      console.log('🟡 EJERCICIO PERFIL: Sentadilla poco profunda');
    }

    return errors;
  }

  // ============================================================================
  // 💪 DETECCIÓN DE ERRORES - PESO MUERTO
  // ============================================================================
  private detectDeadliftErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    const isProfileView = this.detectProfileView(pose);

    if (isProfileView) {
      errors.push(...this.detectProfileDeadliftErrors(pose, angles, timestamp));
    } else {
      errors.push(...this.detectFrontalDeadliftErrors(pose, angles, timestamp));
    }

    // Solo retornar el error más severo
    if (errors.length > 1) {
      const mostSevere = errors.reduce((prev, current) =>
        current.severity > prev.severity ? current : prev
      );
      return [mostSevere];
    }

    return errors;
  }

  private detectProfileDeadliftErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    const spineAngle = angles.spine_angle || 85;

    // ✅ ERROR CRÍTICO: ESPALDA REDONDEADA (severity 10)
    if (spineAngle < 82 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
      const severity = spineAngle < 70 ? 10 : 9;
      errors.push({
        type: PostureErrorType.ROUNDED_BACK,
        severity: severity,
        description: 'Espalda redondeada - alto riesgo de lesión',
        recommendation: 'Mantén pecho arriba y espalda recta, reduce peso',
        affectedJoints: ['spine'],
        confidence: 0.9,
        timestamp
      });
      console.log(`🔴 PESO MUERTO PERFIL: Espalda redondeada ${spineAngle.toFixed(1)}° (CRÍTICO)`);
    }

    // ✅ ERROR: CADERAS SUBEN ANTES QUE LA BARRA (severity 7)
    // Detectar si la cadera se extiende pero las rodillas no
    const leftHip = angles.left_hip_angle || 180;
    const rightHip = angles.right_hip_angle || 180;
    const avgHipAngle = (leftHip + rightHip) / 2;

    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    // Si estamos en fase ascendente y las caderas se extienden mucho más que las rodillas
    if (this.currentPhase === RepetitionPhase.ASCENDING &&
        this.angleHistory.length >= 2) {
      const prevLeftHip = this.angleHistory[this.angleHistory.length - 2].left_hip_angle || 180;
      const prevRightHip = this.angleHistory[this.angleHistory.length - 2].right_hip_angle || 180;
      const prevAvgHip = (prevLeftHip + prevRightHip) / 2;

      const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
      const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
      const prevAvgKnee = (prevLeftKnee + prevRightKnee) / 2;

      const hipExtension = avgHipAngle - prevAvgHip;
      const kneeExtension = avgKneeAngle - prevAvgKnee;

      // Caderas se extienden más de 15° más rápido que rodillas
      if (hipExtension > kneeExtension + 15 &&
          this.checkErrorCooldown(PostureErrorType.HIPS_RISE_EARLY, timestamp)) {
        errors.push({
          type: PostureErrorType.HIPS_RISE_EARLY,
          severity: 7,
          description: 'Caderas suben antes que la barra',
          recommendation: 'Empuja con piernas primero, mantén torso estable',
          affectedJoints: ['left_hip', 'right_hip'],
          confidence: 0.85,
          timestamp
        });
        console.log('🟠 PESO MUERTO PERFIL: Caderas suben temprano');
      }
    }

    // ✅ ERROR: BARRA MUY ALEJADA DEL CUERPO (severity 8)
    // Aproximación: Verificar que las rodillas no estén muy adelante de los tobillos
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;
    const leftKneePos = pose.left_knee;
    const rightKneePos = pose.right_knee;

    if (leftAnkle && leftKneePos && leftAnkle.visibility > 0.7 && leftKneePos.visibility > 0.7) {
      const kneeAnkleDistance = Math.abs(leftKneePos.x - leftAnkle.x);

      // Si la rodilla está muy adelante del tobillo en posición baja
      if (kneeAnkleDistance > 0.15 && avgKneeAngle < 140 &&
          this.checkErrorCooldown(PostureErrorType.BAR_TOO_FAR, timestamp)) {
        errors.push({
          type: PostureErrorType.BAR_TOO_FAR,
          severity: 8,
          description: 'Barra muy alejada del cuerpo',
          recommendation: 'Mantén barra pegada a piernas durante todo el movimiento',
          affectedJoints: ['left_shoulder', 'right_shoulder'],
          confidence: 0.8,
          timestamp
        });
        console.log('🟠 PESO MUERTO PERFIL: Barra muy lejos del cuerpo');
      }
    }

    return errors;
  }

  private detectFrontalDeadliftErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // ✅ ERROR: PIES MUY JUNTOS O MUY SEPARADOS
    const feetDistance = Math.abs((pose.left_ankle?.x || 0) - (pose.right_ankle?.x || 0));

    if (feetDistance < 0.15 && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: 7,
        description: 'Pies muy juntos para peso muerto',
        recommendation: 'Separa pies al ancho de caderas',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.9,
        timestamp
      });
      console.log('🟠 PESO MUERTO FRONTAL: Pies muy juntos');
    }

    if (feetDistance > 0.35 && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
      errors.push({
        type: PostureErrorType.POOR_ALIGNMENT,
        severity: 7,
        description: 'Pies muy separados para peso muerto',
        recommendation: 'Junta pies al ancho de caderas',
        affectedJoints: ['left_ankle', 'right_ankle'],
        confidence: 0.9,
        timestamp
      });
      console.log('🟠 PESO MUERTO FRONTAL: Pies muy separados');
    }

    // ✅ ERROR: RODILLAS COLAPSADAS HACIA DENTRO
    if (!this.checkKneePosition(pose) &&
        this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
      errors.push({
        type: PostureErrorType.KNEE_VALGUS,
        severity: 8,
        description: 'Rodillas colapsadas hacia adentro',
        recommendation: 'Empuja rodillas hacia afuera durante levantamiento',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.9,
        timestamp
      });
      console.log('🔴 PESO MUERTO FRONTAL: Rodillas colapsadas (CRÍTICO)');
    }

    return errors;
  }

  // ============================================================================
  // 🏃 DETECCIÓN DE ERRORES - ZANCADAS
  // ============================================================================
  private detectLungeErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    const isProfileView = this.detectProfileView(pose);

    if (isProfileView) {
      errors.push(...this.detectProfileLungeErrors(pose, angles, timestamp));
    } else {
      errors.push(...this.detectFrontalLungeErrors(pose, angles, timestamp));
    }

    // Solo retornar el error más severo
    if (errors.length > 1) {
      const mostSevere = errors.reduce((prev, current) =>
        current.severity > prev.severity ? current : prev
      );
      return [mostSevere];
    }

    return errors;
  }

  private detectProfileLungeErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // ✅ ERROR: RODILLA DELANTERA SOBREPASA DEDO DEL PIE (severity 8)
    const leftKnee = pose.left_knee;
    const rightKnee = pose.right_knee;
    const leftAnkle = pose.left_ankle;
    const rightAnkle = pose.right_ankle;

    // Determinar cual es la pierna delantera (más flexionada)
    const leftKneeAngle = angles.left_knee_angle || 180;
    const rightKneeAngle = angles.right_knee_angle || 180;

    const frontIsLeft = leftKneeAngle < rightKneeAngle;
    const frontKnee = frontIsLeft ? leftKnee : rightKnee;
    const frontAnkle = frontIsLeft ? leftAnkle : rightAnkle;

    if (frontKnee && frontAnkle && frontKnee.visibility > 0.7 && frontAnkle.visibility > 0.7) {
      // En vista de perfil, x es horizontal - rodilla no debe pasar mucho el tobillo
      const kneeOverToe = frontKnee.x - frontAnkle.x;

      if (Math.abs(kneeOverToe) > 0.1 && this.currentPhase === RepetitionPhase.BOTTOM &&
          this.checkErrorCooldown(PostureErrorType.KNEE_OVER_TOE, timestamp)) {
        errors.push({
          type: PostureErrorType.KNEE_OVER_TOE,
          severity: 8,
          description: 'Rodilla delantera sobrepasa dedo del pie',
          recommendation: 'Da paso más largo, mantén peso en talón',
          affectedJoints: ['left_knee', 'right_knee'],
          confidence: 0.85,
          timestamp
        });
        console.log('🟠 ZANCADA PERFIL: Rodilla sobrepasa pie');
      }
    }

    // ✅ ERROR: TORSO INCLINADO HACIA ADELANTE (severity 6)
    const spineAngle = angles.spine_angle || 85;

    if (spineAngle < 75 && this.checkErrorCooldown(PostureErrorType.TRUNK_LEAN, timestamp)) {
      errors.push({
        type: PostureErrorType.TRUNK_LEAN,
        severity: 6,
        description: 'Torso inclinado hacia adelante',
        recommendation: 'Mantén torso vertical, fortalece core',
        affectedJoints: ['spine'],
        confidence: 0.8,
        timestamp
      });
      console.log(`🟡 ZANCADA PERFIL: Torso inclinado ${spineAngle.toFixed(1)}°`);
    }

    return errors;
  }

  private detectFrontalLungeErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];

    // ✅ ERROR: RODILLA DELANTERA COLAPSA HACIA DENTRO (severity 7)
    if (!this.checkKneePosition(pose) &&
        this.checkErrorCooldown(PostureErrorType.KNEE_VALGUS, timestamp)) {
      errors.push({
        type: PostureErrorType.KNEE_VALGUS,
        severity: 7,
        description: 'Rodilla delantera colapsa hacia dentro',
        recommendation: 'Empuja rodilla hacia afuera, activa glúteo medio',
        affectedJoints: ['left_knee', 'right_knee'],
        confidence: 0.85,
        timestamp
      });
      console.log('🟠 ZANCADA FRONTAL: Rodilla colapsada');
    }

    // ✅ ERROR: DESEQUILIBRIO LATERAL
    const leftHip = pose.left_hip;
    const rightHip = pose.right_hip;

    if (leftHip && rightHip && leftHip.visibility > 0.7 && rightHip.visibility > 0.7) {
      const hipImbalance = Math.abs(leftHip.y - rightHip.y);

      if (hipImbalance > 0.08 && this.checkErrorCooldown(PostureErrorType.UNSTABLE_BALANCE, timestamp)) {
        errors.push({
          type: PostureErrorType.UNSTABLE_BALANCE,
          severity: 6,
          description: 'Cadera desnivelada - pérdida de equilibrio',
          recommendation: 'Mantén caderas niveladas, fortalece core',
          affectedJoints: ['left_hip', 'right_hip'],
          confidence: 0.8,
          timestamp
        });
        console.log('🟡 ZANCADA FRONTAL: Cadera desnivelada');
      }
    }

    return errors;
  }

  // ============================================================================
  // 🚣 DETECCIÓN DE ERRORES - REMO CON BARRA
  // ============================================================================
  private detectBarbellRowErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    const isProfileView = this.detectProfileView(pose);

    if (isProfileView) {
      errors.push(...this.detectProfileBarbellRowErrors(pose, angles, timestamp));
    } else {
      errors.push(...this.detectFrontalBarbellRowErrors(pose, angles, timestamp));
    }

    // Solo retornar el error más severo
    if (errors.length > 1) {
      const mostSevere = errors.reduce((prev, current) =>
        current.severity > prev.severity ? current : prev
      );
      return [mostSevere];
    }

    return errors;
  }

  private detectProfileBarbellRowErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    const spineAngle = angles.spine_angle || 85;

    // Log para depuración del ángulo de espalda
    console.log(`ℹ️ REMO PERFIL: spine_angle = ${spineAngle.toFixed(1)}°`);
    // Solo mostrar error si la cadera está flexionada (120°-175°) y la espalda realmente curvada
    const leftHip = angles.left_hip_angle || 180;
    const rightHip = angles.right_hip_angle || 180;
    const avgHipAngle = (leftHip + rightHip) / 2;
    if (avgHipAngle > 120 && avgHipAngle <= 175) {
      // Solo mostrar el error si la espalda está MUY curvada (menos de 20°)
      if (spineAngle < 20 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
        errors.push({
          type: PostureErrorType.ROUNDED_BACK,
          severity: 9,
          description: 'Espalda baja redondeada',
          recommendation: 'Mantén espalda recta, reduce peso si es necesario',
          affectedJoints: ['spine'],
          confidence: 0.9,
          timestamp
        });
        console.log(`🔴 REMO PERFIL: Espalda redondeada ${spineAngle.toFixed(1)}°`);
      }
    }

    // ✅ ERROR: DEMASIADO BALANCEO DEL TORSO (severity 7)
    // Detectar si el torso se balancea mucho durante el movimiento
    if (this.angleHistory.length >= 3) {
      const currentHipAngle = ((angles.left_hip_angle || 180) + (angles.right_hip_angle || 180)) / 2;
      const prevHipAngle1 = ((this.angleHistory[this.angleHistory.length - 2].left_hip_angle || 180) +
                             (this.angleHistory[this.angleHistory.length - 2].right_hip_angle || 180)) / 2;
      const prevHipAngle2 = ((this.angleHistory[this.angleHistory.length - 3].left_hip_angle || 180) +
                             (this.angleHistory[this.angleHistory.length - 3].right_hip_angle || 180)) / 2;

      const hipSwing1 = Math.abs(currentHipAngle - prevHipAngle1);
      const hipSwing2 = Math.abs(prevHipAngle1 - prevHipAngle2);
      const avgSwing = (hipSwing1 + hipSwing2) / 2;

      // Si el torso se balancea más de 15° entre frames
      if (avgSwing > 15 && this.currentPhase === RepetitionPhase.ASCENDING &&
          this.checkErrorCooldown(PostureErrorType.EXCESSIVE_MOMENTUM, timestamp)) {
        errors.push({
          type: PostureErrorType.EXCESSIVE_MOMENTUM,
          severity: 7,
          description: 'Demasiado balanceo del torso',
          recommendation: 'Reduce peso, controla el movimiento',
          affectedJoints: ['left_hip', 'right_hip', 'spine'],
          confidence: 0.8,
          timestamp
        });
        console.log('🟠 REMO PERFIL: Excesivo balanceo de torso');
      }
    }

    // ✅ ERROR: RANGO DE MOVIMIENTO INCOMPLETO (severity 5)
    const leftElbow = angles.left_elbow_angle || 180;
    const rightElbow = angles.right_elbow_angle || 180;
    const avgElbowAngle = (leftElbow + rightElbow) / 2;

    // En la posición TOP (contracción), los codos deben estar bien flexionados
    if (this.currentPhase === RepetitionPhase.TOP && avgElbowAngle > 70 &&
        this.checkErrorCooldown(PostureErrorType.INCOMPLETE_ROM, timestamp)) {
      errors.push({
        type: PostureErrorType.INCOMPLETE_ROM,
        severity: 5,
        description: 'Rango de movimiento incompleto',
        recommendation: 'Lleva barra hasta tocar abdomen/pecho bajo',
        affectedJoints: ['left_elbow', 'right_elbow'],
        confidence: 0.75,
        timestamp
      });
      console.log('🟡 REMO PERFIL: ROM incompleto');
    }

    return errors;
  }

  private detectFrontalBarbellRowErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    // Alerta si el torso no está suficientemente inclinado (cadera muy extendida)
    const leftHip = angles.left_hip_angle || 180;
    const rightHip = angles.right_hip_angle || 180;
    const avgHipAngle = (leftHip + rightHip) / 2;
    // ...existing code...
  
    // ✅ ERROR: CODOS MUY ABIERTOS DEL CUERPO (severity 6)
    const leftShoulder = pose.left_shoulder;
    const rightShoulder = pose.right_shoulder;
    const leftElbow = pose.left_elbow;
    const rightElbow = pose.right_elbow;

    if (leftShoulder && leftElbow && leftShoulder.visibility > 0.7 && leftElbow.visibility > 0.7) {
      // Distancia horizontal entre hombro y codo
      const elbowFlare = Math.abs(leftElbow.x - leftShoulder.x);

      // Si el codo está muy alejado del torso durante la tracción
      if (elbowFlare > 0.2 && this.currentPhase === RepetitionPhase.ASCENDING &&
          this.checkErrorCooldown(PostureErrorType.ELBOW_FLARE, timestamp)) {
        errors.push({
          type: PostureErrorType.ELBOW_FLARE,
          severity: 6,
          description: 'Codos muy abiertos del cuerpo',
          recommendation: 'Mantén codos cerca del torso, tira hacia cadera',
          affectedJoints: ['left_elbow', 'right_elbow'],
          confidence: 0.8,
          timestamp
        });
        console.log('🟡 REMO FRONTAL: Codos muy abiertos');
      }
    }

    // ✅ ERROR: DESEQUILIBRIO - HOMBROS DESNIVELADOS
    if (leftShoulder && rightShoulder && leftShoulder.visibility > 0.7 && rightShoulder.visibility > 0.7) {
      const shoulderImbalance = Math.abs(leftShoulder.y - rightShoulder.y);

      if (shoulderImbalance > 0.08 && this.checkErrorCooldown(PostureErrorType.POOR_ALIGNMENT, timestamp)) {
        errors.push({
          type: PostureErrorType.POOR_ALIGNMENT,
          severity: 7,
          description: 'Hombros desnivelados durante remo',
          recommendation: 'Mantén hombros nivelados, tira simétricamente',
          affectedJoints: ['left_shoulder', 'right_shoulder'],
          confidence: 0.85,
          timestamp
        });
        console.log('🟠 REMO FRONTAL: Hombros desnivelados');
      }
    }

    return errors;
  }

  // ============================================================================
  // ✅ MÉTODOS AUXILIARES
  // ============================================================================

  private performRealExerciseAnalysis(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
    this.angleHistory.push(angles);
    if (this.angleHistory.length > this.SMOOTHING_WINDOW) {
      this.angleHistory.shift();
    }
  
    const newPhase = this.detectPhase(angles);
    this.phaseHistory.push(newPhase);
    if (this.phaseHistory.length > this.SMOOTHING_WINDOW) {
      this.phaseHistory.shift();
    }
  
    const smoothedPhase = this.getMostCommonPhase();
    
    if (smoothedPhase !== this.currentPhase) {
      console.log(`📊 Cambio de fase: ${this.currentPhase} → ${smoothedPhase}`);
      this.currentPhase = smoothedPhase;
    }
  
    if (this.isRepetitionComplete(smoothedPhase)) {
      this.repetitionCounter++;
      console.log(`🎉 REPETICIÓN #${this.repetitionCounter}`);
    }
  
    const errors = this.detectRealPosturalErrors(pose, angles);
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;
  
    // Solo procesar errores si está agachado (< 150°) o en posición inicial correcta (> 140°)
    const isInExercisePosition = avgKneeAngle < 150 || avgKneeAngle > 140;
  
    if (!isInExercisePosition) {
      console.log('⏸️ Ignorando errores - usuario en movimiento (no ejercitando)');
    }
  
    const quality = this.calculateQualityScore(errors, angles);  
    return this.createBasicAnalysis(errors, smoothedPhase, this.repetitionCounter, quality);
  }
  
  private performReadinessAnalysis(pose: PoseKeypoints, angles: BiomechanicalAngles): MovementAnalysis {
    const errors = this.detectReadinessErrors(pose, angles);
    return this.createBasicAnalysis(errors, RepetitionPhase.IDLE, 0, 0);
  }

  private detectReadinessErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    const isProfileView = this.detectProfileView(pose);
    const errors: PostureError[] = [];
    
    if (isProfileView) {
      errors.push(...this.detectProfileReadinessErrors(pose, angles));
    } else {
      errors.push(...this.detectFrontalErrors(pose, angles, false));
    }
    
    return errors;
  }

  private detectProfileReadinessErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    const errors: PostureError[] = [];
    const timestamp = Date.now();

    // 🔥 MUY PERMISIVO EN PREPARACIÓN - Solo alertar si es extremo (< 35°)
    const spineAngle = angles.spine_angle || 85;
    if (spineAngle < 35 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
      const severity = spineAngle < 25 ? 8 : 5;
      errors.push({
        type: PostureErrorType.ROUNDED_BACK,
        severity: severity,
        description: severity > 7 ? 'Espalda muy encorvada' : 'Intenta enderezar la espalda',
        recommendation: 'Párate más derecho para empezar',
        affectedJoints: ['spine'],
        confidence: 0.8,
        timestamp
      });
    }

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
    }

    return errors;
  }

  private detectRealPosturalErrors(pose: PoseKeypoints, angles: BiomechanicalAngles): PostureError[] {
    const errors: PostureError[] = [];
    const timestamp = Date.now();

    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        errors.push(...this.detectRealSquatErrors(pose, angles, timestamp));
        break;
      case ExerciseType.DEADLIFTS:
        errors.push(...this.detectDeadliftErrors(pose, angles, timestamp));
        break;
      case ExerciseType.LUNGES:
        errors.push(...this.detectLungeErrors(pose, angles, timestamp));
        break;
      case ExerciseType.BARBELL_ROW:
        errors.push(...this.detectBarbellRowErrors(pose, angles, timestamp));
        break;
    }

    return errors;
  }

  private detectRealSquatErrors(pose: PoseKeypoints, angles: BiomechanicalAngles, timestamp: number): PostureError[] {
    const errors: PostureError[] = [];
    const isProfileView = this.detectProfileView(pose);
    
    if (isProfileView) {
      errors.push(...this.detectProfileSquatErrors(pose, angles, timestamp));
    } else {
      errors.push(...this.detectFrontalErrors(pose, angles, true));
    }
    
    if (errors.length > 1) {
      const mostSevere = errors.reduce((prev, current) => 
        current.severity > prev.severity ? current : prev
      );
      return [mostSevere];
    }

    return errors;
  }

  private detectProfileView(pose: PoseKeypoints): boolean {
    const leftShoulder = pose.left_shoulder;
    const rightShoulder = pose.right_shoulder;
    const leftHip = pose.left_hip;
    const rightHip = pose.right_hip;
    const leftKnee = pose.left_knee;
    const rightKnee = pose.right_knee;

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return false;
    }

    // ✅ MÉTODO 1: Distancia horizontal entre hombros y caderas
    const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
    const hipDistance = Math.abs(leftHip.x - rightHip.x);
    const avgTorsoDistance = (shoulderDistance + hipDistance) / 2;

    // ✅ MÉTODO 2: Distancia entre rodillas (si están visibles)
    let kneeDistance = 0;
    if (leftKnee && rightKnee &&
        leftKnee.visibility > 0.5 && rightKnee.visibility > 0.5) {
      kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
    }

    // ✅ Vista de PERFIL: Distancias horizontales muy pequeñas
    const isProfile = avgTorsoDistance < 0.12 &&
                     (kneeDistance === 0 || kneeDistance < 0.12);

    if (isProfile) {
      console.log(`📐 VISTA DE PERFIL detectada (torso: ${avgTorsoDistance.toFixed(3)}, rodillas: ${kneeDistance.toFixed(3)})`);
    } else {
      console.log(`📐 VISTA FRONTAL detectada (torso: ${avgTorsoDistance.toFixed(3)}, rodillas: ${kneeDistance.toFixed(3)})`);
    }

    return isProfile;
  }

  private checkStartingPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.checkSquatStartPosition(pose, angles);
      case ExerciseType.DEADLIFTS:
        return this.checkDeadliftStartPosition(pose, angles);
      case ExerciseType.LUNGES:
        return this.checkLungeStartPosition(pose, angles);
      case ExerciseType.BARBELL_ROW:
        return this.checkBarbellRowStartPosition(pose, angles);
      default:
        return true;
    }
  }

  private checkSquatStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const isProfileView = this.detectProfileView(pose);

    // ✅ PERFIL: Verificación simplificada
    if (isProfileView) {
      return this.checkProfileSquatStartPosition(pose, angles);
    }

    // ✅ FRONTAL: Verificación completa con pies
    return this.checkFrontalSquatStartPosition(pose, angles);
  }

  // ✅ NUEVO: Verificación específica para VISTA DE PERFIL
  private checkProfileSquatStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    // 1️⃣ Rodillas extendidas (de pie)
    const leftKnee = angles.left_knee_angle || 0;
    const rightKnee = angles.right_knee_angle || 0;
    const leftVisible = pose.left_knee?.visibility || 0;
    const rightVisible = pose.right_knee?.visibility || 0;

    // Usar la rodilla más visible
    const kneeAngle = leftVisible > rightVisible ? leftKnee : rightKnee;

    // ✅ NUEVO: Si ya está ejercitando, ser MÁS TOLERANTE
    const isExercising = this.readinessState === ReadinessState.EXERCISING;
    const kneeThreshold = isExercising ? 120 : 140; // Más tolerante durante ejercicio

    if (kneeAngle < kneeThreshold) {
      if (!isExercising) {
        console.log(`🔴 PERFIL: Rodillas no extendidas (${kneeAngle.toFixed(1)}°)`);
      }
      return false;
    }

    // 2️⃣ Espalda razonablemente recta (más tolerante durante ejercicio)
    const spineAngle = angles.spine_angle || 85;
    const spineThreshold = isExercising ? 40 : 50; // Más tolerante durante ejercicio

    if (spineAngle < spineThreshold) {
      if (!isExercising) {
        console.log(`🔴 PERFIL: Espalda muy curvada (${spineAngle.toFixed(1)}°)`);
      }
      return false;
    }

    // 3️⃣ Verificar que al menos una cadera y un tobillo sean visibles
    const hipVisible = (pose.left_hip?.visibility || 0) > 0.7 || (pose.right_hip?.visibility || 0) > 0.7;
    const ankleVisible = (pose.left_ankle?.visibility || 0) > 0.7 || (pose.right_ankle?.visibility || 0) > 0.7;

    if (!hipVisible || !ankleVisible) {
      if (!isExercising) {
        console.log('🔴 PERFIL: Partes del cuerpo no visibles');
      }
      return false;
    }

    if (!isExercising) {
      console.log(`✅ PERFIL: Posición inicial correcta (rodilla: ${kneeAngle.toFixed(1)}°, columna: ${spineAngle.toFixed(1)}°)`);
    }
    return true;
  }

  // ✅ NUEVO: Verificación específica para VISTA FRONTAL
  private checkFrontalSquatStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    // 1️⃣ Rodillas extendidas
    const leftKnee = angles.left_knee_angle || 0;
    const rightKnee = angles.right_knee_angle || 0;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    // ✅ NUEVO: Si ya está ejercitando, ser MÁS TOLERANTE
    const isExercising = this.readinessState === ReadinessState.EXERCISING;
    const kneeThreshold = isExercising ? 120 : 140;

    if (avgKneeAngle < kneeThreshold) {
      if (!isExercising) {
        console.log(`🔴 FRONTAL: Rodillas no extendidas (${avgKneeAngle.toFixed(1)}°)`);
      }
      return false;
    }

    // 2️⃣ Ambos pies en el suelo (solo verificar al inicio)
    if (!isExercising) {
      const bothFeetOnGround = this.checkBothFeetOnGround(pose);
      if (!bothFeetOnGround) {
        console.log('🔴 FRONTAL: Un pie levantado');
        return false;
      }

      // 3️⃣ Separación correcta de pies (solo verificar al inicio)
      const goodFeetSpacing = this.checkFeetSpacing(pose);
      if (!goodFeetSpacing) {
        console.log('🔴 FRONTAL: Separación de pies incorrecta');
        return false;
      }
    }

    if (!isExercising) {
      console.log(`✅ FRONTAL: Posición inicial correcta (rodillas: ${avgKneeAngle.toFixed(1)}°)`);
    }
    return true;
  }

  // ============================================================================
  // 💪 VERIFICACIÓN POSICIÓN INICIAL - PESO MUERTO
  // ============================================================================
  private checkDeadliftStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const isProfileView = this.detectProfileView(pose);
    const isExercising = this.readinessState === ReadinessState.EXERCISING;

    // En peso muerto, la posición inicial es de pie (cadera extendida)
    const leftHip = angles.left_hip_angle || 0;
    const rightHip = angles.right_hip_angle || 0;
    const avgHipAngle = (leftHip + rightHip) / 2;

    // Más permisivo en perfil
    const hipThreshold = isProfileView ? (isExercising ? 120 : 135) : (isExercising ? 140 : 160);

    if (avgHipAngle < hipThreshold) {
      if (!isExercising) {
        console.log(`🔴 PESO MUERTO: Caderas no extendidas (${avgHipAngle.toFixed(1)}°)`);
      }
      return false;
    }

    // Verificar espalda razonablemente recta
    const spineAngle = angles.spine_angle || 85;
    // Más permisivo en perfil
    const spineThreshold = isProfileView ? (isExercising ? 35 : 45) : (isExercising ? 50 : 60);

    if (spineAngle < spineThreshold) {
      if (!isExercising) {
        console.log(`🔴 PESO MUERTO: Espalda muy curvada (${spineAngle.toFixed(1)}°)`);
      }
      return false;
    }

    if (!isExercising) {
      console.log(`✅ PESO MUERTO: Posición inicial correcta (cadera: ${avgHipAngle.toFixed(1)}°, columna: ${spineAngle.toFixed(1)}°)`);
    }
    return true;
  }

  // ============================================================================
  // 🏃 VERIFICACIÓN POSICIÓN INICIAL - ZANCADAS
  // ============================================================================
  private checkLungeStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const isExercising = this.readinessState === ReadinessState.EXERCISING;

    // En zancadas, comenzar de pie con ambas piernas juntas
    const leftKnee = angles.left_knee_angle || 0;
    const rightKnee = angles.right_knee_angle || 0;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    const kneeThreshold = isExercising ? 120 : 140;

    if (avgKneeAngle < kneeThreshold) {
      if (!isExercising) {
        console.log(`🔴 ZANCADA: Rodillas no extendidas (${avgKneeAngle.toFixed(1)}°)`);
      }
      return false;
    }

    // Verificar que ambos pies estén en el suelo
    if (!isExercising && !this.checkBothFeetOnGround(pose)) {
      console.log('🔴 ZANCADA: Un pie levantado');
      return false;
    }

    if (!isExercising) {
      console.log(`✅ ZANCADA: Posición inicial correcta (rodillas: ${avgKneeAngle.toFixed(1)}°)`);
    }
    return true;
  }

  // ============================================================================
  // 🚣 VERIFICACIÓN POSICIÓN INICIAL - REMO CON BARRA
  // ============================================================================
  private checkBarbellRowStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const isProfileView = this.detectProfileView(pose);
    const isExercising = this.readinessState === ReadinessState.EXERCISING;

    // En remo, posición inicial es inclinado hacia adelante con brazos extendidos
    const leftElbow = angles.left_elbow_angle || 0;
    const rightElbow = angles.right_elbow_angle || 0;
    const avgElbowAngle = (leftElbow + rightElbow) / 2;

    const leftHip = angles.left_hip_angle || 180;
    const rightHip = angles.right_hip_angle || 180;
    const avgHipAngle = (leftHip + rightHip) / 2;
    const spineAngle = angles.spine_angle || 85;

    if (this.detectProfileView(pose)) {
      // PERFIL: permitir torso inclinado y codos extendidos
      if (avgHipAngle > 100 && avgHipAngle < 160 && avgElbowAngle > 120) {
        if (!isExercising) {
          console.log(`✅ REMO PERFIL: Posición inicial correcta (cadera: ${avgHipAngle.toFixed(1)}°, codos: ${avgElbowAngle.toFixed(1)}°)`);
        }
        return true;
      } else {
        if (!isExercising) {
          console.log(`🔴 REMO PERFIL: Cadera no flexionada o codos no extendidos (cadera: ${avgHipAngle.toFixed(1)}°, codos: ${avgElbowAngle.toFixed(1)}°)`);
        }
        return false;
      }
    } else {
      // FRONTAL: lógica original restaurada
      const elbowThreshold = isExercising ? 120 : 140;
      if (avgElbowAngle < elbowThreshold) {
        if (!isExercising) {
          console.log(`🔴 REMO FRONTAL: Codos no extendidos (${avgElbowAngle.toFixed(1)}°)`);
        }
        return false;
      }
      if (avgHipAngle > 160) {
        if (!isExercising) {
          console.log(`🔴 REMO FRONTAL: Torso no inclinado (${avgHipAngle.toFixed(1)}°)`);
        }
        return false;
      }
      const spineThreshold = isExercising ? 50 : 60;
      if (spineAngle < spineThreshold) {
        if (!isExercising) {
          console.log(`🔴 REMO FRONTAL: Espalda muy curvada (${spineAngle.toFixed(1)}°)`);
        }
        return false;
      }
      if (!isExercising) {
        console.log(`✅ REMO FRONTAL: Posición inicial correcta (codos: ${avgElbowAngle.toFixed(1)}°, cadera: ${avgHipAngle.toFixed(1)}°)`);
      }
      return true;
    }
  }

  private detectMovement(angles: BiomechanicalAngles): boolean {
    if (!this.lastAngleSnapshot) {
      this.lastAngleSnapshot = angles;
      return false;
    }

    const leftKneeDiff = Math.abs((angles.left_knee_angle || 0) - (this.lastAngleSnapshot.left_knee_angle || 0));
    const rightKneeDiff = Math.abs((angles.right_knee_angle || 0) - (this.lastAngleSnapshot.right_knee_angle || 0));
    const avgDiff = (leftKneeDiff + rightKneeDiff) / 2;

    // ✅ NUEVO: Usar threshold específico según vista
    const currentThreshold = this.getCurrentMovementThreshold();

    this.lastAngleSnapshot = angles;

    const hasMovement = avgDiff > currentThreshold;

    if (hasMovement) {
      console.log(`🏃 MOVIMIENTO DETECTADO: ${avgDiff.toFixed(1)}° (threshold: ${currentThreshold}°)`);
    }

    return hasMovement;
  }

  // ✅ NUEVO: Obtener threshold según vista
  private getCurrentMovementThreshold(): number {
    // Detectar vista basada en último pose conocido
    // Si no hay historia de ángulos, usar threshold más permisivo
    if (this.angleHistory.length === 0) {
      return this.MOVEMENT_THRESHOLD_PROFILE;
    }

    // Para simplificar, usar PROFILE threshold si estamos en estado de preparación
    // y FRONTAL si ya estamos ejercitando
    return this.readinessState === ReadinessState.EXERCISING
      ? this.MOVEMENT_THRESHOLD_FRONTAL
      : this.MOVEMENT_THRESHOLD_PROFILE;
  }

  private detectPhase(angles: BiomechanicalAngles): RepetitionPhase {
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.detectSquatPhase(angles);
      case ExerciseType.DEADLIFTS:
        return this.detectDeadliftPhase(angles);
      case ExerciseType.LUNGES:
        return this.detectLungePhase(angles);
      case ExerciseType.BARBELL_ROW:
        return this.detectBarbellRowPhase(angles);
      default:
        return RepetitionPhase.IDLE;
    }
  }

  private detectSquatPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;

    // ✅ NUEVO: En vista de perfil, usar solo la rodilla más visible
    const leftVisible = this.angleHistory.length > 0 ?
      (this.angleHistory[this.angleHistory.length - 1].left_knee_angle ? 1 : 0) : 1;
    const rightVisible = this.angleHistory.length > 0 ?
      (this.angleHistory[this.angleHistory.length - 1].right_knee_angle ? 1 : 0) : 1;

    const avgKneeAngle = leftVisible >= rightVisible ?
      leftKnee : rightKnee;

    // ✅ UMBRALES MEJORADOS: TOP más alto, BOTTOM más bajo para sentadillas profundas
    if (avgKneeAngle > 145) {
      return RepetitionPhase.TOP;
    } else if (avgKneeAngle < 110) {
      // ✅ 110° permite sentadillas profundas (hasta 30°)
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
        const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
        const prevAvgKnee = leftVisible >= rightVisible ? prevLeftKnee : prevRightKnee;

        return avgKneeAngle < prevAvgKnee
          ? RepetitionPhase.DESCENDING
          : RepetitionPhase.ASCENDING;
      }
      return RepetitionPhase.DESCENDING;
    }
  }

  // ============================================================================
  // 💪 DETECCIÓN DE FASE - PESO MUERTO
  // ============================================================================
  private detectDeadliftPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftHip = angles.left_hip_angle || 180;
    const rightHip = angles.right_hip_angle || 180;
    const avgHipAngle = (leftHip + rightHip) / 2;

    // TOP: Cadera extendida (de pie)
    // BOTTOM: Cadera flexionada (barra en el suelo)
    if (avgHipAngle > 165) {
      return RepetitionPhase.TOP;
    } else if (avgHipAngle < 100) {
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevLeftHip = this.angleHistory[this.angleHistory.length - 2].left_hip_angle || 180;
        const prevRightHip = this.angleHistory[this.angleHistory.length - 2].right_hip_angle || 180;
        const prevAvgHip = (prevLeftHip + prevRightHip) / 2;

        return avgHipAngle < prevAvgHip
          ? RepetitionPhase.DESCENDING
          : RepetitionPhase.ASCENDING;
      }
      return RepetitionPhase.DESCENDING;
    }
  }

  // ============================================================================
  // 🏃 DETECCIÓN DE FASE - ZANCADAS
  // ============================================================================
  private detectLungePhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftKnee = angles.left_knee_angle || 180;
    const rightKnee = angles.right_knee_angle || 180;

    // En zancadas, una rodilla está más flexionada que la otra
    const frontKnee = Math.min(leftKnee, rightKnee); // La pierna delantera

    // TOP: De pie, rodilla delantera extendida
    // BOTTOM: Rodilla delantera flexionada ~90°
    if (frontKnee > 145) {
      return RepetitionPhase.TOP;
    } else if (frontKnee < 100) {
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
        const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
        const prevFrontKnee = Math.min(prevLeftKnee, prevRightKnee);

        return frontKnee < prevFrontKnee
          ? RepetitionPhase.DESCENDING
          : RepetitionPhase.ASCENDING;
      }
      return RepetitionPhase.DESCENDING;
    }
  }

  // ============================================================================
  // 🚣 DETECCIÓN DE FASE - REMO CON BARRA
  // ============================================================================
  private detectBarbellRowPhase(angles: BiomechanicalAngles): RepetitionPhase {
    const leftElbow = angles.left_elbow_angle || 180;
    const rightElbow = angles.right_elbow_angle || 180;
    const avgElbowAngle = (leftElbow + rightElbow) / 2;

    // TOP: Codos flexionados (barra cerca del cuerpo)
    // BOTTOM: Codos extendidos (barra abajo)
    if (avgElbowAngle < 60) {
      return RepetitionPhase.TOP; // Contracción máxima
    } else if (avgElbowAngle > 140) {
      return RepetitionPhase.BOTTOM; // Extensión completa
    } else {
      if (this.angleHistory.length >= 2) {
        const prevLeftElbow = this.angleHistory[this.angleHistory.length - 2].left_elbow_angle || 180;
        const prevRightElbow = this.angleHistory[this.angleHistory.length - 2].right_elbow_angle || 180;
        const prevAvgElbow = (prevLeftElbow + prevRightElbow) / 2;

        return avgElbowAngle < prevAvgElbow
          ? RepetitionPhase.ASCENDING // Tirando hacia arriba
          : RepetitionPhase.DESCENDING; // Bajando
      }
      return RepetitionPhase.DESCENDING;
    }
  }

  private getMostCommonPhase(): RepetitionPhase {
    if (this.phaseHistory.length === 0) return RepetitionPhase.IDLE;

    const phaseCounts = new Map<RepetitionPhase, number>();
    this.phaseHistory.forEach(phase => {
      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1);
    });

    let mostCommon = this.phaseHistory[0];
    let maxCount = 0;

    phaseCounts.forEach((count, phase) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = phase;
      }
    });

    return mostCommon;
  }
  private isRepetitionComplete(currentPhase: RepetitionPhase): boolean {
    // ✅ MEJORADO: Requiere ciclo completo
    
    // Solo contar si:
    // 1. Está en TOP
    // 2. Viene de ASCENDING
    // 3. Ya pasó por BOTTOM
      if (currentPhase === RepetitionPhase.TOP && 
        this.phaseTransitions.lastPhase === RepetitionPhase.ASCENDING) {
      
      // ✅ VERIFICAR que haya pasado por BOTTOM
      if (this.phaseTransitions.bottomCount > this.phaseTransitions.topCount) {
        this.phaseTransitions.topCount++;
        this.phaseTransitions.lastPhase = currentPhase;
        
        console.log('✅ REPETICIÓN COMPLETA:', {
          topCount: this.phaseTransitions.topCount,
          bottomCount: this.phaseTransitions.bottomCount
        });
        
        return true;
      }
    }
  
    // Registrar cuando pasa por BOTTOM
    if (currentPhase === RepetitionPhase.BOTTOM && 
        this.phaseTransitions.lastPhase === RepetitionPhase.DESCENDING) {
      this.phaseTransitions.bottomCount++;
      console.log('📍 Pasó por BOTTOM:', this.phaseTransitions.bottomCount);
    }
  
    this.phaseTransitions.lastPhase = currentPhase;
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

  private resetToNotReady(): void {
    if (this.readinessState !== ReadinessState.NOT_READY) {
      console.log('🔄 Usuario fuera de cámara - reseteando a NOT_READY');
      this.readinessState = ReadinessState.NOT_READY;
      this.exerciseFramesCount = 0;
      this.outOfPositionFrames = 0;
      this.readyFramesCount = 0;
      this.badFramesBuffer = 0;
      this.hasStartedExercising = false; // ✅ RESETEAR FLAG
      this.repetitionCounter = 0; // ✅ RESETEAR REPETICIONES
    }
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
        return 'Párate de frente o de perfil para empezar';
      case ReadinessState.GETTING_READY:
        return `Mantén la posición... (${this.readyFramesCount}/${this.FRAMES_TO_CONFIRM_READY})`;
      case ReadinessState.READY_TO_START:
        return '¡Listo! Empieza a hacer sentadillas';
      case ReadinessState.EXERCISING:
        return `Ejercitándose - ${this.repetitionCounter} repeticiones`;
      default:
        return 'Preparándose...';
    }
  }

  generatePositiveMessage(): string {
    const messages = [
      '¡Excelente repetición! Sigue así',
      '¡Perfecto! Repetición completada correctamente',
      '¡Muy bien! Gran técnica en esa repetición',
      '¡Increíble! Repetición ejecutada perfectamente',
      '¡Fantástico! Técnica impecable en esa repetición'
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
    this.badFramesBuffer = 0;
    this.movementDetected = false;
    this.lastAngleSnapshot = null;
    this.exerciseFramesCount = 0;
    this.outOfPositionFrames = 0;
    this.wasReady = false;
    this.hasStartedExercising = false; // ✅ RESETEAR FLAG
    console.log('🔄 Análisis reseteado');
  }

  cleanup(): void {
    this.resetAnalysis();
    console.log('🧹 BiomechanicsAnalyzer limpiado');
  }

  debugDetections(pose: PoseKeypoints): void {
    console.log('🔍 === DEBUG DETECCIONES ===');
    console.log(`👁️ Vista de perfil: ${this.detectProfileView(pose)}`);
    console.log(`👣 Ambos pies en suelo: ${this.checkBothFeetOnGround(pose)}`);
    console.log(`🚦 Estado de preparación: ${this.readinessState}`);
    console.log('🔍 === FIN DEBUG ===');
  }
}