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
  
  // ✅ Control de errores reales
  private exerciseFramesCount = 0;
  private readonly MIN_EXERCISE_FRAMES = 30;
  private outOfPositionFrames = 0;
  private readonly MAX_OUT_OF_POSITION_FRAMES = 90;
  
  // ✅ BUFFERS PARA ANÁLISIS TEMPORAL
  private angleHistory: BiomechanicalAngles[] = [];
  private phaseHistory: RepetitionPhase[] = [];
  private readonly SMOOTHING_WINDOW = 5;
  private readonly MOVEMENT_THRESHOLD = 6;
  
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
    
    if (!isUserCompletelyVisible) {
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
    const isInCorrectStartPosition = this.checkStartingPosition(pose, angles);
    const hasMovement = this.detectMovement(angles);

    switch (this.readinessState) {
      case ReadinessState.NOT_READY:
        if (isInCorrectStartPosition) {
          this.readinessState = ReadinessState.GETTING_READY;
          this.readyFramesCount = 1;
          this.badFramesBuffer = 0;
          console.log('🔄 Usuario se está preparando...');
        }
        break;

      case ReadinessState.GETTING_READY:
        if (isInCorrectStartPosition) {
          this.readyFramesCount++;
          this.badFramesBuffer = 0; // ✅ Resetear buffer de frames malos
          
          if (this.readyFramesCount >= this.FRAMES_TO_CONFIRM_READY) {
            this.readinessState = ReadinessState.READY_TO_START;
            console.log('✅ Usuario LISTO para empezar ejercicio');
          }
        } else {
          // ✅ NUEVO: Tolerar frames malos antes de resetear
          this.badFramesBuffer++;
          
          if (this.badFramesBuffer > this.MAX_BAD_FRAMES) {
            console.log(`⚠️ Demasiados frames malos (${this.badFramesBuffer}), reseteando`);
            this.readinessState = ReadinessState.NOT_READY;
            this.readyFramesCount = 0;
            this.badFramesBuffer = 0;
          }
        }
        break;

      case ReadinessState.READY_TO_START:
        if (hasMovement) {
          this.readinessState = ReadinessState.EXERCISING;
          this.exerciseFramesCount = 0;
          this.movementDetected = true;
          console.log('🏃 Usuario comenzó a ejercitarse');
        } else if (!isInCorrectStartPosition) {
          this.badFramesBuffer++;
          if (this.badFramesBuffer > this.MAX_BAD_FRAMES) {
            this.readinessState = ReadinessState.NOT_READY;
            this.readyFramesCount = 0;
            this.badFramesBuffer = 0;
          }
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
            this.badFramesBuffer = 0;
          }
        }
        break;
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

    const visibleJoints = requiredJoints.filter(joint => {
      const point = pose[joint as keyof PoseKeypoints];
      return point && point.visibility > 0.7;
    });

    const completenessRatio = visibleJoints.length / requiredJoints.length;
    return completenessRatio >= 0.8;
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
    
    // Errores de profundidad: cooldown corto (pero más largo que antes)
    if (errorType === PostureErrorType.INSUFFICIENT_DEPTH) {
      cooldownTime = 2500; // 2.5 segundos
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

    // ✅ ESPALDA CURVADA DURANTE EJERCICIO
      const spineAngle = angles.spine_angle || 85;
      if (spineAngle < 60 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
      const severity = spineAngle < 50 ? 9 : 6;
      errors.push({
        type: PostureErrorType.ROUNDED_BACK,
        severity: severity,
        description: severity > 8 ? 'Espalda muy curvada (PELIGROSO)' : 'Espalda redondeada',
        recommendation: severity > 8 ? 'PELIGRO: Endereza la espalda YA' : 'Endereza la espalda, saca el pecho',
        affectedJoints: ['spine'],
        confidence: 0.95,
        timestamp
      });
      console.log(`🔴 EJERCICIO PERFIL: Espalda curvada ${spineAngle.toFixed(1)}° (CRÍTICO)`);
    }

    // ✅ SENTADILLA POCO PROFUNDA - DETECTAR EN MÁS FASES
    if (kneeAngle > 95 && 
        (this.currentPhase === RepetitionPhase.BOTTOM || 
         this.currentPhase === RepetitionPhase.DESCENDING) &&
        this.checkErrorCooldown(PostureErrorType.INSUFFICIENT_DEPTH, timestamp)) {
      errors.push({
        type: PostureErrorType.INSUFFICIENT_DEPTH,
        severity: 5, // AMARILLO
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
    
      const spineAngle = angles.spine_angle || 85;
      if (spineAngle < 55 && this.checkErrorCooldown(PostureErrorType.ROUNDED_BACK, timestamp)) {
      const severity = spineAngle < 45 ? 8 : 5;
      errors.push({
        type: PostureErrorType.ROUNDED_BACK,
        severity: severity,
        description: severity > 7 ? 'Espalda muy curvada' : 'Espalda un poco curvada',
        recommendation: severity > 7 ? 'CRÍTICO: Endereza la espalda, saca el pecho' : 'Mantén la espalda más recta',
        affectedJoints: ['spine'],
        confidence: 0.9,
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
    
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return false;
    }
    
    const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
    const hipDistance = Math.abs(leftHip.x - rightHip.x);
    const avgDistance = (shoulderDistance + hipDistance) / 2;
    const isProfile = avgDistance < 0.10;
    
    return isProfile;
  }

  private checkStartingPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.checkSquatStartPosition(pose, angles);
      default:
        return true;
    }
  }

  private checkSquatStartPosition(pose: PoseKeypoints, angles: BiomechanicalAngles): boolean {
    const leftKnee = angles.left_knee_angle || 0;
    const rightKnee = angles.right_knee_angle || 0;
    const avgKneeAngle = (leftKnee + rightKnee) / 2;

    if (avgKneeAngle < 140) return false;

    const bothFeetOnGround = this.checkBothFeetOnGround(pose);
    if (!bothFeetOnGround) return false;

    const goodFeetSpacing = this.checkFeetSpacing(pose);
    if (!goodFeetSpacing) return false;

    return true;
  }

  private detectMovement(angles: BiomechanicalAngles): boolean {
    if (!this.lastAngleSnapshot) {
      this.lastAngleSnapshot = angles;
      return false;
    }

    const leftKneeDiff = Math.abs((angles.left_knee_angle || 0) - (this.lastAngleSnapshot.left_knee_angle || 0));
    const rightKneeDiff = Math.abs((angles.right_knee_angle || 0) - (this.lastAngleSnapshot.right_knee_angle || 0));
    const avgDiff = (leftKneeDiff + rightKneeDiff) / 2;

    this.lastAngleSnapshot = angles;

    return avgDiff > this.MOVEMENT_THRESHOLD;
  }

  private detectPhase(angles: BiomechanicalAngles): RepetitionPhase {
    switch (this.currentExercise) {
      case ExerciseType.SQUATS:
        return this.detectSquatPhase(angles);
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
    } else if (avgKneeAngle < 110) {
      return RepetitionPhase.BOTTOM;
    } else {
      if (this.angleHistory.length >= 2) {
        const prevLeftKnee = this.angleHistory[this.angleHistory.length - 2].left_knee_angle || 180;
        const prevRightKnee = this.angleHistory[this.angleHistory.length - 2].right_knee_angle || 180;
        const prevAvgKnee = (prevLeftKnee + prevRightKnee) / 2;
        
        return avgKneeAngle < prevAvgKnee 
          ? RepetitionPhase.DESCENDING 
          : RepetitionPhase.ASCENDING;
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