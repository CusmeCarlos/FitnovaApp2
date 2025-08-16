// src/app/interfaces/profile.interface.ts
// ✅ EXPANDIDA - HISTORIAL MÉDICO COMPLETO SEGÚN DOCUMENTO

export interface PersonalInfo {
  // ✅ DATOS PERSONALES BÁSICOS
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number; // kg
  height?: number; // cm
  
  // ✅ DATOS ADICIONALES
  dateOfBirth?: Date;
  phoneNumber?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // ✅ INFORMACIÓN FÍSICA
  bodyMassIndex?: number; // Calculado automáticamente
  bodyFatPercentage?: number;
  muscleMassPercentage?: number;
}

export interface MedicalHistory {
  // ✅ CONDICIONES MÉDICAS ACTUALES
  currentConditions?: string[];
  chronicDiseases?: string[];
  allergies?: string[];
  medications?: string[];
  
  // ✅ HISTORIAL DE LESIONES
  previousInjuries?: {
    type: string;
    date: Date;
    affectedArea: string;
    severity: 'mild' | 'moderate' | 'severe';
    recovered: boolean;
    notes?: string;
  }[];
  
  // ✅ LIMITACIONES FÍSICAS ACTUALES
  physicalLimitations?: {
    type: string;
    description: string;
    affectedMovements: string[];
    severity: 'mild' | 'moderate' | 'severe';
  }[];
  
  // ✅ EVALUACIONES MÉDICAS
  lastMedicalCheckup?: Date;
  doctorClearance?: boolean;
  doctorNotes?: string;
  
  // ✅ HISTORIAL CARDIOVASCULAR
  heartConditions?: string[];
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    date: Date;
  };
  restingHeartRate?: number;
  
  // ✅ OTROS
  surgeries?: {
    type: string;
    date: Date;
    notes?: string;
  }[];
  
  lastUpdated?: Date;
}

export interface FitnessGoals {
  // ✅ OBJETIVOS PRINCIPALES
  primaryGoals: ('weight_loss' | 'muscle_gain' | 'strength' | 'endurance' | 'flexibility' | 'general_fitness')[];
  
  // ✅ OBJETIVOS ESPECÍFICOS
  targetWeight?: number;
  targetBodyFat?: number;
  targetMuscle?: number;
  
  // ✅ OBJETIVOS DE RENDIMIENTO
  strengthGoals?: {
    exercise: string;
    currentMax: number;
    targetMax: number;
    unit: 'kg' | 'lbs' | 'reps';
  }[];
  
  // ✅ PLAZOS
  shortTermGoals?: string[]; // 1-3 meses
  mediumTermGoals?: string[]; // 3-6 meses
  longTermGoals?: string[]; // 6+ meses
  
  // ✅ MOTIVACIÓN
  motivationFactors?: string[];
  rewardSystem?: string[];
  
  // ✅ PREFERENCIAS DE ENTRENAMIENTO
  preferredWorkoutTypes?: ('strength' | 'cardio' | 'flexibility' | 'sports' | 'group_classes')[];
  preferredWorkoutDuration?: number; // minutos
  preferredWorkoutFrequency?: number; // días por semana
  
  createdAt?: Date;
  lastUpdated?: Date;
}

export interface FitnessLevel {
  // ✅ NIVEL GENERAL
  overallLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  
  // ✅ EXPERIENCIA POR CATEGORÍA
  strengthTraining?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  cardioTraining?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  flexibilityTraining?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  sportsExperience?: 'none' | 'beginner' | 'intermediate' | 'advanced';
  
  // ✅ EXPERIENCIA TEMPORAL
  yearsOfTraining?: number;
  monthsOfTraining?: number;
  previousGymExperience?: boolean;
  
  // ✅ DEPORTES PRACTICADOS
  sportsPracticed?: {
    sport: string;
    level: 'recreational' | 'competitive' | 'professional';
    yearsOfPractice: number;
    stillPracticing: boolean;
  }[];
  
