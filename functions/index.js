// functions/index.js
// 🔥 CLOUD FUNCTIONS PARA FITNOVA - VERSIÓN DEFINITIVA CON OPENAI GPT

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v1");
const {setGlobalOptions} = require("firebase-functions/v2");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const {OpenAI} = require("openai");
const apiKey = process.env.OPENAI_API_KEY;
const functions = require("firebase-functions");


// ✅ CONFIGURAR OPCIONES GLOBALES PARA V2
setGlobalOptions({
  maxInstances: 10,
  timeoutSeconds: 300,
  memory: "512MiB"
});

// ✅ INICIALIZAR FIREBASE ADMIN
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ✅ INICIALIZAR OPENAI CON MANEJO DE ERRORES
let openai = null;
try {
  const apiKey = process.env.OPENAI_API_KEY || functions.config().openai?.key;
  
  if (!apiKey) {
    logger.warn("⚠️ OPENAI_API_KEY no encontrada en variables de entorno");
  } else {
    openai = new OpenAI({
      apiKey: apiKey,
    });
    logger.info("✅ OpenAI inicializado correctamente");
  }
} catch (error) {
  logger.error("❌ Error inicializando OpenAI:", error);
  openai = null;
}

// 🔔 FUNCIÓN PRINCIPAL - ENVIAR NOTIFICACIÓN AL ENTRENADOR
exports.sendTrainerNotification = onCall(async (request) => {
  try {
    const {data} = request;
    logger.info("📨 Procesando alerta crítica:", data);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    if (!data.uid || !data.errorType || !data.severity) {
      throw new HttpsError("invalid-argument", "Datos de alerta incompletos");
    }

    if (request.auth.uid !== data.uid) {
      throw new HttpsError("permission-denied", "No autorizado para enviar alertas de este usuario");
    }

    const userDoc = await db.collection("users").doc(data.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Usuario no encontrado");
    }

    const userData = userDoc.data();
    const trainerId = userData.assignedTrainer || "admin";
    let trainerData = {fcmToken: null, email: "admin@fitnova.com"};

    if (trainerId !== "admin") {
      const trainerDoc = await db.collection("trainers").doc(trainerId).get();
      if (trainerDoc.exists) {
        trainerData = trainerDoc.data();
      } else {
        logger.warn(`⚠️ Entrenador ${trainerId} no encontrado`);
      }
    }

    const fcmMessage = {
      notification: {
        title: `🚨 FitNova - Alerta ${getSeverityText(data.severity)}`,
        body: `${data.userDisplayName || "Usuario"}: ${getErrorTypeText(data.errorType)} en ${data.exercise}`,
      },
      data: {
        type: "critical_error",
        errorType: data.errorType,
        exercise: data.exercise,
        severity: data.severity,
        userId: data.uid,
        sessionId: data.sessionId || "",
        timestamp: new Date().toISOString(),
        captureURL: data.captureURL || "",
        userEmail: data.userEmail || "",
        userDisplayName: data.userDisplayName || "Usuario",
        clickAction: "/dashboard/alerts",
      }
    };

    const notificationResults = [];

    if (trainerData.fcmToken) {
      try {
        const result = await messaging.send({
          ...fcmMessage,
          token: trainerData.fcmToken,
        });
        notificationResults.push({
          type: "trainer_token",
          trainerId: trainerId,
          result: result,
          success: true,
        });
        logger.info(`✅ Notificación enviada al entrenador ${trainerId}: ${result}`);
      } catch (error) {
        logger.error(`❌ Error enviando a entrenador ${trainerId}:`, error);
        notificationResults.push({
          type: "trainer_token",
          trainerId: trainerId,
          error: error.message,
          success: false,
        });
      }
    }

    const alertRef = await db.collection("criticalAlerts").add({
      ...data,
      trainerId: trainerId,
      trainerEmail: trainerData.email,
      notificationResults,
      processedAt: new Date(),
      status: "sent",
      trainerNotified: notificationResults.some((r) => r.success),
      platform: "mobile",
    });

    await db.collection("userStats").doc(data.uid).set({
      lastCriticalError: new Date(),
      totalCriticalErrors: FieldValue.increment(1),
      lastErrorType: data.errorType,
      lastExercise: data.exercise,
      lastSessionId: data.sessionId,
    }, {merge: true});

    return {
      success: true,
      alertId: alertRef.id,
      notificationResults,
      trainerNotified: notificationResults.some((r) => r.success),
      message: "Alerta crítica procesada y entrenador notificado",
    };
  } catch (error) {
    logger.error("🛑 Error procesando alerta crítica:", error);
    throw new HttpsError("internal", "Error procesando alerta: " + error.message);
  }
});

// 📊 FUNCIÓN - PROCESAR ALERTA PARA ANÁLISIS
exports.processTrainerAlert = onCall(async (request) => {
  try {
    const {data} = request;
    logger.info("📊 Procesando alerta para análisis:", data.alertId);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    const alertDoc = await db.collection("notifications").doc(data.alertId).get();
    if (!alertDoc.exists) {
      throw new HttpsError("not-found", "Alerta no encontrada");
    }

    let biomechanicsAnalysis = null;
    if (data.biomechanicsData) {
      biomechanicsAnalysis = {
        severity: data.severity,
        confidence: data.biomechanicsData.confidence || 0,
        affectedJoints: data.biomechanicsData.affectedJoints || [],
        recommendations: generateRecommendations(data.errorType),
        riskLevel: calculateRiskLevel(data.severity, data.biomechanicsData),
        correctiveActions: generateCorrectiveActions(data.errorType),
        processedAt: new Date(),
      };
    }

    await alertDoc.ref.update({
      biomechanicsAnalysis,
      analysisProcessed: true,
      processedAt: new Date(),
    });

    return {
      success: true,
      message: "Alerta procesada para análisis",
      biomechanicsAnalysis,
      hasAnalysis: !!biomechanicsAnalysis,
    };
  } catch (error) {
    logger.error("🛑 Error procesando análisis:", error);
    throw new HttpsError("internal", "Error en análisis: " + error.message);
  }
});

