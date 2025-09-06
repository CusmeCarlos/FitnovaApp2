// src/app/interfaces/profile.interface.ts
// ✅ INTERFAZ COMPLETA EXPANDIDA PARA RUTINAS ADAPTATIVAS IA

export interface PersonalInfo {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number; // kg
  height?: number; // cm
  dateOfBirth?: Date;
  phoneNumber?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  bodyMassIndex?: number;
  bodyFatPercentage?: number;
  muscleMassPercentage?: number;
}

// ✅ HISTORIAL MÉDICO EXPANDIDO PARA IA
export interface MedicalHistory {
  // Campos originales (mantener compatibilidad)
  injuries?: string[];
  conditions?: string[];
  limitations?: string[];
  
  // Campos expandidos existentes
  currentConditions?: string[];
  chronicDiseases?: string[];
  allergies?: string[];
  medications?: string[];
  heartConditions?: string[];
  lastMedicalCheckup?: Date;
  doctorClearance?: boolean;
  doctorNotes?: string;
  
  // ✅ NUEVOS CAMPOS CRÍTICOS PARA IA
  currentInjuries?: string; // Descripción libre de lesiones actuales
  painfulAreas?: string[]; // Áreas del cuerpo con dolor
  forbiddenExercises?: string; // Ejercicios prohibidos por médico
  movementLimitations?: string; // Limitaciones de movimiento específicas
  exercisesToAvoid?: string; // Ejercicios que debe evitar
  
  // ✅ CAPACIDAD FÍSICA ACTUAL (CRÍTICO PARA IA)
  physicalCapacity?: {
    walkingCapacity: 'less_5min' | '5_15min' | '15_30min' | '30_60min' | 'more_60min';
    stairsCapacity: 'no_difficulty' | 'mild_difficulty' | 'moderate_difficulty' | 'high_difficulty' | 'cannot';
    weightExperience: 'never' | 'few_times' | 'some_experience' | 'experienced' | 'very_experienced';
    maxComfortableWeight?: number; // kg
    energyLevel: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  };
  
  // ✅ INDICADORES PARA IA
  aiReadiness?: number; // Porcentaje de preparación para IA (0-100)
  readyForAI?: boolean; // Si está listo para generar rutinas con IA
  lastUpdated?: Date;
}

export interface FitnessGoals {
  primaryGoals: ('weight_loss' | 'muscle_gain' | 'strength' | 'endurance' | 'flexibility' | 'general_fitness')[];
  targetWeight?: number;
  targetBodyFat?: number;
  targetMuscle?: number;
  strengthGoals?: {
    exercise: string;
    currentMax: number;
    targetMax: number;
    unit: 'kg' | 'lbs' | 'reps';
  }[];
  shortTermGoals?: string[];
  mediumTermGoals?: string[];
  longTermGoals?: string[];
  motivationFactors?: string[];
  rewardSystem?: string[];
  preferredWorkoutTypes?: ('strength' | 'cardio' | 'flexibility' | 'sports' | 'group_classes')[];
  preferredWorkoutDuration?: number;
  preferredWorkoutFrequency?: number;
  createdAt?: Date;
  lastUpdated?: Date;
}

export interface FitnessLevel {
  overallLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  strengthTraining?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  cardioTraining?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  flexibilityTraining?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  sportsExperience?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  yearsOfTraining?: number;
  monthsOfTraining?: number;
  previousGymExperience?: boolean;
  sportsPracticed?: {
    sport: string;
    level: 'recreational' | 'competitive' | 'professional';
    yearsOfPractice: number;
    stillPracticing: boolean;
  }[];
  initialFitnessAssessment?: {
    date: Date;
    assessedBy: string;
    cardiovascularScore: number;
    strengthScore: number;
    flexibilityScore: number;
    balanceScore: number;
    overallScore: number;
    notes: string;
  };
  lastUpdated?: Date;
}

export interface TrainingPreferences {
  availableDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  preferredTimeSlots?: ('early_morning' | 'morning' | 'afternoon' | 'evening' | 'late_evening')[];
  maxSessionDuration?: number;
  likedExercises?: string[];
  dislikedExercises?: string[];
  exercisesToAvoid?: string[];
  preferredEnvironment?: ('home' | 'gym' | 'outdoor' | 'online')[];
  availableEquipment?: string[];
  spaceConstraints?: string;
  preferredIntensity?: 'low' | 'moderate' | 'high' | 'variable';
  preferredMusicGenre?: string[];
  needsMotivation?: boolean;
  prefersGroupWorkouts?: boolean;
  feedbackPreferences?: {
    audioFeedback: boolean;
    visualFeedback: boolean;
    hapticFeedback: boolean;
    realTimeCorrections: boolean;
    postWorkoutAnalysis: boolean;
  };
  lastUpdated?: Date;
}

// ✅ NUEVA INTERFAZ: RUTINA GENERADA POR IA
export interface AIGeneratedRoutine {
  id: string;
  userId: string;
  generatedAt: Date;
  
  // Datos usados para generar la rutina
  baseProfile: {
    fitnessLevel: string;
    primaryGoals: string[];
    medicalLimitations: string[];
    physicalCapacity: any;
  };
  
