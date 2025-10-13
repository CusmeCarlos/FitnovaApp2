# 🏗️ Arquitectura del Sistema de Ejercicios Centralizado

## 📊 DIAGRAMA DE ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIRESTORE DATABASE                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Collection: exercises                                    │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  📄 Doc: squat_basic                               │  │  │
│  │  │    - name: "squats"                                │  │  │
│  │  │    - displayName: "Sentadillas"                    │  │  │
│  │  │    - hasPoseDetection: true                        │  │  │
│  │  │    - detectionType: "SQUATS"                       │  │  │
│  │  │    - category: "strength"                          │  │  │
│  │  │    - contraindications: ["knee_injury"]            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  📄 Doc: deadlift_basic                            │  │  │
│  │  │    - hasPoseDetection: true                        │  │  │
│  │  │    - detectionType: "DEADLIFTS"                    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  📄 Doc: walking_cardio                            │  │  │
│  │  │    - hasPoseDetection: false                       │  │  │
│  │  │    - category: "cardio"                            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ▲            ▲
                            │            │
                  ┌─────────┘            └─────────┐
                  │                                 │
      ┌───────────▼──────────┐          ┌──────────▼──────────┐
      │  CLOUD FUNCTIONS     │          │   ANGULAR APP       │
      │  (Backend)           │          │   (Frontend)        │
      │                      │          │                     │
      │  ┌────────────────┐  │          │  ┌───────────────┐ │
      │  │ exercise-      │  │          │  │ ExerciseService│ │
      │  │ database.js    │  │          │  │               │ │
      │  │                │  │          │  │ - load()      │ │
      │  │ - getSafe...() │  │          │  │ - filter()    │ │
      │  │ - getForGoals()│  │          │  │ - search()    │ │
      │  │ - mapGPT...()  │  │          │  │ - mapGPT()    │ │
      │  └────────────────┘  │          │  └───────────────┘ │
      │         ▲            │          │         ▲          │
      │         │            │          │         │          │
      │  ┌──────▼────────┐   │          │  ┌──────▼────────┐ │
      │  │ generateAI    │   │          │  │ Tab2Page      │ │
      │  │ Routine()     │   │          │  │               │ │
      │  │               │   │          │  │ - available   │ │
      │  │ 1. Query DB   │   │          │  │   Exercises   │ │
      │  │ 2. Send to GPT│   │          │  │ - current     │ │
      │  │ 3. Validate   │   │          │  │   Exercise    │ │
      │  │ 4. Map back   │   │          │  └───────────────┘ │
      │  └───────────────┘   │          │                     │
      │         ▲            │          │  ┌───────────────┐ │
      │         │            │          │  │ PoseCamera    │ │
      │         │            │          │  │               │ │
      │  ┌──────▼────────┐   │          │  │ - SQUATS      │ │
      │  │   GPT-4       │   │          │  │ - DEADLIFTS   │ │
      │  │               │   │          │  │ - LUNGES      │ │
      │  │ "Generate     │   │          │  │ - BARBELL_ROW │ │
      │  │  routine with │   │          │  └───────────────┘ │
      │  │  these:       │   │          │                     │
      │  │  - Sentadillas│   │          └─────────────────────┘
      │  │  - Zancadas   │   │
      │  │  - Caminata"  │   │
      │  └───────────────┘   │
      └──────────────────────┘