// 🔄 FUNCIÓN - SINCRONIZACIÓN MÓVIL
exports.syncMobileData = onCall(async (request) => {
  try {
    const {data} = request;
    const {uid, mobileData} = data;

    if (!request.auth || request.auth.uid !== uid) {
      throw new HttpsError("permission-denied", "No autorizado");
    }

    logger.info("🔄 Sincronizando datos móvil:", uid);

    if (mobileData.sessionData) {
      await db.collection("activeSessions").doc(uid).set({
        ...mobileData.sessionData,
        lastSync: new Date(),
        platform: "mobile",
        status: "active",
      }, {merge: true});
    }

    if (mobileData.metrics) {
      await db.collection("userMetrics").doc(uid).set({
        ...mobileData.metrics,
        lastUpdate: new Date(),
        dataSource: "mobile_app",
      }, {merge: true});
    }

    if (mobileData.settings) {
      await db.collection("userSettings").doc(uid).set({
        ...mobileData.settings,
        lastSync: new Date(),
      }, {merge: true});
    }

    return {
      success: true,
      message: "Datos sincronizados correctamente",
      syncTimestamp: new Date(),
      itemsProcessed: {
        session: !!mobileData.sessionData,
        metrics: !!mobileData.metrics,
        settings: !!mobileData.settings,
      },
    };
  } catch (error) {
    logger.error("🛑 Error sincronizando datos:", error);
    throw new HttpsError("internal", "Error en sincronización: " + error.message);
  }
});

// 🧠 FUNCIÓN PRINCIPAL - GENERAR RUTINA ADAPTATIVA CON GPT
exports.generateAdaptiveRoutine = onCall(async (request) => {
  try {
    const {data} = request;
    const {userId, personalInfo, medicalHistory, fitnessGoals, fitnessLevel, trainingPreferences} = data;

    if (!request.auth || request.auth.uid !== userId) {
      throw new HttpsError("permission-denied", "No autorizado");
    }

    logger.info("🧠 Generando rutina adaptativa IA + GPT para:", userId);

    if (!personalInfo?.age || !personalInfo?.weight || !personalInfo?.height) {
      throw new HttpsError("failed-precondition", "Datos personales incompletos");
    }

    if (!medicalHistory?.physicalCapacity?.walkingCapacity || 
        !medicalHistory?.physicalCapacity?.stairsCapacity ||
        !medicalHistory?.physicalCapacity?.weightExperience ||
        !medicalHistory?.physicalCapacity?.energyLevel) {
      throw new HttpsError("failed-precondition", "Capacidad física no evaluada");
    }

    if (!fitnessGoals?.primaryGoals?.length) {
      throw new HttpsError("failed-precondition", "Objetivos fitness no definidos");
    }

    const errorsSnapshot = await db.collection("criticalAlerts")
        .where("uid", "==", userId)
        .where("severity", "in", ["high", "critical"])
        .orderBy("processedAt", "desc")
        .limit(20)
        .get();

    const recentErrors = errorsSnapshot.docs.map((doc) => doc.data());
    const errorAnalysis = analyzeUserErrors(recentErrors);
    const adaptationLevel = calculateAdaptationLevel(medicalHistory, errorAnalysis);
    
    const generatedRoutine = await generatePersonalizedRoutine({
      userId,
      personalInfo,
      medicalHistory,
      fitnessGoals,
      fitnessLevel,
      trainingPreferences,
      errorAnalysis,
      adaptationLevel
    });

    const aiConfidence = calculateAIConfidence(generatedRoutine, medicalHistory, errorAnalysis);
    const needsTrainerApproval = shouldRequireTrainerApproval(adaptationLevel, aiConfidence, medicalHistory);

    const finalRoutine = {
      id: `routine_${userId}_${Date.now()}`,
      userId: userId,
      generatedAt: new Date(),
      baseProfile: {
        fitnessLevel,
        primaryGoals: fitnessGoals.primaryGoals,
        medicalLimitations: extractMedicalLimitations(medicalHistory),
        physicalCapacity: medicalHistory.physicalCapacity
      },
      routine: {
        name: generateRoutineName(fitnessGoals.primaryGoals, fitnessLevel),
        description: generateRoutineDescription(generatedRoutine, adaptationLevel),
        duration: trainingPreferences?.maxSessionDuration || 30,
        difficulty: mapDifficultyLevel(fitnessLevel, adaptationLevel),
        exercises: generatedRoutine.exercises,
        estimatedCalories: calculateEstimatedCalories(generatedRoutine.exercises, personalInfo),
        focusAreas: generatedRoutine.focusAreas,
        adaptations: generatedRoutine.adaptations,
        gptGenerated: generatedRoutine.gptGenerated || false,
        gptInstructions: generatedRoutine.gptInstructions || []
      },
      status: needsTrainerApproval ? "pending_approval" : "approved",
      aiConfidence: aiConfidence,
      generationTime: Date.now() - request.timestamp || 0,
      adaptationLevel: adaptationLevel,
      needsTrainerApproval: needsTrainerApproval,
      lastUpdated: new Date()
    };

    const routineRef = await db.collection("aiRoutines")
        .doc(userId)
        .collection("routines")
        .add(finalRoutine);

    if (needsTrainerApproval) {
      await createTrainerNotification(userId, routineRef.id, finalRoutine, adaptationLevel);
    }

    await updateUserAIStats(userId, aiConfidence, adaptationLevel);

    logger.info("✅ Rutina IA + GPT generada exitosamente:", routineRef.id);

    return {
      success: true,
      routineId: routineRef.id,
      routine: finalRoutine,
      needsTrainerApproval: needsTrainerApproval,
      aiConfidence: aiConfidence,
      message: needsTrainerApproval ? 
        "Rutina generada con GPT, esperando aprobación del entrenador" : 
        "Rutina generada con GPT y lista para usar"
    };

  } catch (error) {
    logger.error("🛑 Error generando rutina IA + GPT:", error);
    throw new HttpsError("internal", "Error generando rutina: " + error.message);
  }
});