  // Rutina generada
  routine: {
    name: string;
    description: string;
    duration: number; // minutos
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom';
    exercises: AIExercise[];
    estimatedCalories: number;
    focusAreas: string[];
    adaptations: string[]; // Adaptaciones hechas por limitaciones médicas
  };
  
  // Estado de aprobación
  status: 'pending_approval' | 'approved' | 'rejected' | 'needs_modification';
  trainerNotes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  
  // Métricas de generación
  aiConfidence: number; // 0-100
  generationTime: number; // ms
  adaptationLevel: 'none' | 'minimal' | 'moderate' | 'extensive';
  
  lastUpdated: Date;
}

export interface AIExercise {
  id: string;
  name: string;
  description: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'balance' | 'recovery';
  targetMuscles: string[];
  equipment: string[];
  
  // Parámetros del ejercicio
  sets?: number;
  reps?: number | string; // "10-12" o "30 segundos"
  duration?: number; // segundos
  restTime?: number; // segundos
  weight?: number | string; // kg o "bodyweight"
  
  // Adaptaciones por limitaciones
  modifications?: string[];
  alternatives?: string[];
  contraindications?: string[];
  
  // Progresión automática
  progression?: {
    beginner: any;
    intermediate: any;
    advanced: any;
  };
  
  // Datos para MediaPipe
  poseKeyPoints?: number[]; // Puntos clave a monitorear
  criticalAngles?: {
    joint: string;
    minAngle: number;
    maxAngle: number;
    warningThreshold: number;
  }[];
}

// ✅ INTERFAZ PRINCIPAL DEL PERFIL (EXPANDIDA)
export interface Profile {
  uid: string;
  
  // Datos básicos
  personalInfo: PersonalInfo;
  medicalHistory: MedicalHistory;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
  profileComplete: boolean;
  
  // Expandidos
  fitnessGoals?: FitnessGoals;
  trainingPreferences?: TrainingPreferences;
  
  // ✅ RUTINAS IA
  currentAIRoutine?: string; // ID de la rutina actual
  routineHistory?: string[]; // IDs de rutinas pasadas
  lastRoutineGenerated?: Date;
  routinePreferences?: {
    autoGenerate: boolean;
    preferredDuration: number;
    maxExercises: number;
    adaptationLevel: 'conservative' | 'balanced' | 'aggressive';
  };
  
  // Entrenador
  assignedTrainer?: string;
  trainerNotes?: string;
  lastTrainerReview?: Date;
  
  // Completitud
  profileCompletionPercentage?: number;
  aiReadinessPercentage?: number; // ✅ NUEVO
  sectionsCompleted?: {
    personalInfo: boolean;
    medicalHistory: boolean;
    fitnessGoals: boolean;
    fitnessLevel: boolean;
    trainingPreferences: boolean;
    aiReadiness: boolean; // ✅ NUEVO
  };
  
  // Configuración
  appSettings?: {
    audioEnabled: boolean;
    autoDetectionEnabled: boolean;
    pushNotificationsEnabled: boolean;
    dataShareWithTrainer: boolean;
    privacyLevel: 'public' | 'trainer_only' | 'private';
    aiRoutineGeneration: boolean; // ✅ NUEVO
  };
  
  // Metadatos
  createdAt?: Date;
  lastUpdated?: Date;
  profileVersion?: number;
}

// ✅ TIPOS AUXILIARES
export type FitnessLevelString = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type PrimaryGoal = 'weight_loss' | 'muscle_gain' | 'strength' | 'endurance' | 'flexibility' | 'general_fitness';
export type WorkoutType = 'strength' | 'cardio' | 'flexibility' | 'sports' | 'group_classes';
export type BodyArea = 'neck' | 'shoulders' | 'back' | 'lower_back' | 'knees' | 'ankles' | 'wrists' | 'hips';

// ✅ INTERFAZ PARA SOLICITAR RUTINA A LA IA
export interface AIRoutineRequest {
  userId: string;
  personalInfo: PersonalInfo;
  medicalHistory: MedicalHistory;
  fitnessGoals: FitnessGoals;
  fitnessLevel: string;
  trainingPreferences?: TrainingPreferences;
  currentRoutine?: any;
  specialRequests?: string;
  urgency: 'low' | 'normal' | 'high';
}

// ✅ RESPUESTA DE LA IA
export interface AIRoutineResponse {
  success: boolean;
  routineId?: string;
  routine?: AIGeneratedRoutine;
  error?: string;
  needsTrainerApproval: boolean;
  estimatedApprovalTime?: number; // horas
  confidenceScore: number; // 0-100
}

export interface InitialProfileData {
  personalInfo: {
    age: number;
    gender: 'male' | 'female' | 'other';
    weight: number;
    height: number;
  };
  medicalHistory: {
    currentConditions?: string[];
    previousInjuries?: string[];
    physicalLimitations?: string[];
  };
  fitnessLevel: FitnessLevelString;
  primaryGoals: PrimaryGoal[];
}

export interface ProfileUpdate extends Partial<Omit<Profile, 'uid' | 'createdAt'>> {
  lastUpdated: Date;
}