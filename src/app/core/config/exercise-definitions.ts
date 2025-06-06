
// src/app/core/config/exercise-definitions.ts
// Configuraciones científicas de ejercicios basadas en biomecánica

import { 
  ExerciseConfiguration, 
  ExerciseType, 
  PostureErrorType 
} from '../../shared/models/pose.models';

export const EXERCISE_DEFINITIONS: { [key in ExerciseType]: ExerciseConfiguration } = {
  
  // 🦵 SENTADILLAS
  [ExerciseType.SQUATS]: {
    type: ExerciseType.SQUATS,
    name: 'Squats',
    spanish_name: 'Sentadillas',
    difficulty: 'beginner',
    keyJoints: ['left_knee', 'right_knee', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
    angleThresholds: {
      knee_angle: { min: 80, max: 170, ideal: 90 },
      hip_angle: { min: 45, max: 180, ideal: 90 },
      spine_angle: { min: 75, max: 90, ideal: 85 }
    },
    errorDetectionRules: [
      {
        errorType: PostureErrorType.KNEE_VALGUS,
        condition: 'knee_distance < hip_distance * 0.7',
        threshold: 0.7,
        message: 'Rodillas colapsando hacia adentro',
        recommendation: 'Empuja las rodillas hacia afuera, siguiendo la línea de los pies',
        severity: 8
      },
      {
        errorType: PostureErrorType.FORWARD_LEAN,
        condition: 'spine_angle < 75',
        threshold: 75,
        message: 'Inclinación excesiva del torso',
        recommendation: 'Mantén el pecho erguido y la mirada al frente',
        severity: 6
      },
      {
        errorType: PostureErrorType.HEEL_RISE,
        condition: 'heel_rise > 0.05',
        threshold: 0.05,
        message: 'Levantando los talones',
        recommendation: 'Mantén todo el pie en contacto con el suelo',
        severity: 7
      },
      {
        errorType: PostureErrorType.SHALLOW_DEPTH,
        condition: 'knee_angle > 120 at bottom',
        threshold: 120,
        message: 'Profundidad insuficiente',
        recommendation: 'Baja hasta que tus muslos estén paralelos al suelo',
        severity: 5
      }
    ],
    biomechanicalFocus: 'Flexión y extensión de cadera y rodilla con mantenimiento de la alineación vertebral',
    description: 'Ejercicio fundamental de fortalecimiento del tren inferior'
  },

  // 💪 FLEXIONES
  [ExerciseType.PUSHUPS]: {
    type: ExerciseType.PUSHUPS,
    name: 'Push-ups',
    spanish_name: 'Flexiones',
    difficulty: 'intermediate',
    keyJoints: ['left_elbow', 'right_elbow', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
    angleThresholds: {
      elbow_angle: { min: 70, max: 180, ideal: 90 },
      hip_angle: { min: 160, max: 180, ideal: 175 },
      spine_angle: { min: 85, max: 90, ideal: 88 }
    },
    errorDetectionRules: [
      {
        errorType: PostureErrorType.SAGGING_HIPS,
        condition: 'hip_angle < 160',
        threshold: 160,
        message: 'Caderas muy bajas (banana)',
        recommendation: 'Activa el core y mantén una línea recta',
        severity: 7
      },
      {
        errorType: PostureErrorType.RAISED_HIPS,
        condition: 'hip_angle > 185',
        threshold: 185,
        message: 'Caderas muy altas (pico)',
        recommendation: 'Baja las caderas para formar una línea recta',
        severity: 6
      }
    ],
    biomechanicalFocus: 'Flexión y extensión de codo con estabilización del core',
    description: 'Ejercicio de empuje que fortalece pectorales, tríceps y deltoides'
  },

  // Agregar definiciones básicas para los otros ejercicios
  [ExerciseType.LUNGES]: {
    type: ExerciseType.LUNGES,
    name: 'Lunges',
    spanish_name: 'Estocadas',
    difficulty: 'intermediate',
    keyJoints: ['left_knee', 'right_knee', 'left_hip', 'right_hip'],
    angleThresholds: { knee_angle: { min: 80, max: 100, ideal: 90 } },
    errorDetectionRules: [],
    biomechanicalFocus: 'Flexión unilateral de cadera y rodilla',
    description: 'Ejercicio unilateral para fuerza y equilibrio'
  },

  [ExerciseType.PLANK]: {
    type: ExerciseType.PLANK,
    name: 'Plank',
    spanish_name: 'Plancha',
    difficulty: 'beginner',
    keyJoints: ['left_elbow', 'right_elbow', 'left_hip', 'right_hip'],
    angleThresholds: { hip_angle: { min: 170, max: 185, ideal: 180 } },
    errorDetectionRules: [],
    biomechanicalFocus: 'Isometría de core',
    description: 'Ejercicio isométrico para el core'
  },

  [ExerciseType.BICEP_CURLS]: {
    type: ExerciseType.BICEP_CURLS,
    name: 'Bicep Curls',
    spanish_name: 'Curl de Bíceps',
    difficulty: 'beginner',
    keyJoints: ['left_elbow', 'right_elbow'],
    angleThresholds: { elbow_angle: { min: 30, max: 170, ideal: 40 } },
    errorDetectionRules: [],
    biomechanicalFocus: 'Flexión de codo',
    description: 'Ejercicio de aislamiento para bíceps'
  },

  [ExerciseType.DEADLIFT]: {
    type: ExerciseType.DEADLIFT,
    name: 'Deadlift',
    spanish_name: 'Peso Muerto',
    difficulty: 'advanced',
    keyJoints: ['left_knee', 'right_knee', 'left_hip', 'right_hip'],
    angleThresholds: { hip_angle: { min: 45, max: 180, ideal: 90 } },
    errorDetectionRules: [],
    biomechanicalFocus: 'Extensión de cadera',
    description: 'Ejercicio compuesto para cadena posterior'
  },

  [ExerciseType.BENCH_PRESS]: {
    type: ExerciseType.BENCH_PRESS,
    name: 'Bench Press',
    spanish_name: 'Press de Banca',
    difficulty: 'intermediate',
    keyJoints: ['left_elbow', 'right_elbow'],
    angleThresholds: { elbow_angle: { min: 70, max: 180, ideal: 90 } },
    errorDetectionRules: [],
    biomechanicalFocus: 'Empuje horizontal',
    description: 'Ejercicio compuesto de empuje'
  },

  [ExerciseType.SHOULDER_PRESS]: {
    type: ExerciseType.SHOULDER_PRESS,
    name: 'Shoulder Press',
    spanish_name: 'Press de Hombros',
    difficulty: 'intermediate',
    keyJoints: ['left_elbow', 'right_elbow'],
    angleThresholds: { elbow_angle: { min: 70, max: 180, ideal: 90 } },
    errorDetectionRules: [],
    biomechanicalFocus: 'Empuje vertical',
    description: 'Ejercicio de empuje vertical'
  }
};