```

---

## 🔄 FLUJO DE DATOS DETALLADO

### 1️⃣ INICIALIZACIÓN DE LA APP

```
┌──────────────┐
│ App Start    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│ ExerciseService.constructor()    │
│ - Llama loadExercises()          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Firestore Query:                 │
│ exercises                         │
│   .where('isActive', '==', true) │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ BehaviorSubject actualizado      │
│ exercisesCache.next(exercises)   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Tab2Page.ngOnInit()              │
│ - loadExercisesWithDetection()   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Filtra ejercicios:               │
│ hasPoseDetection === true        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ availableExercises[] poblado     │
│ UI actualizada                   │
└──────────────────────────────────┘
```

### 2️⃣ GENERACIÓN DE RUTINA CON GPT

```
┌──────────────────┐
│ Usuario solicita │
│ nueva rutina     │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Cloud Function:                    │
│ generateAdaptiveRoutine()          │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Consultar Firestore:               │
│                                    │
│ 1. getSafeExercisesForProfile()   │
│    ├─ Filtrar por contraindicaciones
│    ├─ Filtrar por nivel fitness   │
│    └─ Retornar ejercicios seguros │
│                                    │
│ 2. getExercisesForGoals()         │
│    ├─ Filtrar por objetivo        │
│    └─ Retornar ejercicios objetivo│
│                                    │
│ 3. getCorrectiveExercises()       │
│    ├─ Filtrar por errores comunes│
│    └─ Retornar correctivos        │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Preparar prompt para GPT:          │
│                                    │
│ "EJERCICIOS DISPONIBLES:           │
│  - Sentadillas (strength) ✅       │
│  - Peso Muerto (strength) ✅       │
│  - Caminata (cardio) ⚪             │
│  - Plancha (strength) ⚪            │
│                                    │
│  USA SOLO ESTOS EJERCICIOS"        │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ GPT-4 genera rutina:               │
│                                    │
│ {                                  │
│   exercises: [                     │
│     {                              │
│       name: "Sentadillas",         │
│       sets: 3,                     │
│       reps: "10-12"                │
│     },                             │
│     {                              │
│       name: "Caminata Activa",     │
│       sets: 1,                     │
│       duration: 600                │
│     }                              │
│   ]                                │
│ }                                  │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Validar y enriquecer:              │
│                                    │
│ Para cada ejercicio de GPT:        │
│   1. mapGPTExerciseToSystem()     │
│      ├─ Buscar en Firestore       │
│      ├─ Match exacto/fuzzy        │
│      └─ Retornar Exercise completo│
│                                    │
│   2. Agregar metadata:             │
│      ├─ exerciseId                 │
│      ├─ hasPoseDetection           │
│      ├─ detectionType              │
│      └─ targetMuscles              │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Rutina final validada:             │
│                                    │
│ {                                  │
│   exercises: [                     │
│     {                              │
│       name: "Sentadillas",         │
│       exerciseId: "squat_basic",   │
│       hasPoseDetection: true,      │
│       detectionType: "SQUATS"      │
│     },                             │
│     {                              │
│       name: "Caminata Activa",     │
│       exerciseId: "walking_cardio",│
│       hasPoseDetection: false      │
│     }                              │
│   ]                                │
│ }                                  │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Guardar en Firestore:              │
│ aiRoutines/{uid}/routines/{id}    │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Usuario recibe rutina              │
│ ✅ Con detección: activa cámara    │
│ ⚪ Sin detección: timer manual     │
└────────────────────────────────────┘
```

### 3️⃣ EJECUCIÓN DE EJERCICIO

```
┌──────────────────┐
│ Usuario selecciona│
│ ejercicio        │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Tab2Page verifica:                 │
│ ¿exercise.hasPoseDetection?        │
└────────┬───────────────────────────┘
         │
    ┌────┴────┐
    │         │
   SI        NO
    │         │
    ▼         ▼
┌──────┐  ┌──────────────────┐
│ ✅    │  │ ⚪ Timer manual  │
│Camera│  │    + contador    │
│      │  │    repeticiones  │
│Pose  │  └──────────────────┘
│Det.  │
│      │
│Send  │
│type: │
│SQUATS│
└──────┘
    │
    ▼
┌──────────────────────────────────┐
│ PoseCameraComponent              │
│ - Activa MediaPipe               │
│ - Detecta pose                   │
│ - Analiza biomecánica            │
│ - Emite errores posturales       │
└──────────────────────────────────┘
```

---

## 🔍 MAPEO DE NOMBRES GPT → SISTEMA

### Estrategia de Mapeo (3 niveles)

```
┌─────────────────────────────────────────┐
│  1. MATCH EXACTO                        │
│                                         │
│  GPT: "Sentadillas"                     │
│  BD:  "Sentadillas" (displayName)       │
│  ✅ Score: 1.0                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  2. MATCH PARCIAL                       │
│                                         │
│  GPT: "Sentadilla Básica"               │
│  BD:  "Sentadillas" (displayName)       │
│  ✅ Score: 0.8 (contains)               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  3. MATCH POR PALABRAS CLAVE            │
│                                         │
│  GPT: "Caminata ligera activa"          │
│  Words: ["caminata", "ligera", "activa"]│
│  BD:  "Caminata Activa"                 │
│  Words: ["caminata", "activa"]          │
│  Match: 2/3 = 0.66                      │
│  ✅ Score: 0.6 (weighted)               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  4. NO MATCH                            │
│                                         │
│  GPT: "Flexiones diamante"              │
│  BD:  No existe                         │
│  ❌ Score: 0.0                          │
│  → Ejercicio excluido de rutina         │
└─────────────────────────────────────────┘
```

### Ejemplo Completo de Mapeo

```javascript
// GPT responde con:
[
  "Sentadilla Básica",    → ✅ "Sentadillas" (SQUATS)
  "Peso muerto",          → ✅ "Peso Muerto Libre" (DEADLIFTS)
  "Caminata de 15 min",   → ✅ "Caminata Activa" (no detection)
  "Flexiones diamante"    → ❌ No encontrado, excluido
]

