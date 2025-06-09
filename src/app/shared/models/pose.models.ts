// src/app/shared/models/pose.models.ts
// ✅ MODELOS ACTUALIZADOS CON NUEVAS PROPIEDADES

export interface PoseLandmark {
  x: number;        // Coordenada X normalizada (0-1)
  y: number;        // Coordenada Y normalizada (0-1)
  z: number;        // Profundidad relativa
  visibility: number; // Confianza de detección (0-1)
}

export interface PoseKeypoints {
  // Cara y cabeza (0-10)
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

  // Torso superior (11-16)
  left_shoulder: PoseLandmark;
  right_shoulder: PoseLandmark;
  left_elbow: PoseLandmark;
  right_elbow: PoseLandmark;
  left_wrist: PoseLandmark;
  right_wrist: PoseLandmark;

  // Manos detalladas (17-22)
  left_pinky: PoseLandmark;
  right_pinky: PoseLandmark;
  left_index: PoseLandmark;
  right_index: PoseLandmark;
  left_thumb: PoseLandmark;
  right_thumb: PoseLandmark;

  // Torso y cadera (23-24)
  left_hip: PoseLandmark;
  right_hip: PoseLandmark;

  // Piernas (25-32)
  left_knee: PoseLandmark;
  right_knee: PoseLandmark;
  left_ankle: PoseLandmark;
  right_ankle: PoseLandmark;
  left_heel: PoseLandmark;
  right_heel: PoseLandmark;
  left_foot_index: PoseLandmark;
  right_foot_index: PoseLandmark;
}

export interface BiomechanicalAngles {
  // Ángulos articulares principales
  left_shoulder_angle?: number;
  right_shoulder_angle?: number;
  left_elbow_angle?: number;
  right_elbow_angle?: number;
  left_hip_angle?: number;
  right_hip_angle?: number;
  left_knee_angle?: number;
  right_knee_angle?: number;
  left_ankle_angle?: number;
  right_ankle_angle?: number;
  
  // Ángulos especiales
  spine_angle?: number;        // Inclinación del torso
  neck_angle?: number;         // Posición de la cabeza
  pelvis_tilt?: number;        // Inclinación pélvica
  
  // Simetría corporal
  shoulder_symmetry?: number;   // Diferencia entre hombros
  hip_symmetry?: number;        // Diferencia entre caderas
  knee_symmetry?: number;       // Diferencia entre rodillas
}

export interface PostureError {
  type: PostureErrorType;
  severity: number;           // 1-10 escala de severidad
  description: string;
  recommendation: string;
  affectedJoints: string[];
  confidence: number;         // Confianza en la detección (0-1)
  timestamp: number;
}

export enum PostureErrorType {
  // Errores de sentadillas (según tu anteproyecto)
  KNEE_VALGUS = 'knee_valgus',           // Rodillas hacia adentro
  FORWARD_LEAN = 'forward_lean',         // Inclinación excesiva
  HEEL_RISE = 'heel_rise',               // Levantar talones
  BUTT_WINK = 'butt_wink',               // Curvatura lumbar excesiva
  SHALLOW_DEPTH = 'shallow_depth',        // Profundidad insuficiente
  
  // Errores de flexiones
  SAGGING_HIPS = 'sagging_hips',         // Cadera hundida
  RAISED_HIPS = 'raised_hips',           // Cadera muy alta
  PARTIAL_ROM = 'partial_rom',           // Rango de movimiento parcial
  ELBOW_FLARE = 'elbow_flare',           // Codos muy abiertos
  HEAD_POSITION = 'head_position',        // Posición incorrecta de cabeza
  
  // Errores generales
  ASYMMETRY = 'asymmetry',               // Asimetría corporal
  POOR_ALIGNMENT = 'poor_alignment',     // Mala alineación
  INSUFFICIENT_DEPTH = 'insufficient_depth', // Profundidad insuficiente
  EXCESSIVE_SPEED = 'excessive_speed'     // Velocidad excesiva
}

export interface ExerciseRepetition {
  id: string;
  exerciseType: ExerciseType;
  startTime: number;
  endTime: number;
  duration: number;
  phase: RepetitionPhase;
  angles: BiomechanicalAngles[];
  errors: PostureError[];
  quality_score: number;      // 0-100 puntuación de calidad
  rom_percentage: number;     // Porcentaje del rango de movimiento
}

