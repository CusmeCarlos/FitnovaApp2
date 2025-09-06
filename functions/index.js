// functions/index.js
// 🔥 CLOUD FUNCTIONS PARA FITNOVA - VERSIÓN CORREGIDA ESLINT

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");

// ✅ INICIALIZAR FIREBASE ADMIN
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// 🔔 FUNCIÓN PRINCIPAL - ENVIAR NOTIFICACIÓN AL ENTRENADOR
exports.sendTrainerNotification = onCall(async (request) => {
  try {
    const {data} = request;
    logger.info("📨 Procesando alerta crítica:", data);

    // ✅ VALIDAR AUTENTICACIÓN
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    // ✅ VALIDAR DATOS REQUERIDOS
    if (!data.uid || !data.errorType || !data.severity) {
      throw new HttpsError("invalid-argument", "Datos de alerta incompletos");
    }

    // ✅ VERIFICAR QUE EL USUARIO PUEDE ENVIAR ALERTAS
    if (request.auth.uid !== data.uid) {
      throw new HttpsError("permission-denied",
          "No autorizado para enviar alertas de este usuario");
    }

    // ✅ OBTENER DATOS DEL USUARIO
    const userDoc = await db.collection("users").doc(data.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Usuario no encontrado");
    }

    const userData = userDoc.data();

    // ✅ OBTENER ENTRENADOR ASIGNADO O USAR ADMIN
    const trainerId = userData.assignedTrainer || "admin";
    let trainerData = {fcmToken: null, email: "admin@fitnova.com"};

    // Intentar obtener datos del entrenador
    if (trainerId !== "admin") {
      const trainerDoc = await db.collection("trainers").doc(trainerId).get();
      if (trainerDoc.exists) {
        trainerData = trainerDoc.data();
      } else {
        logger.warn(`⚠️ Entrenador ${trainerId} no encontrado`);
      }
    }

    // ✅ CREAR MENSAJE FCM ESTRUCTURADO
    const fcmMessage = {
      notification: {
        title: `🚨 FitNova - Alerta ${getSeverityText(data.severity)}`,
        body: `${data.userDisplayName || "Usuario"}: ` +
              `${getErrorTypeText(data.errorType)} en ${data.exercise}`,
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
      },
      android: {
        priority: "high",
        notification: {
          icon: "ic_notification",
          color: data.severity === "critical" ? "#FF0000" : "#FF8800",
          sound: "default",
          channelId: "critical_alerts",
        },
      },
      webpush: {
        headers: {
          "TTL": "300",
          "Urgency": "high",
        },
        notification: {
          icon: "/assets/icon/icon-192x192.png",
          badge: "/assets/icon/icon-72x72.png",
          requireInteraction: true,
          tag: `error-${data.errorType}-${data.sessionId}`,
          actions: [
            {
              action: "view-details",
              title: "Ver Detalles",
            },
            {
              action: "dismiss",
              title: "Cerrar",
            },
          ],
        },
        fcmOptions: {
          link: "/dashboard/alerts",
        },
      },
    };

    // ✅ ARRAY PARA RESULTADOS DE NOTIFICACIONES
    const notificationResults = [];

    // ✅ ENVIAR A TOKEN ESPECÍFICO DEL ENTRENADOR
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
        logger.info(`✅ Notificación enviada al entrenador ` +
                   `${trainerId}: ${result}`);
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

    // ✅ ENVIAR A TOPIC DE ENTRENADORES (BACKUP)
    try {
      const topicResult = await messaging.send({
        ...fcmMessage,
        topic: "trainers",
      });
      notificationResults.push({
        type: "topic",
        topic: "trainers",
        result: topicResult,
        success: true,
      });
      logger.info(`✅ Notificación enviada al topic trainers: ${topicResult}`);
    } catch (error) {
      logger.error("❌ Error enviando al topic trainers:", error);
      notificationResults.push({
        type: "topic",
        topic: "trainers",
        error: error.message,
        success: false,
      });
    }

    // ✅ GUARDAR ALERTA EN COLECCIÓN ESPECIALIZADA
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

    // ✅ ACTUALIZAR ESTADÍSTICAS DEL USUARIO
    await db.collection("userStats").doc(data.uid).set({
      lastCriticalError: new Date(),
      totalCriticalErrors: FieldValue.increment(1),
      lastErrorType: data.errorType,
      lastExercise: data.exercise,
      lastSessionId: data.sessionId,
    }, {merge: true});

    // ✅ CREAR ENTRADA PARA DASHBOARD DEL ENTRENADOR
    await db.collection("trainerDashboard").add({
      alertId: alertRef.id,
      userId: data.uid,
      userDisplayName: data.userDisplayName,
      userEmail: data.userEmail,
      errorType: data.errorType,
      exercise: data.exercise,
      severity: data.severity,
      captureURL: data.captureURL,
      biomechanicsData: data.biomechanicsData,
      deviceInfo: data.deviceInfo,
      status: "pending_review",
      priority: data.severity === "critical" ? "high" : "medium",
      createdAt: new Date(),
      assignedTrainer: trainerId,
      requiresAction: data.severity === "critical",
    });

    logger.info("✅ Alerta procesada exitosamente:", alertRef.id);

    return {
      success: true,
      alertId: alertRef.id,
      notificationResults,
      trainerNotified: notificationResults.some((r) => r.success),
      message: "Alerta crítica procesada y entrenador notificado",
    };
  } catch (error) {
    logger.error("🛑 Error procesando alerta crítica:", error);
    throw new HttpsError("internal", "Error procesando alerta: " +
                         error.message);
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

    // ✅ OBTENER ALERTA EXISTENTE
    const alertDoc = await db.collection("notifications").doc(data.alertId)
        .get();
    if (!alertDoc.exists) {
      throw new HttpsError("not-found", "Alerta no encontrada");
    }

    // ✅ GENERAR ANÁLISIS BIOMECÁNICO
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

    // ✅ ACTUALIZAR ALERTA CON ANÁLISIS
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

    // ✅ PROCESAR DATOS DE SESIÓN
    if (mobileData.sessionData) {
      await db.collection("activeSessions").doc(uid).set({
        ...mobileData.sessionData,
        lastSync: new Date(),
        platform: "mobile",
        status: "active",
      }, {merge: true});
    }

    // ✅ PROCESAR MÉTRICAS EN TIEMPO REAL
    if (mobileData.metrics) {
      await db.collection("userMetrics").doc(uid).set({
        ...mobileData.metrics,
        lastUpdate: new Date(),
        dataSource: "mobile_app",
      }, {merge: true});
    }

    // ✅ PROCESAR CONFIGURACIONES
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
    throw new HttpsError("internal", "Error en sincronización: " +
                         error.message);
  }
});

