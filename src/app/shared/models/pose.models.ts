// src/app/shared/models/pose.models.ts
// ✅ MODELOS CORREGIDOS Y SIMPLIFICADOS

// 🧍 LANDMARK DE POSE
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

// 🎯 PUNTOS CLAVE DEL CUERPO
export interface PoseKeypoints {
  // Cabeza
  nose: PoseLandmark;
  left_eye_inner: PoseLandmark;
  left_eye: PoseLandmark;
  left_eye_outer: PoseLandmark;
  right_eye_inner: PoseLandmark;
  right_eye: PoseLandmark;
  right_eye_outer: PoseLandmark;
  left_ear: PoseLandmark;
  right_ear: PoseLandmark;
  mouth_left: PoseLandmark;
  mouth_right: PoseLandmark;

  // Tren superior
  left_shoulder: PoseLandmark;
  right_shoulder: PoseLandmark;
  left_elbow: PoseLandmark;
  right_elbow: PoseLandmark;
  left_wrist: PoseLandmark;
  right_wrist: PoseLandmark;
  left_pinky: PoseLandmark;
  right_pinky: PoseLandmark;
  left_index: PoseLandmark;
  right_index: PoseLandmark;
  left_thumb: PoseLandmark;
  right_thumb: PoseLandmark;

  // Tren inferior
  left_hip: PoseLandmark;
  right_hip: PoseLandmark;
  left_knee: PoseLandmark;
  right_knee: PoseLandmark;
  left_ankle: PoseLandmark;
  right_ankle: PoseLandmark;
  left_heel: PoseLandmark;
  right_heel: PoseLandmark;
  left_foot_index: PoseLandmark;
  right_foot_index: PoseLandmark;

  // Índice dinámico para acceder por string
  [key: string]: PoseLandmark;
}

// 📐 ÁNGULOS BIOMECÁNICOS
export interface BiomechanicalAngles {
  // Ángulos de brazos
  left_elbow_angle?: number;
  right_elbow_angle?: number;
  left_shoulder_angle?: number;
  right_shoulder_angle?: number;

  // Ángulos de piernas
  left_knee_angle?: number;
  right_knee_angle?: number;
  left_hip_angle?: number;
  right_hip_angle?: number;
  left_ankle_angle?: number;
  right_ankle_angle?: number;

  // Ángulos del tronco
  trunk_angle?: number;
  spine_angle?: number;
  neck_angle?: number;

  // Índice dinámico
  [key: string]: number | undefined;
}

// 🏋️ TIPOS DE EJERCICIO
export enum ExerciseType {
  SQUATS = 'squats',
  PUSHUPS = 'pushups',
  LUNGES = 'lunges',
  PLANK = 'plank',
  BICEP_CURLS = 'bicep_curls',
  DEADLIFTS = 'deadlifts',
  OVERHEAD_PRESS = 'overhead_press'
}

// 🔄 FASES DE REPETICIÓN
export enum RepetitionPhase {
  IDLE = 'idle',
  TOP = 'top',
  DESCENDING = 'descending',
  BOTTOM = 'bottom',
  ASCENDING = 'ascending',
  HOLD = 'hold'
}

// 🚨 TIPOS DE ERROR POSTURAL
export enum PostureErrorType {
  // Errores generales
  POOR_ALIGNMENT = 'poor_alignment',
  EXCESSIVE_SPEED = 'excessive_speed',
  ASYMMETRY = 'asymmetry',
  SHALLOW_DEPTH = 'shallow_depth',
  
  // Errores específicos de sentadillas
  KNEE_VALGUS = 'knee_valgus',
  FORWARD_LEAN = 'forward_lean',
  BUTT_WINK = 'butt_wink',
  HEEL_RISE = 'heel_rise',
  
  // Errores específicos de flexiones
  SAGGING_HIPS = 'sagging_hips',
  RAISED_HIPS = 'raised_hips',
  HEAD_POSITION = 'head_position',
  ELBOW_FLARE = 'elbow_flare',
  
  // Errores específicos de plancha
  CORE_WEAKNESS = 'core_weakness',
  SHOULDER_INSTABILITY = 'shoulder_instability',
  
  // Errores específicos de estocadas
  KNEE_FORWARD = 'knee_forward',
  BALANCE_LOSS = 'balance_loss',
  
  // Errores específicos de curl de bíceps
  MOMENTUM_USE = 'momentum_use',
  ELBOW_MOVEMENT = 'elbow_movement'
}

// 🚨 ERROR POSTURAL
export interface PostureError {
  type: PostureErrorType;
  severity: number; // 1-10 (1=leve, 10=crítico)
  description: string;
  recommendation: string;
  affectedJoints: string[];
  confidence: number; // 0-1
  timestamp: number;
  
  // Información biomecánica opcional
  biomechanicalData?: {
    angleDeviation?: number;
    forceImbalance?: number;
    positionError?: number;
  };
}

// 📊 REGLA DE DETECCIÓN DE ERROR
export interface PostureErrorRule {
  errorType: PostureErrorType;
  condition: string; // Descripción de la condición
  threshold: number;
  message: string;
  recommendation: string;
  severity: number;
  biomechanicalBasis?: string;
  correctionCues?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  musculatureInvolved?: string[];
}

