// functions/init-exercises.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const initialExercises = [
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
      'knee_pain': 'Pasos más cortos',
      'balance': 'Apoyo en pared',
      'beginner': 'Zancadas estáticas con apoyo'
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
      'back_pain': 'Sin peso, solo movimiento',
      'beginner': 'Sin peso, enfoque en técnica'
    },
    description: 'Ejercicio tracción para principiantes',
    isActive: true
  }
];

async function initializeExercises() {
  try {
    console.log('🎯 Iniciando poblado de base de datos...');
    console.log('👶 4 ejercicios nivel PRINCIPIANTE\n');

    let added = 0;

    for (const exercise of initialExercises) {
      try {
        const now = new Date();
        await db.collection('exercises').add({
          ...exercise,
          createdAt: now,
          updatedAt: now
        });

        console.log(`✅ ${exercise.displayName} → ${exercise.detectionType} [BEGINNER]`);
        added++;
      } catch (error) {
        console.error(`❌ Error: ${exercise.displayName}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RESUMEN: ${added} ejercicios agregados`);
    console.log(`👶 Nivel: BEGINNER`);
    console.log(`${'='.repeat(60)}\n`);

    if (added === 4) {
      console.log('🎉 ¡Perfecto! 4 ejercicios PRINCIPIANTES agregados\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('🚀 Iniciando script...\n');
initializeExercises();