exports.generateAdaptiveRoutine = onCall(async (request) => {
  try {
    const {data} = request;
    const {userId, personalInfo, medicalHistory, fitnessGoals, fitnessLevel, trainingPreferences} = data;

    if (!request.auth || request.auth.uid !== userId) {
      throw new HttpsError("permission-denied", "No autorizado");
    }

    logger.info("🧠 Generando rutina adaptativa IA para:", userId);

    // ✅ VALIDAR DATOS MÍNIMOS PARA IA
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

    // ✅ ANALIZAR HISTORIAL DE ERRORES RECIENTES
    const errorsSnapshot = await db.collection("criticalAlerts")
        .where("uid", "==", userId)
        .where("severity", "in", ["high", "critical"])
        .orderBy("processedAt", "desc")
        .limit(20)
        .get();

    const recentErrors = errorsSnapshot.docs.map((doc) => doc.data());
    const errorAnalysis = analyzeUserErrors(recentErrors);

    // ✅ CALCULAR NIVEL DE ADAPTACIÓN REQUERIDO
    const adaptationLevel = calculateAdaptationLevel(medicalHistory, errorAnalysis);
    
    // ✅ GENERAR RUTINA PERSONALIZADA CON ALGORITMO IA
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

    // ✅ CALCULAR CONFIANZA DE LA IA
    const aiConfidence = calculateAIConfidence(generatedRoutine, medicalHistory, errorAnalysis);

    // ✅ DETERMINAR SI NECESITA APROBACIÓN DEL ENTRENADOR
    const needsTrainerApproval = shouldRequireTrainerApproval(adaptationLevel, aiConfidence, medicalHistory);

    // ✅ PREPARAR RUTINA FINAL
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
        adaptations: generatedRoutine.adaptations
      },
      status: needsTrainerApproval ? "pending_approval" : "approved",
      aiConfidence: aiConfidence,
      generationTime: Date.now() - request.timestamp || 0,
      adaptationLevel: adaptationLevel,
      needsTrainerApproval: needsTrainerApproval,
      lastUpdated: new Date()
    };

    // ✅ GUARDAR RUTINA GENERADA
    const routineRef = await db.collection("aiRoutines")
        .doc(userId)
        .collection("routines")
        .add(finalRoutine);

    // ✅ CREAR NOTIFICACIÓN PARA ENTRENADOR SI ES NECESARIO
    if (needsTrainerApproval) {
      await createTrainerNotification(userId, routineRef.id, finalRoutine, adaptationLevel);
    }

    // ✅ ACTUALIZAR ESTADÍSTICAS DEL USUARIO
    await updateUserAIStats(userId, aiConfidence, adaptationLevel);

    logger.info("✅ Rutina IA generada exitosamente:", routineRef.id);

    return {
      success: true,
      routineId: routineRef.id,
      routine: finalRoutine,
      needsTrainerApproval: needsTrainerApproval,
      aiConfidence: aiConfidence,
      message: needsTrainerApproval ? 
        "Rutina generada, esperando aprobación del entrenador" : 
        "Rutina generada y lista para usar"
    };

  } catch (error) {
    logger.error("🛑 Error generando rutina IA:", error);
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

    // ✅ OBTENER ESTADÍSTICAS DEL USUARIO
    const statsDoc = await db.collection("userStats").doc(uid).get();
    const userStats = statsDoc.exists ? statsDoc.data() : {};

    // ✅ OBTENER ALERTAS RECIENTES
    const alertsSnapshot = await db.collection("criticalAlerts")
        .where("uid", "==", uid)
        .orderBy("processedAt", "desc")
        .limit(50)
        .get();

    const recentAlerts = alertsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // ✅ CALCULAR MÉTRICAS
    const metrics = calculateUserMetrics(userStats, recentAlerts, timeRange);

    return {
      success: true,
      metrics,
      lastUpdate: new Date(),
    };
  } catch (error) {
    logger.error("🛑 Error obteniendo métricas:", error);
    throw new HttpsError("internal", "Error obteniendo métricas: " +
                         error.message);
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

/**
 * Convierte códigos de severidad a texto legible
 * @param {string} severity - Código de severidad
 * @return {string} Texto de severidad
 */
function getSeverityText(severity) {
  const severityMap = {
    "critical": "CRÍTICO",
    "high": "ALTO",
    "medium": "MEDIO",
    "low": "BAJO",
  };
  return severityMap[severity] || "DESCONOCIDO";
}

/**
 * Convierte códigos de error a texto descriptivo
 * @param {string} errorType - Tipo de error
 * @return {string} Descripción del error
 */
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

/**
 * Genera recomendaciones basadas en el tipo de error
 * @param {string} errorType - Tipo de error detectado
 * @return {Array} Array de recomendaciones
 */
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
  return recommendationsMap[errorType] ||
         ["Consultar con entrenador especializado"];
}

