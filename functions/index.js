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

// 🏥 FUNCIÓN - GENERAR RUTINA ADAPTATIVA
exports.generateAdaptiveRoutine = onCall(async (request) => {
  try {
    const {data} = request;
    const {uid, userProfile, preferences} = data;

    if (!request.auth || request.auth.uid !== uid) {
      throw new HttpsError("permission-denied", "No autorizado");
    }

    logger.info("🏥 Generando rutina adaptativa:", uid);

    // ✅ ANALIZAR HISTORIAL DE ERRORES RECIENTES
    const errorsSnapshot = await db.collection("criticalAlerts")
        .where("uid", "==", uid)
        .where("severity", "in", ["high", "critical"])
        .orderBy("processedAt", "desc")
        .limit(20)
        .get();

    const recentErrors = errorsSnapshot.docs.map((doc) => doc.data());
    const errorAnalysis = analyzeUserErrors(recentErrors);

    // ✅ GENERAR RUTINA PERSONALIZADA
    const adaptiveRoutine = {
      userId: uid,
      generatedAt: new Date(),
      basedOnErrors: errorAnalysis.commonErrors,
      correctionFocus: errorAnalysis.priorityAreas,
      exercises: generateCorrectionExercises(errorAnalysis.commonErrors),
      duration: preferences ? preferences.duration : 30,
      difficulty: calculateDifficultyLevel(userProfile, errorAnalysis),
      sessions: preferences ? preferences.sessionsPerWeek : 3,
      status: "pending_trainer_approval",
      needsTrainerReview: true,
      adaptationReason: errorAnalysis.reasoning,
      estimatedImprovement: errorAnalysis.expectedImprovement,
    };

    // ✅ GUARDAR RUTINA GENERADA
    const routineRef = await db.collection("generatedRoutines")
        .add(adaptiveRoutine);

    // ✅ CREAR NOTIFICACIÓN PARA ENTRENADOR
    await db.collection("trainerNotifications").add({
      type: "routine_approval_needed",
      userId: uid,
      routineId: routineRef.id,
      userDisplayName: userProfile ? userProfile.displayName : "Usuario",
      message: "Nueva rutina adaptativa generada requiere aprobación",
      priority: "medium",
      createdAt: new Date(),
      status: "pending",
    });

    return {
      success: true,
      routineId: routineRef.id,
      routine: adaptiveRoutine,
      message: "Rutina generada, esperando aprobación del entrenador",
    };
  } catch (error) {
    logger.error("🛑 Error generando rutina:", error);
    throw new HttpsError("internal", "Error generando rutina: " +
                         error.message);
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
function analyzeUserErrors(errors) {
  const errorCounts = {};
  const exerciseCounts = {};

  errors.forEach((error) => {
    errorCounts[error.errorType] = (errorCounts[error.errorType] || 0) + 1;
    exerciseCounts[error.exercise] = (exerciseCounts[error.exercise] || 0) + 1;
  });

  const commonErrors = Object.entries(errorCounts)
      .map(([errorType, count]) => ({errorType, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

  const problematicExercises = Object.entries(exerciseCounts)
      .map(([exercise, count]) => ({exercise, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);

  return {
    commonErrors,
    problematicExercises,
    priorityAreas: commonErrors.map((e) => e.errorType),
    reasoning: `Basado en ${errors.length} errores recientes`,
    expectedImprovement: "15-30% en 4 semanas",
  };
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