// Rutina final:
[
  {
    name: "Sentadillas",
    exerciseId: "squat_basic",
    hasPoseDetection: true,
    detectionType: "SQUATS"
  },
  {
    name: "Peso Muerto Libre",
    exerciseId: "deadlift_basic",
    hasPoseDetection: true,
    detectionType: "DEADLIFTS"
  },
  {
    name: "Caminata Activa",
    exerciseId: "walking_cardio",
    hasPoseDetection: false
  }
  // "Flexiones diamante" fue excluido
]
```

---

## 📦 COMPONENTES DEL SISTEMA

### 1. **ExerciseService** (Frontend)

```typescript
class ExerciseService {
  // Observable con todos los ejercicios
  exercises$: Observable<Exercise[]>

  // Métodos principales
  getExercises(filters?: ExerciseFilters)
  getExercisesWithDetection()
  getExerciseById(id: string)
  searchExerciseByName(name: string)
  mapGPTExerciseToSystem(gptName: string)
  getSafeExercisesForProfile(painful, forbidden, level)
}
```

### 2. **exercise-database.js** (Backend)

```javascript
module.exports = {
  // Obtener ejercicios seguros
  getSafeExercisesForProfile(medicalHistory, fitnessLevel),

  // Obtener por objetivos
  getExercisesForGoals(primaryGoals, fitnessLevel),

  // Obtener correctivos
  getCorrectiveExercises(commonErrors, priorityAreas),

  // Mapeo de GPT
  mapGPTExerciseToSystem(gptExerciseName),

  // Validación de rutina GPT
  validateAndEnhanceGPTRoutineFromDB(gptRoutine, medicalHistory)
}
```

### 3. **init-exercises.js** (Script)

```javascript
// Script one-time para inicializar BD
const initialExercises = [
  { name: "squats", hasPoseDetection: true, detectionType: "SQUATS" },
  { name: "deadlifts", hasPoseDetection: true, detectionType: "DEADLIFTS" },
  { name: "lunges", hasPoseDetection: true, detectionType: "LUNGES" },
  { name: "barbell_row", hasPoseDetection: true, detectionType: "BARBELL_ROW" },
  { name: "walking", hasPoseDetection: false },
  // ... más ejercicios
]

initializeExercises()
```

---

## 🔐 REGLAS DE SEGURIDAD FIRESTORE

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ✅ Ejercicios: Solo lectura para autenticados
    match /exercises/{exerciseId} {
      // Todos pueden leer
      allow read: if request.auth != null;

      // Solo admin puede escribir (vía Cloud Functions)
      allow write: if false;
    }

    // ✅ Rutinas: Usuario solo ve sus propias rutinas
    match /aiRoutines/{userId}/routines/{routineId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // Solo Cloud Functions
    }
  }
}
```

---

## 🎯 VENTAJAS DEL SISTEMA

### ✅ ANTES (Hardcoded)

```typescript
// Backend
const exercises = [
  { name: "Sentadilla", category: "strength" },
  { name: "Flexiones", category: "strength" }
]

// Frontend
const exercises = [
  { type: SQUATS, name: "Sentadillas" },
  { type: DEADLIFTS, name: "Peso Muerto" }
]

// Problema: Dos fuentes de verdad diferentes
// GPT puede sugerir "Flexiones" pero frontend no las detecta
```

### ✅ AHORA (Centralizado)

```
Firestore (exercises)
    ↓
┌───┴────┐
│        │
Backend  Frontend
    ↓        ↓
   GPT    Tab2Page
    ↓        ↓
  Rutina → Usuario

✅ Una sola fuente de verdad
✅ GPT solo sugiere lo que existe
✅ Frontend sabe qué tiene detección
✅ Mapeo automático entre sistemas
```

---

## 🚀 ESCALABILIDAD

### Agregar Nuevo Ejercicio

```
1. Crear documento en Firestore:
   {
     name: "pushups",
     displayName: "Flexiones",
     hasPoseDetection: false,  // Aún no implementado
     category: "strength"
   }

2. GPT automáticamente lo incluirá en próximas rutinas

3. Cuando implementes detección:
   a. Agregar PUSHUPS a ExerciseType enum
   b. Implementar detector en BiomechanicsAnalyzer
   c. Actualizar documento:
      hasPoseDetection: true
      detectionType: "PUSHUPS"

4. ¡Listo! Sin cambios en código de generación de rutinas
```

### Agregar Nueva Categoría

```
1. Agregar a enum ExerciseCategory:
   MOBILITY = 'mobility'

2. Crear ejercicios con esa categoría en Firestore

3. GPT automáticamente los usará para objetivos de movilidad
```

---

**Sistema completamente desacoplado, escalable y mantenible! 🎉**