/**
 * Genera acciones correctivas específicas
 * @param {string} errorType - Tipo de error
 * @return {Array} Acciones correctivas
 */
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

/**
 * Calcula el nivel de riesgo basado en datos biomecánicos
 * @param {string} severity - Severidad del error
 * @param {Object} biomechanicsData - Datos biomecánicos
 * @return {string} Nivel de riesgo
 */
function calculateRiskLevel(severity, biomechanicsData) {
  if (severity === "critical") return "alto";
  if (severity === "high" && biomechanicsData &&
      biomechanicsData.confidence > 0.8) return "medio-alto";
  if (severity === "medium") return "medio";
  return "bajo";
}

/**
 * Analiza errores del usuario para generar insights
 * @param {Array} errors - Array de errores recientes
 * @return {Object} Análisis de errores
 */
// ✅ FUNCIÓN AUXILIAR: ANALIZAR ERRORES DEL USUARIO
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

  const priorityAreas = [...new Set(problemAreas)]
    .slice(0, 3);

  return {
    commonErrors,
    priorityAreas,
    totalErrors: recentErrors.length,
    severity: recentErrors.some(e => e.severity === 'critical') ? 'high' : 'moderate',
    reasoning: `Usuario presenta ${recentErrors.length} errores recientes, principalmente en: ${commonErrors.join(', ')}`,
    expectedImprovement: calculateExpectedImprovement(commonErrors, priorityAreas)
  };
}

