# Índices Compuestos para Firestore

## Instrucciones para configurar índices

Para que las consultas de historial funcionen correctamente, necesitas crear los siguientes índices compuestos en Firestore:

### 1. Índice para `workoutSessions`

**Colección:** `workoutSessions`
**Campos a indexar:**
- `uid` (Ascending)
- `date` (Descending)

**Cómo crearlo:**

#### Opción 1: Desde la consola de Firebase
1. Ve a Firebase Console → Firestore Database
2. Ve a la pestaña "Indexes" (Índices)
3. Click en "Create Index" (Crear índice)
4. Configura:
   - Collection ID: `workoutSessions`
   - Fields to index:
     - Field: `uid`, Order: `Ascending`
     - Field: `date`, Order: `Descending`
5. Query scope: `Collection`
6. Click "Create"

#### Opción 2: Desde el código (automático)
Cuando ejecutes la app y veas el historial, Firestore te mostrará un error con un enlace directo para crear el índice. Solo haz click en ese enlace.

### 2. Índice para `criticalAlerts` (ya debería existir)

**Colección:** `criticalAlerts`
**Campos a indexar:**
- `uid` (Ascending)
- `processedAt` (Descending)

---

## Reglas de seguridad recomendadas

También asegúrate de tener las siguientes reglas de seguridad en Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Reglas para workoutSessions
    match /workoutSessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }

    // Reglas para userStats
    match /userStats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Reglas para criticalAlerts
    match /criticalAlerts/{alertId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
```

---

## Verificación

Una vez configurados los índices, verifica que funcionan:

1. Abre la app
2. Completa un entrenamiento
3. Ve al Dashboard (Tab1)
4. Click en "Ver Historial"
5. Deberías ver las sesiones con **repeticiones reales** (no genéricas)

---

## Estructura de datos en Firestore

### `workoutSessions/{sessionId}`
```javascript
{
  uid: "user_id",
  sessionId: "session_xxx",
  exercise: "Sentadillas",
  date: Timestamp,
  durationSeconds: 120,
  repetitions: 15,        // ← REPETICIONES REALES
  errorsCount: 2,
  accuracy: 87,
  totalCorrections: 15,
  createdAt: Timestamp
}
```

### `userStats/{userId}`
```javascript
{
  uid: "user_id",
  totalWorkouts: 5,
  totalHours: 0.5,
  lastSessionRepetitions: 15,  // ← ÚLTIMO VALOR REAL
  lastSessionDurationSeconds: 120,
  averageAccuracy: 85,
  // ... otros campos
}
```
