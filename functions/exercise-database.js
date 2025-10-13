// functions/exercise-database.js
// 🎯 FUNCIONES PARA GESTIÓN DE EJERCICIOS DESDE FIRESTORE

const {getFirestore} = require("firebase-admin/firestore");
const {logger} = require("firebase-functions/v1");

// ✅ SOLUCIÓN: No llamar getFirestore() inmediatamente
let db = null;

function getDb() {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

/**
 * Obtener ejercicios seguros desde Firestore para un perfil médico
 * REEMPLAZA getSafeExercisesForProfile hardcodeada
 */
async function getSafeExercisesForProfile(medicalHistory, fitnessLevel) {
  try {
    logger.info("🔍 Consultando ejercicios seguros desde Firestore...");

    // Obtener TODOS los ejercicios activos
    const exercisesSnapshot = await getDb().collection('exercises')
      .where('isActive', '==', true)
      .get();

    if (exercisesSnapshot.empty) {
      logger.warn("⚠️ No hay ejercicios en Firestore, usando fallback");
      return getFallbackExercises();
    }

    const allExercises = exercisesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logger.info(`✅ ${allExercises.length} ejercicios encontrados en Firestore`);

    // Filtrar por perfil médico
    const painfulAreas = medicalHistory.painfulAreas || [];
    const forbiddenExercises = medicalHistory.forbiddenExercises || '';

    const safeExercises = allExercises.filter(exercise => {
      // Filtrar por contraindicaciones médicas
      const hasContraindication = exercise.contraindications.some(contra =>
        painfulAreas.some(area => contra.includes(area))
      );

      if (hasContraindication) {
        logger.debug(`⚠️ Ejercicio ${exercise.name} excluido por contraindicación`);
        return false;
      }

      // Filtrar por ejercicios prohibidos
      const isForbidden = forbiddenExercises.toLowerCase().includes(exercise.name.toLowerCase()) ||
        forbiddenExercises.toLowerCase().includes(exercise.displayName.toLowerCase());

      if (isForbidden) {
        logger.debug(`⚠️ Ejercicio ${exercise.name} excluido por prohibición médica`);
        return false;
      }

      // Filtrar por nivel de dificultad apropiado
      const appropriateDifficulty = isAppropriateForLevel(exercise.difficulty, fitnessLevel);

      if (!appropriateDifficulty) {
        logger.debug(`⚠️ Ejercicio ${exercise.name} excluido por nivel de dificultad`);
        return false;
      }

      return true;
    });

    logger.info(`✅ ${safeExercises.length} ejercicios seguros filtrados para el usuario`);
    return safeExercises;

  } catch (error) {
    logger.error("❌ Error consultando ejercicios desde Firestore:", error);
    return getFallbackExercises();
  }
}

/**
 * Obtener ejercicios específicos para objetivos fitness
 */
async function getExercisesForGoals(primaryGoals, fitnessLevel) {
  try {
    const exercisesSnapshot = await getDb().collection('exercises')
      .where('isActive', '==', true)
      .get();

    if (exercisesSnapshot.empty) {
      return [];
    }

    const allExercises = exercisesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Mapeo de objetivos a categorías
    const goalToCategoryMap = {
      'weight_loss': ['cardio', 'strength'],
      'muscle_gain': ['strength'],
      'strength': ['strength'],
      'endurance': ['cardio'],
      'flexibility': ['flexibility'],
      'general_fitness': ['strength', 'cardio', 'flexibility', 'balance']
    };

    // Obtener categorías relevantes para los objetivos
    let relevantCategories = [];
    primaryGoals.forEach(goal => {
      if (goalToCategoryMap[goal]) {
        relevantCategories.push(...goalToCategoryMap[goal]);
      }
    });

    relevantCategories = [...new Set(relevantCategories)];

    // Filtrar ejercicios por categorías relevantes y nivel
    const goalSpecificExercises = allExercises.filter(exercise =>
      relevantCategories.includes(exercise.category) &&
      isAppropriateForLevel(exercise.difficulty, fitnessLevel)
    );

    logger.info(`✅ ${goalSpecificExercises.length} ejercicios encontrados para objetivos: ${primaryGoals.join(', ')}`);
    return goalSpecificExercises;

  } catch (error) {
    logger.error("❌ Error obteniendo ejercicios por objetivos:", error);
    return [];
  }
}

/**
 * Obtener ejercicios correctivos para errores posturales comunes
 */
async function getCorrectiveExercises(commonErrors, priorityAreas) {
  try {
    const exercisesSnapshot = await getDb().collection('exercises')
      .where('category', '==', 'corrective')
      .where('isActive', '==', true)
      .get();

    if (exercisesSnapshot.empty) {
      return [];
    }

    const correctiveExercises = exercisesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logger.info(`✅ ${correctiveExercises.length} ejercicios correctivos encontrados`);
    return correctiveExercises.slice(0, 3); // Limitar a 3 ejercicios correctivos

  } catch (error) {
    logger.error("❌ Error obteniendo ejercicios correctivos:", error);
    return [];
  }
}

/**
 * Generar lista de ejercicios para enviar a GPT
 */
async function getExerciseListForGPT() {
  try {
    const exercisesSnapshot = await getDb().collection('exercises')
      .where('isActive', '==', true)
      .get();

    if (exercisesSnapshot.empty) {
      return "No hay ejercicios disponibles en el sistema.";
    }

    const exercises = exercisesSnapshot.docs.map(doc => {
      const data = doc.data();
      const detection = data.hasPoseDetection ? '✅ Con detección de postura' : '⚪ Sin detección';
      return `- ${data.displayName} (${data.category}, ${data.difficulty}) ${detection}`;
    });

    const exerciseList = `EJERCICIOS DISPONIBLES EN EL SISTEMA:\n${exercises.join('\n')}`;
    logger.info(`✅ Lista de ${exercises.length} ejercicios generada para GPT`);
    return exerciseList;

  } catch (error) {
    logger.error("❌ Error generando lista para GPT:", error);
    return "Error obteniendo ejercicios del sistema.";
  }
}

/**
 * Mapear nombre de ejercicio de GPT a ejercicio del sistema
 */
async function mapGPTExerciseToSystem(gptExerciseName) {
  try {
    const exercisesSnapshot = await getDb().collection('exercises')
      .where('isActive', '==', true)
      .get();

    if (exercisesSnapshot.empty) {
      logger.warn("⚠️ No hay ejercicios en Firestore para mapear");
      return null;
    }

    const allExercises = exercisesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const searchTerm = gptExerciseName.toLowerCase().trim();

    // 1. Búsqueda exacta
    let match = allExercises.find(ex =>
      ex.name.toLowerCase() === searchTerm ||
      ex.displayName.toLowerCase() === searchTerm
    );

    if (match) {
      logger.info(`✅ Mapeo exacto: "${gptExerciseName}" → "${match.displayName}"`);
      return match;
    }

    // 2. Búsqueda parcial
    match = allExercises.find(ex =>
      ex.name.toLowerCase().includes(searchTerm) ||
      ex.displayName.toLowerCase().includes(searchTerm) ||
      searchTerm.includes(ex.name.toLowerCase()) ||
      searchTerm.includes(ex.displayName.toLowerCase())
    );

    if (match) {
      logger.info(`✅ Mapeo parcial: "${gptExerciseName}" → "${match.displayName}"`);
      return match;
    }

    // 3. Búsqueda por palabras clave
    const searchWords = searchTerm.split(' ');
    match = allExercises.find(ex => {
      const exerciseWords = (ex.name + ' ' + ex.displayName).toLowerCase().split(' ');
      const matchingWords = searchWords.filter(word =>
        exerciseWords.some(ew => ew.includes(word) || word.includes(ew))
      );
      return matchingWords.length >= Math.ceil(searchWords.length / 2);
    });

    if (match) {
      logger.info(`✅ Mapeo por palabras clave: "${gptExerciseName}" → "${match.displayName}"`);
      return match;
    }

    logger.warn(`⚠️ No se encontró mapeo para: "${gptExerciseName}"`);
    return null;

  } catch (error) {
    logger.error("❌ Error mapeando ejercicio:", error);
    return null;
  }
}

/**
 * Validar y enriquecer rutina de GPT con datos de Firestore
 */
async function validateAndEnhanceGPTRoutineFromDB(gptRoutine, medicalHistory) {
  try {
    logger.info("🔍 Validando rutina GPT contra base de datos...");

    const validatedExercises = [];

    for (const gptExercise of gptRoutine.exercises) {
      // Intentar mapear cada ejercicio de GPT a un ejercicio del sistema
      const systemExercise = await mapGPTExerciseToSystem(gptExercise.name);

      if (systemExercise) {
        // Ejercicio válido, enriquecer con datos de Firestore
        validatedExercises.push({
          ...gptExercise,
          exerciseId: systemExercise.id,
          hasPoseDetection: systemExercise.hasPoseDetection,
          detectionType: systemExercise.detectionType,
          targetMuscles: systemExercise.targetMuscles,
          equipment: systemExercise.equipment,
          modifications: gptExercise.modifications || systemExercise.modifications
        });
      } else {
        logger.warn(`⚠️ Ejercicio "${gptExercise.name}" no encontrado en BD, será excluido`);
      }
    }

    // Si quedan muy pocos ejercicios, agregar ejercicios seguros básicos
    if (validatedExercises.length < 3) {
      logger.warn("⚠️ Muy pocos ejercicios validados, agregando ejercicios seguros...");

      const safeExercises = await getSafeExercisesForProfile(medicalHistory, 'beginner');
      const additionalExercises = safeExercises.slice(0, 5 - validatedExercises.length);

      additionalExercises.forEach((exercise, index) => {
        validatedExercises.push({
          id: exercise.id,
          exerciseId: exercise.id,
          name: exercise.displayName,
          category: exercise.category,
          sets: 2,
          reps: "10-12",
          duration: 180,
          restTime: 60,
          instructions: `Realizar ${exercise.displayName} de forma controlada`,
          modifications: exercise.modifications,
          targetMuscles: exercise.targetMuscles,
          hasPoseDetection: exercise.hasPoseDetection,
          detectionType: exercise.detectionType,
          order: validatedExercises.length + index + 1
        });
      });
    }

    logger.info(`✅ Rutina validada: ${validatedExercises.length} ejercicios confirmados`);

    return {
      exercises: validatedExercises,
      adaptations: gptRoutine.adaptations || [],
      focusAreas: gptRoutine.focusAreas || ['Entrenamiento General'],
      gptGenerated: true,
      gptInstructions: gptRoutine.specialInstructions || [],
      totalDuration: gptRoutine.totalDuration || calculateTotalDuration(validatedExercises),
      difficultyRating: gptRoutine.difficultyRating || 2
    };

  } catch (error) {
    logger.error("❌ Error validando rutina GPT:", error);
    throw error;
  }
}

// ===== FUNCIONES AUXILIARES =====

function isAppropriateForLevel(exerciseDifficulty, userLevel) {
  const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
  const exerciseIndex = difficultyOrder.indexOf(exerciseDifficulty);
  const userIndex = difficultyOrder.indexOf(userLevel);

  return exerciseIndex <= userIndex;
}

function calculateTotalDuration(exercises) {
  return exercises.reduce((total, exercise) => total + (exercise.duration || 0), 0);
}

/**
 * Ejercicios de fallback en caso de que Firestore falle
 */
function getFallbackExercises() {
  logger.warn("⚠️ Usando ejercicios hardcodeados como fallback");

  return [
    {
      id: 'squat_basic',
      name: 'squat_basic',
      displayName: 'Sentadilla Básica',
      category: 'strength',
      targetMuscles: ['quadriceps', 'glutes', 'hamstrings'],
      equipment: ['bodyweight'],
      contraindications: ['knee_injury', 'hip_injury', 'back_injury'],
      modifications: {
        'knee_pain': 'Reducir profundidad',
        'back_pain': 'Usar pared de apoyo'
      },
      difficulty: 'beginner',
      hasPoseDetection: true,
      detectionType: 'SQUATS',
      isActive: true
    },
    {
      id: 'walking_cardio',
      name: 'walking_cardio',
      displayName: 'Caminata Activa',
      category: 'cardio',
      targetMuscles: ['legs', 'cardiovascular'],
      equipment: ['none'],
      contraindications: [],
      modifications: {
        'low_mobility': 'Caminata lenta'
      },
      difficulty: 'beginner',
      hasPoseDetection: false,
      isActive: true
    }
  ];
}

module.exports = {
  getSafeExercisesForProfile,
  getExercisesForGoals,
  getCorrectiveExercises,
  getExerciseListForGPT,
  mapGPTExerciseToSystem,
  validateAndEnhanceGPTRoutineFromDB
};