function calculateAdaptationLevel(medicalHistory, errorAnalysis) {
  let adaptationScore = 0;

  // Lesiones actuales
  if (medicalHistory.currentInjuries && medicalHistory.currentInjuries.length > 0) {
    adaptationScore += 3;
  }

  // Áreas con dolor
  if (medicalHistory.painfulAreas && medicalHistory.painfulAreas.length > 0) {
    adaptationScore += medicalHistory.painfulAreas.length;
  }

  // Ejercicios prohibidos
  if (medicalHistory.forbiddenExercises && medicalHistory.forbiddenExercises.length > 0) {
    adaptationScore += 2;
  }

  // Limitaciones de movimiento
  if (medicalHistory.movementLimitations && medicalHistory.movementLimitations.length > 0) {
    adaptationScore += 2;
  }

  // Capacidad física baja
  if (medicalHistory.physicalCapacity?.walkingCapacity === 'less_5min' ||
      medicalHistory.physicalCapacity?.stairsCapacity === 'cannot' ||
      medicalHistory.physicalCapacity?.energyLevel === 'very_low') {
    adaptationScore += 3;
  }

  // Errores recientes críticos
  if (errorAnalysis.severity === 'high') {
    adaptationScore += 2;
  }

  // Determinar nivel
  if (adaptationScore === 0) return 'none';
  if (adaptationScore <= 3) return 'minimal';
  if (adaptationScore <= 6) return 'moderate';
  return 'extensive';
}

// ✅ FUNCIÓN AUXILIAR: GENERAR RUTINA PERSONALIZADA
async function generatePersonalizedRoutine(profileData) {
  const {personalInfo, medicalHistory, fitnessGoals, fitnessLevel, trainingPreferences, errorAnalysis} = profileData;
  
  // Base de ejercicios seguros
  const safeExercises = await getSafeExercisesForProfile(medicalHistory, fitnessLevel);
  
  // Ejercicios específicos para objetivos
  const goalSpecificExercises = getExercisesForGoals(fitnessGoals.primaryGoals, fitnessLevel);
  
  // Ejercicios correctivos para errores recientes
  const correctiveExercises = getCorrectiveExercises(errorAnalysis.commonErrors, errorAnalysis.priorityAreas);
  
  // Combinar y balancear ejercicios
  const selectedExercises = balanceExerciseSelection({
    safe: safeExercises,
    goalSpecific: goalSpecificExercises,
    corrective: correctiveExercises,
    duration: trainingPreferences?.maxSessionDuration || 30,
    intensity: trainingPreferences?.preferredIntensity || 'moderate'
  });

  // Generar adaptaciones específicas
  const adaptations = generateExerciseAdaptations(selectedExercises, medicalHistory);
  
  // Determinar áreas de enfoque
  const focusAreas = determineFocusAreas(fitnessGoals.primaryGoals, errorAnalysis.priorityAreas);

  return {
    exercises: selectedExercises,
    adaptations: adaptations,
    focusAreas: focusAreas,
    totalDuration: calculateTotalDuration(selectedExercises),
    difficultyRating: calculateDifficultyRating(selectedExercises, fitnessLevel)
  };
}

// ✅ FUNCIÓN AUXILIAR: OBTENER EJERCICIOS SEGUROS
async function getSafeExercisesForProfile(medicalHistory, fitnessLevel) {
  // Base de datos de ejercicios con contraindications
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

  // Filtrar ejercicios seguros basado en limitaciones médicas
  const painfulAreas = medicalHistory.painfulAreas || [];
  const forbiddenExercises = medicalHistory.forbiddenExercises || '';
  const movementLimitations = medicalHistory.movementLimitations || '';

  const safeExercises = allExercises.filter(exercise => {
    // Verificar contraindications por áreas dolorosas
    const hasContraindication = exercise.contraindications.some(contra => 
      painfulAreas.some(area => contra.includes(area))
    );

    // Verificar ejercicios específicamente prohibidos
    const isForbidden = forbiddenExercises.toLowerCase().includes(exercise.name.toLowerCase());

    // Verificar dificultad apropiada
    const appropriateDifficulty = isAppropriateForLevel(exercise.difficulty, fitnessLevel);

    return !hasContraindication && !isForbidden && appropriateDifficulty;
  });

  return safeExercises;
}