// 📊 FUNCIÓN - OBTENER MÉTRICAS DEL USUARIO
exports.getUserMetrics = onCall(async (request) => {
  try {
    const {data} = request;
    const {uid, timeRange} = data;

    if (!request.auth || request.auth.uid !== uid) {
      throw new HttpsError("permission-denied", "No autorizado");
    }

    const statsDoc = await db.collection("userStats").doc(uid).get();
    const userStats = statsDoc.exists ? statsDoc.data() : {};

    const alertsSnapshot = await db.collection("criticalAlerts")
        .where("uid", "==", uid)
        .orderBy("processedAt", "desc")
        .limit(50)
        .get();

    const recentAlerts = alertsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const metrics = calculateUserMetrics(userStats, recentAlerts, timeRange);

    return {
      success: true,
      metrics,
      lastUpdate: new Date(),
    };
  } catch (error) {
    logger.error("🛑 Error obteniendo métricas:", error);
    throw new HttpsError("internal", "Error obteniendo métricas: " + error.message);
  }
});

// 🔍 FUNCIÓN DE TESTING
exports.ping = onCall(async (request) => {
  logger.info("🏓 Ping recibido:", request.data);
  return {
    success: true,
    message: "Cloud Functions FitNova funcionando correctamente",
    timestamp: new Date(),
    serverTime: Date.now(),
    authUid: request.auth ? request.auth.uid : "no-auth",
  };
});

// ===== FUNCIONES AUXILIARES =====

function getSeverityText(severity) {
  const severityMap = {
    "critical": "CRÍTICO",
    "high": "ALTO", 
    "medium": "MEDIO",
    "low": "BAJO",
  };
  return severityMap[severity] || "DESCONOCIDO";
}

function getErrorTypeText(errorType) {
  const errorMap = {
    "KNEE_VALGUS": "Rodillas hacia adentro",
    "ROUNDED_BACK": "Espalda curvada",
    "INSUFFICIENT_DEPTH": "Profundidad insuficiente",
    "DROPPED_HIPS": "Caderas caídas",
    "HIGH_HIPS": "Caderas altas",
    "EXCESSIVE_ELBOW_FLARE": "Codos muy abiertos",
    "KNEE_FORWARD": "Rodilla adelantada",
    "POOR_ALIGNMENT": "Mala alineación",
    "EXCESSIVE_SPEED": "Velocidad excesiva",
  };
  return errorMap[errorType] || "Error postural";
}

function generateRecommendations(errorType) {
  const recommendationsMap = {
    "KNEE_VALGUS": [
      "Fortalecer glúteos medios",
      "Trabajo de estabilidad de cadera",
      "Ejercicios de activación antes del entrenamiento",
    ],
    "ROUNDED_BACK": [
      "Fortalecer erectores espinales", 
      "Trabajo de movilidad torácica",
      "Ejercicios de estabilización del core",
    ],
    "INSUFFICIENT_DEPTH": [
      "Trabajo de movilidad de cadera",
      "Fortalecer cuádriceps",
      "Ejercicios de flexibilidad de tobillos",
    ],
  };
  return recommendationsMap[errorType] || ["Consultar con entrenador especializado"];
}

function generateCorrectiveActions(errorType) {
  const actionsMap = {
    "KNEE_VALGUS": [
      "Pausar ejercicio inmediatamente",
      "Revisar posición de pies", 
      "Activar glúteos antes de continuar",
    ],
    "ROUNDED_BACK": [
      "Detener repetición actual",
      "Reajustar posición del core",
      "Reducir peso si es necesario",
    ],
  };
  return actionsMap[errorType] || ["Corregir técnica con entrenador"];
}

function calculateRiskLevel(severity, biomechanicsData) {
  if (severity === "critical") return "alto";
  if (severity === "high" && biomechanicsData && biomechanicsData.confidence > 0.8) return "medio-alto";
  if (severity === "medium") return "medio";
  return "bajo";
}

function analyzeUserErrors(recentErrors) {
  const errorTypes = {};
  const problemAreas = [];
  
  recentErrors.forEach(error => {
    errorTypes[error.errorType] = (errorTypes[error.errorType] || 0) + 1;
    if (error.biomechanicsData?.affectedJoints) {
      problemAreas.push(...error.biomechanicsData.affectedJoints);
    }
  });

  const commonErrors = Object.entries(errorTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type);

  const priorityAreas = [...new Set(problemAreas)].slice(0, 3);

  return {
    commonErrors,
    priorityAreas,
    totalErrors: recentErrors.length,
    severity: recentErrors.some(e => e.severity === 'critical') ? 'high' : 'moderate',
    reasoning: `Usuario presenta ${recentErrors.length} errores recientes, principalmente en: ${commonErrors.join(', ')}`,
    expectedImprovement: `Mejora esperada en ${commonErrors.length} tipos de errores y ${priorityAreas.length} áreas problemáticas en 2-4 semanas`
  };
}