export enum ExerciseType {
  SQUATS = 'squats',
  PUSHUPS = 'pushups',
  LUNGES = 'lunges',
  PLANK = 'plank',
  BICEP_CURLS = 'bicep_curls',
  DEADLIFT = 'deadlift',
  BENCH_PRESS = 'bench_press',
  SHOULDER_PRESS = 'shoulder_press'
}

export enum RepetitionPhase {
  IDLE = 'idle',
  ECCENTRIC = 'eccentric',    // Fase de descenso
  BOTTOM = 'bottom',          // Posición inferior
  CONCENTRIC = 'concentric',  // Fase de ascenso
  TOP = 'top'                 // Posición superior
}

export interface TrainingSession {
  id: string;
  userId: string;
  exerciseType: ExerciseType;
  startTime: Date;
  endTime?: Date;
  repetitions: ExerciseRepetition[];
  totalDuration: number;
  averageQuality: number;
  totalErrors: number;
  improvements: string[];
  recommendations: string[];
}

export interface ExerciseConfiguration {
  type: ExerciseType;
  name: string;
  spanish_name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  keyJoints: string[];
  angleThresholds: { [key: string]: AdvancedAngleThreshold };  errorDetectionRules: PostureErrorRule[];
  biomechanicalFocus: string;
  description: string;
  // ✅ NUEVAS PROPIEDADES OPCIONALES
  scientificValidation?: {
    referenceStudy: string;
    validationAccuracy: number;
    sampleSize: number;
  };
}

// ✅ INTERFAZ ACTUALIZADA CON NUEVAS PROPIEDADES
export interface PostureErrorRule {
  errorType: PostureErrorType;
  condition: string;          // Condición matemática para detectar error
  threshold: number;
  message: string;
  recommendation: string;
  severity: number;
  // ✅ NUEVAS PROPIEDADES CIENTÍFICAS
  biomechanicalBasis?: string;    // Base biomecánica del error
  correctionCues?: string[];      // Consejos específicos de corrección
  riskLevel?: 'low' | 'medium' | 'high';  // Nivel de riesgo
  musculatureInvolved?: string[]; // Músculos involucrados
}

// ✅ NUEVAS INTERFACES PARA VALIDACIÓN CIENTÍFICA
export interface ValidationMetrics {
  angularAccuracy: number;      // Precisión angular en grados
  spatialAccuracy: number;      // Precisión espacial en centímetros
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

export interface ScientificAnalysisResult {
  errors: PostureError[];
  phase: RepetitionPhase;
  repetitionCount: number;
  qualityScore: number;
  // ✅ NUEVAS MÉTRICAS CIENTÍFICAS
  precisionMetrics?: ValidationMetrics;
  performanceMetrics?: PerformanceMetrics;
  scientificValidation?: {
    isWithinTargets: boolean;
    angularAccuracy: number;
    correlationCoefficient: number;
  };
  biomechanicalAnalysis?: {
    movementStability: number;
    temporalConsistency: number;
    asymmetryScore: number;
  };
}

// ✅ CONFIGURACIÓN AVANZADA DE THRESHOLD
export interface AdvancedAngleThreshold {
  min: number;
  max: number;
  ideal: number;
  critical?: number;          // Umbral crítico para alertas
  warning?: number;           // Umbral de advertencia
  optimalRange?: {            // Rango óptimo para bonus
    lower: number;
    upper: number;
  };
}

// ✅ CONFIGURACIÓN CIENTÍFICA DE EJERCICIOS
export interface ScientificExerciseConfiguration extends ExerciseConfiguration {
  angleThresholds: { [key: string]: AdvancedAngleThreshold };
  biomechanicalValidation: {
    targetAccuracy: number;    // Precisión objetivo en grados
    minimumCorrelation: number; // Correlación mínima con datos de referencia
    stabilityThreshold: number; // Umbral de estabilidad requerido
  };
  riskAssessment: {
    lowRiskThresholds: { [key: string]: number };
    highRiskIndicators: string[];
    preventiveRecommendations: string[];
  };
}

// ✅ DATOS DE REFERENCIA PARA VALIDACIÓN
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
    elbowAngle?: number;
    ankleAngle?: number;
  };
  validationSource: 'laboratory' | 'expert' | 'motion_capture';
  subjectData?: {
    age: number;
    gender: 'male' | 'female' | 'other';
    fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
    anthropometrics?: {
      height: number;
      weight: number;
      limbLengths?: { [key: string]: number };
    };
  };
}