// ✅ FUNCIÓN AUXILIAR: EJERCICIOS PARA OBJETIVOS
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

// ✅ FUNCIÓN AUXILIAR: EJERCICIOS CORRECTIVOS
function getCorrectiveExercises(commonErrors, priorityAreas) {
  const correctiveMap = {
    'poor_squat_form': [
      {id: 'wall_squat', name: 'Sentadilla en Pared', category: 'corrective'},
      {id: 'goblet_squat', name: 'Sentadilla Copa', category: 'corrective'}
    ],
    'forward_head_posture': [
      {id: 'neck_stretches', name: 'Estiramientos de Cuello', category: 'corrective'},
      {id: 'chin_tucks', name: 'Retracciones de Barbilla', category: 'corrective'}
    ],
    'rounded_shoulders': [
      {id: 'shoulder_blade_squeezes', name: 'Compresión de Omóplatos', category: 'corrective'},
      {id: 'door_chest_stretch', name: 'Estiramiento de Pecho en Puerta', category: 'corrective'}
    ],
    'knee_valgus': [
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

// ✅ FUNCIÓN AUXILIAR: BALANCEAR SELECCIÓN DE EJERCICIOS
function balanceExerciseSelection({safe, goalSpecific, corrective, duration, intensity}) {
  const targetExerciseCount = Math.ceil(duration / 5); // ~5 min por ejercicio
  
  let selectedExercises = [];
  
  // Priorizar ejercicios correctivos (20%)
  const correctiveCount = Math.max(1, Math.floor(targetExerciseCount * 0.2));
  selectedExercises.push(...corrective.slice(0, correctiveCount));
  
  // Ejercicios específicos para objetivos (60%)
  const goalCount = Math.floor(targetExerciseCount * 0.6);
  selectedExercises.push(...goalSpecific.slice(0, goalCount));
  
  // Completar con ejercicios seguros (20%)
  const remainingSlots = targetExerciseCount - selectedExercises.length;
  selectedExercises.push(...safe.slice(0, remainingSlots));
  
  // Asignar parámetros específicos
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

// ✅ FUNCIONES AUXILIARES ADICIONALES
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
    'strength': 180, // 3 minutos
    'cardio': 300, // 5 minutos
    'flexibility': 120, // 2 minutos
    'corrective': 150, // 2.5 minutos
    'balance': 120 // 2 minutos
  };
  return durationMap[category] || 180;
}

function calculateRestTime(category, intensity) {
  if (category === 'strength') {
    return intensity === 'high' ? 90 : intensity === 'moderate' ? 60 : 45;
  }
  return 30; // Para otros tipos de ejercicio
}

function isAppropriateForLevel(exerciseDifficulty, userLevel) {
  const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
  const exerciseIndex = difficultyOrder.indexOf(exerciseDifficulty);
  const userIndex = difficultyOrder.indexOf(userLevel);
  
  // Permitir ejercicios del mismo nivel o inferior
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
  // Fórmula básica: MET * peso * tiempo
  const avgMET = 4.5; // MET promedio para ejercicios moderados
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
  
  return [...new Set(focusAreas)]; // Eliminar duplicados
}

function calculateAIConfidence(generatedRoutine, medicalHistory, errorAnalysis) {
  let confidence = 85; // Base confidence
  
  // Reducir confianza por limitaciones médicas complejas
  const limitations = [
    medicalHistory.currentInjuries,
    medicalHistory.forbiddenExercises,
    medicalHistory.movementLimitations
  ].filter(Boolean).length;
  
  confidence -= limitations * 5;
  
  // Reducir confianza por errores críticos recientes
  if (errorAnalysis.severity === 'high') {
    confidence -= 10;
  }
  
  // Aumentar confianza por ejercicios bien balanceados
  if (generatedRoutine.exercises.length >= 5 && generatedRoutine.adaptations.length > 0) {
    confidence += 5;
  }
  
  return Math.max(60, Math.min(95, confidence));
}

function shouldRequireTrainerApproval(adaptationLevel, aiConfidence, medicalHistory) {
  // Siempre requerir aprobación para adaptaciones extensas
  if (adaptationLevel === 'extensive') return true;
  
  // Requerir aprobación si la confianza es baja
  if (aiConfidence < 75) return true;
  
  // Requerir aprobación si hay lesiones actuales
  if (medicalHistory.currentInjuries && medicalHistory.currentInjuries.length > 0) return true;
  
  // Requerir aprobación si hay ejercicios prohibidos por médico
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

function calculateExpectedImprovement(commonErrors, priorityAreas) {
  return `Mejora esperada en ${commonErrors.length} tipos de errores y ${priorityAreas.length} áreas problemáticas en 2-4 semanas`;
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
        focusAreas: routine.routine.focusAreas
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

/**
 * Genera ejercicios de corrección basados en errores comunes
 * @param {Array} commonErrors - Errores más frecuentes
 * @return {Array} Ejercicios de corrección
 */
function generateCorrectionExercises(commonErrors) {
  const exerciseMap = {
    "KNEE_VALGUS": [
      "Sentadillas con banda",
      "Pasos laterales con resistencia",
      "Clamshells",
      "Puentes de glúteo",
    ],
    "ROUNDED_BACK": [
      "Superman",
      "Bird dog",
      "Plancha con extensión",
      "Estiramiento de pecho",
    ],
    "INSUFFICIENT_DEPTH": [
      "Sentadillas asistidas",
      "Movilidad de cadera",
      "Estiramiento de psoas",
      "Sentadillas con caja",
    ],
  };

  const exercises = [];
  commonErrors.forEach((error) => {
    const correctionExercises = exerciseMap[error.errorType] || [];
    exercises.push(...correctionExercises);
  });

  return [...new Set(exercises)];
}

/**
 * Calcula nivel de dificultad basado en perfil y errores
 * @param {Object} userProfile - Perfil del usuario
 * @param {Object} errorAnalysis - Análisis de errores
 * @return {string} Nivel de dificultad
 */
function calculateDifficultyLevel(userProfile, errorAnalysis) {
  const errorCount = errorAnalysis.commonErrors.length;
  const criticalCount = errorAnalysis.commonErrors
      .filter((e) => e.count > 3).length;

  if (criticalCount > 2 || errorCount > 10) return "beginner";
  if (criticalCount > 1 || errorCount > 5) return "intermediate";
  return userProfile && userProfile.fitnessLevel ?
         userProfile.fitnessLevel : "intermediate";
}

/**
 * Calcula métricas del usuario
 * @param {Object} userStats - Estadísticas del usuario
 * @param {Array} recentAlerts - Alertas recientes
 * @param {string} timeRange - Rango de tiempo
 * @return {Object} Métricas calculadas
 */
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
    criticalAlerts: filteredAlerts.filter((a) => a.severity === "critical")
        .length,
    improvementTrend: calculateImprovementTrend(filteredAlerts),
    mostCommonError: getMostCommonError(filteredAlerts),
    accuracyScore: calculateAccuracyScore(filteredAlerts),
    lastActivity: userStats.lastCriticalError,
    timeRange,
  };
}

/**
 * Calcula tendencia de mejora
 * @param {Array} alerts - Alertas filtradas
 * @return {string} Tendencia de mejora
 */
function calculateImprovementTrend(alerts) {
  if (alerts.length < 2) return "insufficient_data";

  const midpoint = Math.floor(alerts.length / 2);
  const firstHalf = alerts.slice(0, midpoint);
  const secondHalf = alerts.slice(midpoint);

  const firstHalfCritical = firstHalf
      .filter((a) => a.severity === "critical").length;
  const secondHalfCritical = secondHalf
      .filter((a) => a.severity === "critical").length;

  if (secondHalfCritical < firstHalfCritical) return "improving";
  if (secondHalfCritical > firstHalfCritical) return "declining";
  return "stable";
}

/**
 * Obtiene el error más común
 * @param {Array} alerts - Alertas filtradas
 * @return {string|null} Error más común
 */
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

/**
 * Calcula score de precisión
 * @param {Array} alerts - Alertas filtradas
 * @return {number} Score de precisión (0-100)
 */
function calculateAccuracyScore(alerts) {
  if (alerts.length === 0) return 100;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const totalCount = alerts.length;

  if (totalCount === 0) return 100;

  const criticalRate = criticalCount / totalCount;
  return Math.max(0, Math.round((1 - criticalRate) * 100));
}