function calculateAdaptationLevel(medicalHistory, errorAnalysis) {
  let adaptationScore = 0;

  if (medicalHistory.currentInjuries && medicalHistory.currentInjuries.length > 0) {
    adaptationScore += 3;
  }

  if (medicalHistory.painfulAreas && medicalHistory.painfulAreas.length > 0) {
    adaptationScore += medicalHistory.painfulAreas.length;
  }

  if (medicalHistory.forbiddenExercises && medicalHistory.forbiddenExercises.length > 0) {
    adaptationScore += 2;
  }

  if (medicalHistory.movementLimitations && medicalHistory.movementLimitations.length > 0) {
    adaptationScore += 2;
  }

  if (medicalHistory.physicalCapacity?.walkingCapacity === 'less_5min' ||
      medicalHistory.physicalCapacity?.stairsCapacity === 'cannot' ||
      medicalHistory.physicalCapacity?.energyLevel === 'very_low') {
    adaptationScore += 3;
  }

  if (errorAnalysis.severity === 'high') {
    adaptationScore += 2;
  }

  if (adaptationScore === 0) return 'none';
  if (adaptationScore <= 3) return 'minimal';
  if (adaptationScore <= 6) return 'moderate';
  return 'extensive';
}

async function generatePersonalizedRoutine(profileData) {
  const {personalInfo, medicalHistory, fitnessGoals, fitnessLevel, trainingPreferences, errorAnalysis} = profileData;
  
  try {
    logger.info("🧠 Iniciando generación híbrida: Algoritmo Local + GPT-4...");
    
    const safeExercises = await getSafeExercisesForProfile(medicalHistory, fitnessLevel);
    const goalSpecificExercises = getExercisesForGoals(fitnessGoals.primaryGoals, fitnessLevel);
    const correctiveExercises = getCorrectiveExercises(errorAnalysis.commonErrors, errorAnalysis.priorityAreas);
    
    if (openai) {
      try {
        const medicalContext = prepareMedicalContextForGPT(medicalHistory, errorAnalysis);
        const userProfile = prepareUserProfileForGPT(personalInfo, fitnessGoals, fitnessLevel, trainingPreferences);
        
        const gptRoutine = await generateRoutineWithGPT(userProfile, medicalContext, {
          safeExercises,
          goalSpecificExercises,
          correctiveExercises,
          duration: trainingPreferences?.maxSessionDuration || 30
        });
        
        const enhancedRoutine = validateAndEnhanceGPTRoutine(gptRoutine, safeExercises, medicalHistory);
        
        logger.info("✅ Rutina generada exitosamente con GPT-4");
        return enhancedRoutine;
        
      } catch (gptError) {
        logger.warn("⚠️ Error con GPT, usando algoritmo local como fallback:", gptError.message);
      }
    }
    
    return await generateLocalRoutine(profileData);
    
  } catch (error) {
    logger.error("❌ Error en generación de rutina:", error);
    return await generateLocalRoutine(profileData);
  }
}