  // ✅ EVALUACIONES INICIALES
  initialFitnessAssessment?: {
    date: Date;
    assessedBy: string; // ID del entrenador
    cardiovascularScore: number; // 1-10
    strengthScore: number; // 1-10
    flexibilityScore: number; // 1-10
    balanceScore: number; // 1-10
    overallScore: number; // 1-10
    notes: string;
  };
  
  lastUpdated?: Date;
}

export interface TrainingPreferences {
  // ✅ DISPONIBILIDAD
  availableDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  preferredTimeSlots?: ('early_morning' | 'morning' | 'afternoon' | 'evening' | 'late_evening')[];
  maxSessionDuration?: number; // minutos
  
  // ✅ PREFERENCIAS DE EJERCICIO
  likedExercises?: string[];
  dislikedExercises?: string[];
  exercisesToAvoid?: string[]; // Por lesiones o limitaciones
  
  // ✅ ENTORNO DE ENTRENAMIENTO
  preferredEnvironment?: ('home' | 'gym' | 'outdoor' | 'online')[];
  availableEquipment?: string[];
  spaceConstraints?: string;
  
  // ✅ ESTILO DE ENTRENAMIENTO
  preferredIntensity?: 'low' | 'moderate' | 'high' | 'variable';
  preferredMusicGenre?: string[];
  needsMotivation?: boolean;
  prefersGroupWorkouts?: boolean;
  
  // ✅ RETROALIMENTACIÓN
  feedbackPreferences?: {
    audioFeedback: boolean;
    visualFeedback: boolean;
    hapticFeedback: boolean;
    realTimeCorrections: boolean;
    postWorkoutAnalysis: boolean;
  };
  
  lastUpdated?: Date;
}

export interface Profile {
  uid: string;
  
  // ✅ INFORMACIÓN EXPANDIDA
  personalInfo: PersonalInfo;
  medicalHistory: MedicalHistory;
  fitnessGoals?: FitnessGoals;
  fitnessLevel: FitnessLevel | 'beginner' | 'intermediate' | 'advanced'; // Retrocompatibilidad
  trainingPreferences?: TrainingPreferences;
  
  // ✅ ASIGNACIONES DEL ENTRENADOR
  assignedTrainer?: string; // UID del entrenador
  trainerNotes?: string;
  lastTrainerReview?: Date;
  
  // ✅ ESTADO DEL PERFIL
  profileComplete: boolean;
  profileCompletionPercentage?: number;
  sectionsCompleted?: {
    personalInfo: boolean;
    medicalHistory: boolean;
    fitnessGoals: boolean;
    fitnessLevel: boolean;
    trainingPreferences: boolean;
  };
  
  // ✅ CONFIGURACIONES DE LA APP
  appSettings?: {
    audioEnabled: boolean;
    autoDetectionEnabled: boolean;
    pushNotificationsEnabled: boolean;
    dataShareWithTrainer: boolean;
    privacyLevel: 'public' | 'trainer_only' | 'private';
  };
  
  // ✅ METADATOS
  createdAt?: Date;
  lastUpdated?: Date;
  profileVersion?: number; // Para futuras migraciones
}

// ✅ TIPOS AUXILIARES PARA FACILITAR EL USO
export type FitnessLevelString = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type PrimaryGoal = 'weight_loss' | 'muscle_gain' | 'strength' | 'endurance' | 'flexibility' | 'general_fitness';
export type WorkoutType = 'strength' | 'cardio' | 'flexibility' | 'sports' | 'group_classes';

// ✅ INTERFAZ PARA CREACIÓN DE PERFIL INICIAL
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

// ✅ INTERFAZ PARA ACTUALIZACIONES PARCIALES
export interface ProfileUpdate extends Partial<Omit<Profile, 'uid' | 'createdAt'>> {
  lastUpdated: Date;
}