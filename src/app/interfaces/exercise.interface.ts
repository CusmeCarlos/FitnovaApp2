// src/app/interfaces/exercise.interface.ts
// 🎯 INTERFACES PARA SISTEMA DE EJERCICIOS CENTRALIZADO

import { ExerciseType } from '../shared/models/pose.models';

/**
 * Ejercicio en la base de datos centralizada
 */
export interface Exercise {
  id: string;
  name: string; // Nombre técnico
  displayName: string; // Nombre para mostrar
  category: ExerciseCategory;
  targetMuscles: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  // Detección de postura
  hasPoseDetection: boolean;
  detectionType?: ExerciseType; // SQUATS, DEADLIFTS, LUNGES, BARBELL_ROW

  // Contraindicaciones médicas
  contraindications: string[];
  modifications: { [key: string]: string };

  // Metadata
  description: string;
  instructions?: string[];
  videoUrl?: string;
  imageUrl?: string;

  // Estado
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Categorías de ejercicios
 */
export enum ExerciseCategory {
  STRENGTH = 'strength',
  CARDIO = 'cardio',
  FLEXIBILITY = 'flexibility',
  CORRECTIVE = 'corrective',
  BALANCE = 'balance',
  WARM_UP = 'warm_up',
  COOL_DOWN = 'cool_down'
}

/**
 * Ejercicio en una rutina generada
 */
export interface RoutineExercise {
  exerciseId: string; // Referencia al ejercicio en la BD
  name: string;
  category: string;
  sets: number;
  reps: string;
  duration: number;
  restTime: number;
  instructions: string;
  modifications?: string;
  targetMuscles: string[];
  order: number;

  // Para ejercicios con detección
  hasPoseDetection?: boolean;
  detectionType?: ExerciseType;
}

/**
 * Mapeo entre nombres de GPT y ejercicios del sistema
 */
export interface ExerciseMapping {
  gptName: string; // Nombre que GPT podría generar
  exerciseId: string; // ID del ejercicio en la BD
  confidence: number; // 0-1, qué tan bueno es este mapeo
  aliases: string[]; // Otros nombres posibles
}

/**
 * Resultado de búsqueda de ejercicio
 */
export interface ExerciseSearchResult {
  exercise: Exercise;
  matchScore: number;
  matchedBy: 'exact' | 'alias' | 'fuzzy';
}

/**
 * Filtros para búsqueda de ejercicios
 */
export interface ExerciseFilters {
  category?: ExerciseCategory;
  difficulty?: ('beginner' | 'intermediate' | 'advanced')[];
  hasPoseDetection?: boolean;
  equipment?: string[];
  excludeContraindications?: string[];
  targetMuscles?: string[];
}

/**
 * Estadísticas de uso de ejercicios
 */
export interface ExerciseUsageStats {
  exerciseId: string;
  timesUsed: number;
  timesCompleted: number;
  averageRating: number;
  lastUsed: Date;
}