async function generateRoutineWithGPT(userProfile, medicalContext, exerciseOptions) {
  if (!openai) {
    throw new Error("OpenAI no está disponible");
  }

  const prompt = createIntelligentPromptForGPT(userProfile, medicalContext, exerciseOptions);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un entrenador personal experto especializado en usuarios principiantes con limitaciones médicas. 
          Generas rutinas de ejercicio seguras, progresivas y personalizadas. 
          SIEMPRE respondes en formato JSON válido con la estructura exacta solicitada.
          
          IMPORTANTE: Solo incluye ejercicios básicos seguros para principiantes:
          - Sentadillas básicas y variaciones
          - Flexiones y variaciones  
          - Plancha y core
          - Caminata y cardio ligero
          - Estiramientos básicos`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;
    const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const gptResult = JSON.parse(cleanedResponse);

    logger.info("✅ GPT-4 generó rutina exitosamente");
    
    return {
      ...gptResult,
      gptGenerated: true,
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error("❌ Error llamando a GPT-4:", error);
    throw new Error(`GPT Error: ${error.message}`);
  }
}

function createIntelligentPromptForGPT(userProfile, medicalContext, exerciseOptions) {
  return `
GENERA UNA RUTINA DE ENTRENAMIENTO PERSONALIZADA:

PERFIL DEL USUARIO:
- Edad: ${userProfile.age} años
- Género: ${userProfile.gender}
- Peso: ${userProfile.weight} kg
- Altura: ${userProfile.height} cm
- Nivel fitness: ${userProfile.fitnessLevel}
- Objetivos principales: ${userProfile.primaryGoals.join(', ')}
- Duración preferida: ${exerciseOptions.duration} minutos

LIMITACIONES MÉDICAS:
${medicalContext.limitations}

CAPACIDAD FÍSICA ACTUAL:
${medicalContext.physicalCapacity}

ERRORES POSTURALES RECIENTES:
${medicalContext.recentErrors}

EJERCICIOS SEGUROS DISPONIBLES:
${exerciseOptions.safeExercises.map(ex => `- ${ex.name}: ${ex.category}`).join('\n')}

RESPONDE EN ESTE FORMATO JSON EXACTO:
{
  "exercises": [
    {
      "id": "exercise_id",
      "name": "Nombre del Ejercicio",
      "category": "strength/cardio/flexibility/corrective",
      "sets": 3,
      "reps": "10-12",
      "duration": 180,
      "restTime": 60,
      "instructions": "Instrucciones detalladas paso a paso",
      "modifications": "Modificaciones para limitaciones",
      "targetMuscles": ["muscle1", "muscle2"],
      "order": 1
    }
  ],
  "adaptations": [
    "Adaptación específica 1",
    "Adaptación específica 2"
  ],
  "focusAreas": [
    "Área de enfoque 1",
    "Área de enfoque 2"
  ],
  "specialInstructions": [
    "Instrucción especial 1",
    "Instrucción especial 2"
  ],
  "totalDuration": ${exerciseOptions.duration},
  "difficultyRating": 1
}`;
}

function prepareMedicalContextForGPT(medicalHistory, errorAnalysis) {
  const limitations = [];
  const physicalCapacity = [];
  
  if (medicalHistory.currentInjuries) {
    limitations.push(`Lesiones actuales: ${medicalHistory.currentInjuries}`);
  }
  
  if (medicalHistory.painfulAreas?.length > 0) {
    limitations.push(`Áreas con dolor: ${medicalHistory.painfulAreas.join(', ')}`);
  }
  
  if (medicalHistory.forbiddenExercises) {
    limitations.push(`Ejercicios prohibidos: ${medicalHistory.forbiddenExercises}`);
  }
  
  if (medicalHistory.movementLimitations) {
    limitations.push(`Limitaciones de movimiento: ${medicalHistory.movementLimitations}`);
  }
  
  if (medicalHistory.physicalCapacity) {
    const cap = medicalHistory.physicalCapacity;
    physicalCapacity.push(`Capacidad de caminata: ${cap.walkingCapacity}`);
    physicalCapacity.push(`Capacidad escaleras: ${cap.stairsCapacity}`);
    physicalCapacity.push(`Experiencia con pesas: ${cap.weightExperience}`);
    physicalCapacity.push(`Nivel de energía: ${cap.energyLevel}`);
  }
  
  return {
    limitations: limitations.length > 0 ? limitations.join('\n') : 'Sin limitaciones médicas reportadas',
    physicalCapacity: physicalCapacity.join('\n'),
    recentErrors: errorAnalysis.commonErrors.length > 0 ? 
      `Errores frecuentes: ${errorAnalysis.commonErrors.join(', ')}` : 
      'Sin errores posturales recientes'
  };
}

function prepareUserProfileForGPT(personalInfo, fitnessGoals, fitnessLevel, trainingPreferences) {
  return {
    age: personalInfo.age,
    gender: personalInfo.gender,
    weight: personalInfo.weight,
    height: personalInfo.height,
    fitnessLevel: fitnessLevel,
    primaryGoals: fitnessGoals.primaryGoals || [],
    preferredIntensity: trainingPreferences?.preferredIntensity || 'moderate',
    maxDuration: trainingPreferences?.maxSessionDuration || 30
  };
}

function validateAndEnhanceGPTRoutine(gptRoutine, safeExercises, medicalHistory) {
  try {
    const validatedExercises = gptRoutine.exercises.filter(exercise => {
      const isSafe = safeExercises.some(safe => 
        safe.name.toLowerCase().includes(exercise.name.toLowerCase()) ||
        exercise.name.toLowerCase().includes(safe.name.toLowerCase())
      );
      
      if (!isSafe) {
        logger.warn(`⚠️ Ejercicio ${exercise.name} no está en lista segura, removido`);
      }
      
      return isSafe;
    });

    if (validatedExercises.length < 3) {
      logger.warn("⚠️ Muy pocos ejercicios validados, agregando ejercicios seguros básicos");
      
      const basicSafeExercises = safeExercises.slice(0, 3).map((exercise, index) => ({
        id: `safe_${exercise.id}`,
        name: exercise.name,
        category: exercise.category,
        sets: 2,
        reps: "10-12",
        duration: 180,
        restTime: 60,
        instructions: `Realizar ${exercise.name} de forma controlada y segura`,
        modifications: exercise.modifications?.knee_pain || "Adaptar según capacidad",
        targetMuscles: exercise.targetMuscles || ['core'],
        order: validatedExercises.length + index + 1
      }));
      
      validatedExercises.push(...basicSafeExercises);
    }

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

async function generateLocalRoutine(profileData) {
  const {medicalHistory, fitnessGoals, fitnessLevel, trainingPreferences, errorAnalysis} = profileData;
  
  logger.info("🔄 Generando rutina con algoritmo local...");
  
  const safeExercises = await getSafeExercisesForProfile(medicalHistory, fitnessLevel);
  const goalSpecificExercises = getExercisesForGoals(fitnessGoals.primaryGoals, fitnessLevel);
  const correctiveExercises = getCorrectiveExercises(errorAnalysis.commonErrors, errorAnalysis.priorityAreas);
  
  const selectedExercises = balanceExerciseSelection({
    safe: safeExercises,
    goalSpecific: goalSpecificExercises,
    corrective: correctiveExercises,
    duration: trainingPreferences?.maxSessionDuration || 30,
    intensity: trainingPreferences?.preferredIntensity || 'moderate'
  });

  const adaptations = generateExerciseAdaptations(selectedExercises, medicalHistory);
  const focusAreas = determineFocusAreas(fitnessGoals.primaryGoals, errorAnalysis.priorityAreas);

  return {
    exercises: selectedExercises,
    adaptations: adaptations,
    focusAreas: focusAreas,
    gptGenerated: false,
    gptInstructions: [],
    totalDuration: calculateTotalDuration(selectedExercises),
    difficultyRating: calculateDifficultyRating(selectedExercises, fitnessLevel)
  };
}

async function getSafeExercisesForProfile(medicalHistory, fitnessLevel) {
  const allExercises = [
    {
      id: 'squat_basic',
      name: 'Sentadilla Básica',
      category: 'strength',
      targetMuscles: ['quadriceps', 'glutes', 'hamstrings'],
      equipment: ['bodyweight'],
      contraindications: ['knee_injury', 'hip_injury', 'back_injury'],
      modifications: {
        'knee_pain': 'Reducir profundidad, usar silla de apoyo',
        'back_pain': 'Mantener espalda contra pared'
      },
      difficulty: 'beginner'
    },
    {
      id: 'pushup_basic',
      name: 'Flexiones Básicas',
      category: 'strength',
      targetMuscles: ['chest', 'shoulders', 'triceps'],
      equipment: ['bodyweight'],
      contraindications: ['shoulder_injury', 'wrist_injury'],
      modifications: {
        'shoulder_pain': 'Flexiones en pared o inclinadas',
        'wrist_pain': 'Usar puños cerrados o barras paralelas'
      },
      difficulty: 'beginner'
    },
    {
      id: 'plank_basic',
      name: 'Plancha Básica',
      category: 'strength',
      targetMuscles: ['core', 'shoulders'],
      equipment: ['bodyweight'],
      contraindications: ['lower_back_injury', 'shoulder_injury'],
      modifications: {
        'back_pain': 'Plancha en rodillas',
        'shoulder_pain': 'Plancha en antebrazos'
      },
      difficulty: 'beginner'
    },
    {
      id: 'walking_cardio',
      name: 'Caminata Activa',
      category: 'cardio',
      targetMuscles: ['legs', 'cardiovascular'],
      equipment: ['none'],
      contraindications: [],
      modifications: {
        'low_mobility': 'Caminata lenta y progresiva',
        'knee_pain': 'Superficies planas, evitar inclinaciones'
      },
      difficulty: 'beginner'
    },
    {
      id: 'arm_circles',
      name: 'Círculos de Brazos',
      category: 'flexibility',
      targetMuscles: ['shoulders', 'arms'],
      equipment: ['bodyweight'],
      contraindications: ['shoulder_injury'],
      modifications: {
        'shoulder_pain': 'Círculos más pequeños y lentos'
      },
      difficulty: 'beginner'
    }
  ];

  const painfulAreas = medicalHistory.painfulAreas || [];
  const forbiddenExercises = medicalHistory.forbiddenExercises || '';

  const safeExercises = allExercises.filter(exercise => {
    const hasContraindication = exercise.contraindications.some(contra => 
      painfulAreas.some(area => contra.includes(area))
    );

    const isForbidden = forbiddenExercises.toLowerCase().includes(exercise.name.toLowerCase());
    const appropriateDifficulty = isAppropriateForLevel(exercise.difficulty, fitnessLevel);

    return !hasContraindication && !isForbidden && appropriateDifficulty;
  });

  return safeExercises;
}

function getExercisesForGoals(primaryGoals, fitnessLevel) {
  const goalExercises = {
    'weight_loss': [
      {id: 'burpees_mod', name: 'Burpees Modificados', category: 'cardio', intensity: 'high'},
      {id: 'jumping_jacks', name: 'Saltos de Tijera', category: 'cardio', intensity: 'moderate'},
      {id: 'mountain_climbers', name: 'Escaladores', category: 'cardio', intensity: 'high'}
    ],
    'muscle_gain': [
      {id: 'squat_weighted', name: 'Sentadillas con Peso', category: 'strength', intensity: 'high'},
      {id: 'pushup_variations', name: 'Variaciones de Flexiones', category: 'strength', intensity: 'moderate'},
      {id: 'lunges', name: 'Zancadas', category: 'strength', intensity: 'moderate'}
    ],
    'strength': [
      {id: 'deadlift_basic', name: 'Peso Muerto Básico', category: 'strength', intensity: 'high'},
      {id: 'pull_ups_assisted', name: 'Dominadas Asistidas', category: 'strength', intensity: 'high'},
      {id: 'overhead_press', name: 'Press de Hombros', category: 'strength', intensity: 'moderate'}
    ],
    'endurance': [
      {id: 'cardio_intervals', name: 'Intervalos Cardiovasculares', category: 'cardio', intensity: 'variable'},
      {id: 'circuit_training', name: 'Entrenamiento en Circuito', category: 'cardio', intensity: 'high'},
      {id: 'steady_cardio', name: 'Cardio Sostenido', category: 'cardio', intensity: 'moderate'}
    ],
    'flexibility': [
      {id: 'full_body_stretch', name: 'Estiramiento Completo', category: 'flexibility', intensity: 'low'},
      {id: 'yoga_basic', name: 'Yoga Básico', category: 'flexibility', intensity: 'low'},
      {id: 'dynamic_stretching', name: 'Estiramiento Dinámico', category: 'flexibility', intensity: 'moderate'}
    ],
    'general_fitness': [
      {id: 'functional_movement', name: 'Movimiento Funcional', category: 'strength', intensity: 'moderate'},
      {id: 'balance_training', name: 'Entrenamiento de Balance', category: 'balance', intensity: 'low'},
      {id: 'core_stability', name: 'Estabilidad del Core', category: 'strength', intensity: 'moderate'}
    ]
  };

  let selectedExercises = [];
  primaryGoals.forEach(goal => {
    if (goalExercises[goal]) {
      selectedExercises.push(...goalExercises[goal]);
    }
  });

  return selectedExercises;
}

function getCorrectiveExercises(commonErrors, priorityAreas) {
  const correctiveMap = {
    'KNEE_VALGUS': [
      {id: 'wall_squat', name: 'Sentadilla en Pared', category: 'corrective'},
      {id: 'goblet_squat', name: 'Sentadilla Copa', category: 'corrective'}
    ],
    'ROUNDED_BACK': [
      {id: 'neck_stretches', name: 'Estiramientos de Cuello', category: 'corrective'},
      {id: 'chin_tucks', name: 'Retracciones de Barbilla', category: 'corrective'}
    ],
    'INSUFFICIENT_DEPTH': [
      {id: 'shoulder_blade_squeezes', name: 'Compresión de Omóplatos', category: 'corrective'},
      {id: 'door_chest_stretch', name: 'Estiramiento de Pecho en Puerta', category: 'corrective'}
    ],
    'POOR_ALIGNMENT': [
      {id: 'glute_activation', name: 'Activación de Glúteos', category: 'corrective'},
      {id: 'hip_abduction', name: 'Abducción de Cadera', category: 'corrective'}
    ]
  };

  let correctiveExercises = [];
  commonErrors.forEach(error => {
    if (correctiveMap[error]) {
      correctiveExercises.push(...correctiveMap[error]);
    }
  });

  return correctiveExercises;
}

function balanceExerciseSelection({safe, goalSpecific, corrective, duration, intensity}) {
  const targetExerciseCount = Math.ceil(duration / 5);
  
  let selectedExercises = [];
  
  const correctiveCount = Math.max(1, Math.floor(targetExerciseCount * 0.2));
  selectedExercises.push(...corrective.slice(0, correctiveCount));
  
  const goalCount = Math.floor(targetExerciseCount * 0.6);
  selectedExercises.push(...goalSpecific.slice(0, goalCount));
  
  const remainingSlots = targetExerciseCount - selectedExercises.length;
  selectedExercises.push(...safe.slice(0, remainingSlots));
  
  return selectedExercises.map((exercise, index) => ({
    ...exercise,
    sets: calculateSets(exercise.category, intensity),
    reps: calculateReps(exercise.category, intensity),
    duration: calculateExerciseDuration(exercise.category),
    restTime: calculateRestTime(exercise.category, intensity),
    order: index + 1,
    modifications: exercise.modifications || []
  }));
}

function calculateSets(category, intensity) {
  const setsMap = {
    'strength': intensity === 'high' ? 4 : intensity === 'moderate' ? 3 : 2,
    'cardio': 3,
    'flexibility': 2,
    'corrective': 2,
    'balance': 2
  };
  return setsMap[category] || 3;
}

function calculateReps(category, intensity) {
  const repsMap = {
    'strength': intensity === 'high' ? '8-10' : intensity === 'moderate' ? '10-12' : '12-15',
    'cardio': '30 segundos',
    'flexibility': '30 segundos',
    'corrective': '10-12',
    'balance': '30 segundos'
  };
  return repsMap[category] || '10-12';
}

function calculateExerciseDuration(category) {
  const durationMap = {
    'strength': 180,
    'cardio': 300,
    'flexibility': 120,
    'corrective': 150,
    'balance': 120
  };
  return durationMap[category] || 180;
}

function calculateRestTime(category, intensity) {
  if (category === 'strength') {
    return intensity === 'high' ? 90 : intensity === 'moderate' ? 60 : 45;
  }
  return 30;
}

function isAppropriateForLevel(exerciseDifficulty, userLevel) {
  const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
  const exerciseIndex = difficultyOrder.indexOf(exerciseDifficulty);
  const userIndex = difficultyOrder.indexOf(userLevel);
  
  return exerciseIndex <= userIndex;
}

function generateRoutineName(primaryGoals, fitnessLevel) {
  const goalNames = {
    'weight_loss': 'Quema Grasa',
    'muscle_gain': 'Construcción Muscular',
    'strength': 'Fuerza',
    'endurance': 'Resistencia',
    'flexibility': 'Flexibilidad',
    'general_fitness': 'Fitness General'
  };
  
  const mainGoal = primaryGoals[0];
  const goalName = goalNames[mainGoal] || 'Personalizada';
  const levelName = fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1);
  
  return `${goalName} ${levelName}`;
}

function generateRoutineDescription(generatedRoutine, adaptationLevel) {
  const adaptationDescriptions = {
    'none': 'Rutina estándar sin adaptaciones especiales.',
    'minimal': 'Rutina con adaptaciones mínimas por limitaciones leves.',
    'moderate': 'Rutina moderadamente adaptada para condiciones específicas.',
    'extensive': 'Rutina extensamente adaptada por limitaciones médicas importantes.'
  };
  
  return `${adaptationDescriptions[adaptationLevel]} Incluye ${generatedRoutine.exercises.length} ejercicios enfocados en: ${generatedRoutine.focusAreas.join(', ')}.`;
}

function mapDifficultyLevel(fitnessLevel, adaptationLevel) {
  if (adaptationLevel === 'extensive') return 'beginner';
  if (adaptationLevel === 'moderate') return fitnessLevel === 'advanced' ? 'intermediate' : 'beginner';
  return fitnessLevel;
}

function calculateEstimatedCalories(exercises, personalInfo) {
  const avgMET = 4.5;
  const totalTimeHours = exercises.reduce((total, ex) => total + (ex.duration || 180), 0) / 3600;
  const weightKg = personalInfo.weight || 70;
  
  return Math.round(avgMET * weightKg * totalTimeHours);
}

function determineFocusAreas(primaryGoals, priorityAreas) {
  const goalToArea = {
    'weight_loss': 'Quema de Calorías',
    'muscle_gain': 'Hipertrofia',
    'strength': 'Fuerza Funcional',
    'endurance': 'Resistencia Cardiovascular',
    'flexibility': 'Movilidad y Flexibilidad',
    'general_fitness': 'Fitness Integral'
  };
  
  let focusAreas = primaryGoals.map(goal => goalToArea[goal]).filter(Boolean);
  
  if (priorityAreas.length > 0) {
    focusAreas.push('Corrección Postural');
  }
  
  return [...new Set(focusAreas)];
}

function calculateAIConfidence(generatedRoutine, medicalHistory, errorAnalysis) {
  let confidence = 85;
  
  if (generatedRoutine.gptGenerated) {
    confidence += 10;
  }
  
  const limitations = [
    medicalHistory.currentInjuries,
    medicalHistory.forbiddenExercises,
    medicalHistory.movementLimitations
  ].filter(Boolean).length;
  
  confidence -= limitations * 5;
  
  if (errorAnalysis.severity === 'high') {
    confidence -= 10;
  }
  
  if (generatedRoutine.exercises.length >= 5 && generatedRoutine.adaptations.length > 0) {
    confidence += 5;
  }
  
  return Math.max(60, Math.min(95, confidence));
}

function shouldRequireTrainerApproval(adaptationLevel, aiConfidence, medicalHistory) {
  if (adaptationLevel === 'extensive') return true;
  if (aiConfidence < 75) return true;
  if (medicalHistory.currentInjuries && medicalHistory.currentInjuries.length > 0) return true;
  if (medicalHistory.forbiddenExercises && medicalHistory.forbiddenExercises.length > 0) return true;
  
  return false;
}

function extractMedicalLimitations(medicalHistory) {
  const limitations = [];
  
  if (medicalHistory.currentInjuries) limitations.push(medicalHistory.currentInjuries);
  if (medicalHistory.painfulAreas?.length) limitations.push(`Dolor en: ${medicalHistory.painfulAreas.join(', ')}`);
  if (medicalHistory.forbiddenExercises) limitations.push(`Prohibido: ${medicalHistory.forbiddenExercises}`);
  if (medicalHistory.movementLimitations) limitations.push(medicalHistory.movementLimitations);
  
  return limitations.filter(Boolean);
}

function generateExerciseAdaptations(exercises, medicalHistory) {
  const adaptations = [];
  
  if (medicalHistory.painfulAreas?.includes('knees')) {
    adaptations.push('Ejercicios de bajo impacto para proteger rodillas');
  }
  
  if (medicalHistory.painfulAreas?.includes('back')) {
    adaptations.push('Modificaciones para proteger la espalda');
  }
  
  if (medicalHistory.physicalCapacity?.energyLevel === 'low') {
    adaptations.push('Intensidad reducida por nivel de energía bajo');
  }
  
  return adaptations;
}

function calculateTotalDuration(exercises) {
  return exercises.reduce((total, exercise) => total + (exercise.duration || 0), 0);
}

function calculateDifficultyRating(exercises, fitnessLevel) {
  const levelScores = { beginner: 1, intermediate: 2, advanced: 3 };
  return levelScores[fitnessLevel] || 1;
}

async function createTrainerNotification(userId, routineId, routine, adaptationLevel) {
  try {
    await db.collection("trainerNotifications").add({
      type: "ai_routine_approval",
      userId: userId,
      routineId: routineId,
      routineName: routine.routine.name,
      adaptationLevel: adaptationLevel,
      aiConfidence: routine.aiConfidence,
      priority: adaptationLevel === 'extensive' ? 'high' : 'medium',
      message: `Rutina IA generada requiere aprobación - Adaptación: ${adaptationLevel}`,
      createdAt: new Date(),
      status: "pending",
      metadata: {
        exerciseCount: routine.routine.exercises.length,
        duration: routine.routine.duration,
        focusAreas: routine.routine.focusAreas,
        gptGenerated: routine.routine.gptGenerated || false
      }
    });
  } catch (error) {
    logger.error("Error creando notificación entrenador:", error);
  }
}

async function updateUserAIStats(userId, aiConfidence, adaptationLevel) {
  try {
    const statsRef = db.collection("userStats").doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      
      const currentStats = statsDoc.exists ? statsDoc.data() : {};
      
      const updatedStats = {
        ...currentStats,
        totalAIRoutinesGenerated: (currentStats.totalAIRoutinesGenerated || 0) + 1,
        lastAIGeneration: new Date(),
        averageAIConfidence: aiConfidence,
        lastAdaptationLevel: adaptationLevel,
        lastUpdated: new Date()
      };
      
      transaction.set(statsRef, updatedStats, { merge: true });
    });
  } catch (error) {
    logger.error("Error actualizando estadísticas IA:", error);
  }
}

function calculateUserMetrics(userStats, recentAlerts, timeRange) {
  const now = new Date();
  const timeRanges = {
    "week": 7 * 24 * 60 * 60 * 1000,
    "month": 30 * 24 * 60 * 60 * 1000,
    "quarter": 90 * 24 * 60 * 60 * 1000,
  };

  const rangeMs = timeRanges[timeRange] || timeRanges.month;
  const cutoffDate = new Date(now.getTime() - rangeMs);

  const filteredAlerts = recentAlerts.filter((alert) => {
    const alertDate = alert.processedAt && alert.processedAt.toDate ?
        alert.processedAt.toDate() : new Date(alert.processedAt);
    return alertDate >= cutoffDate;
  });

  return {
    totalAlerts: filteredAlerts.length,
    criticalAlerts: filteredAlerts.filter((a) => a.severity === "critical").length,
    improvementTrend: calculateImprovementTrend(filteredAlerts),
    mostCommonError: getMostCommonError(filteredAlerts),
    accuracyScore: calculateAccuracyScore(filteredAlerts),
    lastActivity: userStats.lastCriticalError,
    timeRange,
  };
}

function calculateImprovementTrend(alerts) {
  if (alerts.length < 2) return "insufficient_data";

  const midpoint = Math.floor(alerts.length / 2);
  const firstHalf = alerts.slice(0, midpoint);
  const secondHalf = alerts.slice(midpoint);

  const firstHalfCritical = firstHalf.filter((a) => a.severity === "critical").length;
  const secondHalfCritical = secondHalf.filter((a) => a.severity === "critical").length;

  if (secondHalfCritical < firstHalfCritical) return "improving";
  if (secondHalfCritical > firstHalfCritical) return "declining";
  return "stable";
}

function getMostCommonError(alerts) {
  if (alerts.length === 0) return null;

  const errorCounts = {};
  alerts.forEach((alert) => {
    errorCounts[alert.errorType] = (errorCounts[alert.errorType] || 0) + 1;
  });

  const entries = Object.entries(errorCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function calculateAccuracyScore(alerts) {
  if (alerts.length === 0) return 100;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const totalCount = alerts.length;

  if (totalCount === 0) return 100;

  const criticalRate = criticalCount / totalCount;
  return Math.max(0, Math.round((1 - criticalRate) * 100));
}