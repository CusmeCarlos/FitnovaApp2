// functions/clean-exercises.js
// 🧹 SCRIPT PARA LIMPIAR EJERCICIOS DUPLICADOS EN FIRESTORE

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Limpiar todos los ejercicios y dejar solo los 4 correctos
 */
async function cleanExercises() {
  try {
    console.log('🧹 Iniciando limpieza de ejercicios duplicados...\n');

    // 1. OBTENER TODOS LOS EJERCICIOS
    const exercisesSnapshot = await db.collection('exercises').get();
    console.log(`📊 Total de ejercicios encontrados: ${exercisesSnapshot.size}\n`);

    if (exercisesSnapshot.empty) {
      console.log('⚠️  No hay ejercicios en la base de datos');
      process.exit(0);
    }

    // 2. ELIMINAR TODOS LOS EJERCICIOS
    console.log('🗑️  Eliminando todos los ejercicios...');
    const batch = db.batch();
    let deleteCount = 0;

    exercisesSnapshot.docs.forEach(doc => {
      console.log(`   ❌ Eliminando: ${doc.data().displayName || doc.data().name} (ID: ${doc.id})`);
      batch.delete(doc.ref);
      deleteCount++;
    });

    await batch.commit();
    console.log(`\n✅ ${deleteCount} ejercicios eliminados exitosamente\n`);

    // 3. ESPERAR 2 SEGUNDOS
    console.log('⏳ Esperando 2 segundos antes de recrear...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. CREAR LOS 4 EJERCICIOS CORRECTOS
    console.log('➕ Creando los 4 ejercicios con detección (nivel principiante)...\n');

    const correctExercises = [
      {
        name: 'squats',
        displayName: 'Sentadillas',
        category: 'strength',
        targetMuscles: ['quadriceps', 'glutes', 'hamstrings', 'core'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        hasPoseDetection: true,
        detectionType: 'SQUATS',
        contraindications: ['knee_injury', 'hip_injury', 'ankle_injury'],
        modifications: {
          'knee_pain': 'Reducir profundidad, usar silla de apoyo',
          'back_pain': 'Sentadillas contra la pared',
          'beginner': 'Comenzar con sentadillas poco profundas'
        },
        description: 'Ejercicio fundamental para principiantes',
        isActive: true
      },
      {
        name: 'deadlifts',
        displayName: 'Peso Muerto Libre',
        category: 'strength',
        targetMuscles: ['hamstrings', 'glutes', 'lower_back', 'traps'],
        equipment: ['bodyweight', 'light_weights'],
        difficulty: 'beginner',
        hasPoseDetection: true,
        detectionType: 'DEADLIFTS',
        contraindications: ['lower_back_injury', 'herniated_disc', 'hip_injury'],
        modifications: {
          'back_pain': 'Sin peso, solo movimiento',
          'beginner': 'Practicar sin peso, enfoque en técnica'
        },
        description: 'Versión principiantes: patrón bisagra de cadera',
        isActive: true
      },
      {
        name: 'lunges',
        displayName: 'Zancadas',
        category: 'strength',
        targetMuscles: ['quadriceps', 'glutes', 'hamstrings', 'core'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        hasPoseDetection: true,
        detectionType: 'LUNGES',
        contraindications: ['knee_injury', 'hip_injury', 'balance_issues'],
        modifications: {
          'knee_pain': 'Reducir amplitud, pasos cortos',
          'balance': 'Apoyarse en pared',
          'beginner': 'Zancadas estáticas, usar apoyo'
        },
        description: 'Ejercicio unilateral para principiantes',
        isActive: true
      },
      {
        name: 'barbell_row',
        displayName: 'Remo con Barra',
        category: 'strength',
        targetMuscles: ['lats', 'rhomboids', 'traps', 'biceps'],
        equipment: ['bodyweight', 'light_bar'],
        difficulty: 'beginner',
        hasPoseDetection: true,
        detectionType: 'BARBELL_ROW',
        contraindications: ['lower_back_injury', 'shoulder_injury'],
        modifications: {
          'back_pain': 'Movimiento sin peso',
          'shoulder_pain': 'Reducir rango',
          'beginner': 'Sin peso, enfoque en técnica'
        },
        description: 'Ejercicio para principiantes: tracción',
        isActive: true
      }
    ];

    let addedCount = 0;
    for (const exercise of correctExercises) {
      const now = new Date();
      await db.collection('exercises').add({
        ...exercise,
        createdAt: now,
        updatedAt: now
      });
      console.log(`   ✅ ${exercise.displayName} → ${exercise.detectionType} [BEGINNER]`);
      addedCount++;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 RESUMEN FINAL:');
    console.log(`   🗑️  Ejercicios eliminados: ${deleteCount}`);
    console.log(`   ➕ Ejercicios creados: ${addedCount}`);
    console.log(`   ✅ Estado: LIMPIO - Solo 4 ejercicios con detección`);
    console.log(`${'='.repeat(70)}`);

    console.log('\n🎉 Base de datos limpia exitosamente!');
    console.log('🔍 Verifica en Firebase Console → Firestore → "exercises"\n');
    console.log('💡 Deberías ver EXACTAMENTE 4 documentos:\n');
    correctExercises.forEach((ex, i) => {
      console.log(`   ${i + 1}. ${ex.displayName} (${ex.detectionType})`);
    });
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error);
    console.error('\nPosibles causas:');
    console.error('  - serviceAccountKey.json no encontrado');
    console.error('  - Credenciales inválidas');
    console.error('  - Sin conexión a internet\n');
    process.exit(1);
  }
}

console.log('🚀 Iniciando script de limpieza...\n');
cleanExercises();