// 🏋️ CONFIGURACIÓN DE EJERCICIO
export interface ExerciseConfiguration {
  type: ExerciseType;
  name: string;
  spanish_name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  keyJoints: string[];
  angleThresholds: { [key: string]: AngleThreshold };
  errorDetectionRules: PostureErrorRule[];
  biomechanicalFocus: string;
  description: string;
  scientificValidation?: {
    referenceStudy: string;
    validationAccuracy: number;
    sampleSize: number;
  };
}

// 📐 UMBRAL DE ÁNGULO
export interface AngleThreshold {
  min: number;
  max: number;
  ideal: number;
  critical: number;
  warning?: number;
}

// 📐 UMBRAL AVANZADO DE ÁNGULO
export interface AdvancedAngleThreshold extends AngleThreshold {
  tolerance: number;
  adaptiveRange: boolean;
  personnalizationFactor: number;
}

// 📊 MÉTRICAS DE PRECISIÓN
export interface PrecisionMetrics {
  frameStability: number; // 0-100%
  angularAccuracy: number; // 0-100%
  temporalConsistency: number; // 0-100%
  landmarkConfidence: number; // 0-100%
  overallPrecision: number; // 0-100%
}

// 📊 MÉTRICAS DE RENDIMIENTO
export interface PerformanceMetrics {
  fps: number;
  latency: number; // ms
  processingTime: number; // ms
  memoryUsage: number; // MB
  cpuUsage: number; // %
  batteryImpact: 'low' | 'medium' | 'high';
}

// 📊 ANÁLISIS DE MOVIMIENTO
export interface MovementAnalysis {
  errors: PostureError[];
  phase: RepetitionPhase;
  repetitionCount: number;
  qualityScore: number; // 0-100
  precisionMetrics?: PrecisionMetrics;
  performanceMetrics?: PerformanceMetrics;
  scientificValidation?: {
    isWithinTargets: boolean;
    angularAccuracy: number;
    correlationCoefficient: number;
  };
}

// 📈 ESTADÍSTICAS DE SESIÓN
export interface SessionStats {
  sessionDuration: number; // segundos
  frameRate: number;
  errorDistribution: { [key in PostureErrorType]?: number };
  biomechanicalAnalysis: {
    averageAngularAccuracy: number;
    movementStability: number;
    temporalConsistency: number;
  };
  recommendations: string[];
}

// 🎯 PUNTO DE REFERENCIA BIOMECÁNICO
export interface BiomechanicalReference {
  jointName: string;
  referenceAngle: number;
  tolerance: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  muscleGroups: string[];
}

// 🔄 ESTADO DE ENTRENAMIENTO
export interface TrainingState {
  isActive: boolean;
  currentExercise: ExerciseType;
  currentPhase: RepetitionPhase;
  repetitionCount: number;
  sessionStartTime: number;
  lastErrorTimestamp: number;
  qualityTrend: number[]; // Últimas 10 calificaciones
}

// 📱 CONFIGURACIÓN DE DISPOSITIVO
export interface DeviceConfiguration {
  cameraResolution: { width: number; height: number };
  targetFPS: number;
  processingQuality: 'low' | 'medium' | 'high';
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  adaptivePerformance: boolean;
}

// 🎤 CONFIGURACIÓN DE AUDIO
export interface AudioConfiguration {
  enabled: boolean;
  voice: 'male' | 'female' | 'auto';
  language: string;
  volume: number; // 0-1
  rate: number; // 0.5-2.0
  pitch: number; // 0-2
  cooldownTime: number; // ms entre mensajes
}

// 🎨 CONFIGURACIÓN VISUAL
export interface VisualConfiguration {
  showSkeleton: boolean;
  showAngles: boolean;
  showErrorOverlay: boolean;
  skeletonColor: string;
  errorColor: string;
  successColor: string;
  opacity: number;
  thickness: number;
}

// 🔬 VALIDACIÓN CIENTÍFICA
export interface ScientificValidation {
  isValidated: boolean;
  studyReference: string;
  accuracy: number;
  sampleSize: number;
  populationDemographics: string[];
  limitations: string[];
  confidenceLevel: number;
}

// 📊 REPORTE DE VALIDACIÓN
export interface ValidationReport {
  precision: PrecisionMetrics;
  performance: PerformanceMetrics;
  errors: PostureError[];
  recommendations: string[];
  scientificBasis: ScientificValidation;
  timestamp: number;
}

// 🎯 CONFIGURACIÓN COMPLETA DEL SISTEMA
export interface SystemConfiguration {
  device: DeviceConfiguration;
  audio: AudioConfiguration;
  visual: VisualConfiguration;
  detection: {
    sensitivity: number; // 0-1
    cooldownTime: number;
    minConfidence: number;
    adaptiveThresholds: boolean;
  };
  training: {
    autoStart: boolean;
    sessionTimeout: number;
    maxDuration: number;
    restReminders: boolean;
  };
}

// 🚀 RESPUESTA DEL MOTOR DE DETECCIÓN
export interface DetectionEngineResponse {
  success: boolean;
  pose: PoseKeypoints | null;
  angles: BiomechanicalAngles | null;
  analysis: MovementAnalysis | null;
  error?: string;
  processingTime: number;
  timestamp: number;
}