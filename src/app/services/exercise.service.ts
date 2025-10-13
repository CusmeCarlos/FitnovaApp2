// src/app/services/exercise.service.ts
// 🎯 SERVICIO DE GESTIÓN DE EJERCICIOS CENTRALIZADO

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
  Exercise,
  ExerciseFilters,
  ExerciseSearchResult,
  RoutineExercise
} from '../interfaces/exercise.interface';
import { ExerciseType } from '../shared/models/pose.models';

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private db = firebase.firestore();
  private exercisesCache = new BehaviorSubject<Exercise[]>([]);
  public exercises$ = this.exercisesCache.asObservable();

  constructor() {
    console.log('🎯 ExerciseService inicializado');
    this.loadExercises();
  }

  /**
   * Cargar todos los ejercicios desde Firestore
   */
  private loadExercises(): void {
    this.db.collection('exercises')
      .where('isActive', '==', true)
      .onSnapshot(
        (snapshot) => {
          const exercises: Exercise[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Exercise));

          console.log('✅ Ejercicios cargados:', exercises.length);
          this.exercisesCache.next(exercises);
        },
        (error) => {
          console.error('❌ Error cargando ejercicios:', error);
        }
      );
  }

  /**
   * Obtener ejercicios con filtros
   */
  getExercises(filters?: ExerciseFilters): Observable<Exercise[]> {
    return this.exercises$.pipe(
      map(exercises => {
        if (!filters) return exercises;

        return exercises.filter(ex => {
          // Filtrar por categoría
          if (filters.category && ex.category !== filters.category) {
            return false;
          }

          // Filtrar por dificultad
          if (filters.difficulty && !filters.difficulty.includes(ex.difficulty)) {
            return false;
          }

          // Filtrar por detección de postura
          if (filters.hasPoseDetection !== undefined &&
              ex.hasPoseDetection !== filters.hasPoseDetection) {
            return false;
          }

          // Filtrar por equipo
          if (filters.equipment && filters.equipment.length > 0) {
            const hasRequiredEquipment = filters.equipment.every(eq =>
              ex.equipment.includes(eq)
            );
            if (!hasRequiredEquipment) return false;
          }

          // Excluir contraindicaciones
          if (filters.excludeContraindications &&
              filters.excludeContraindications.length > 0) {
            const hasContraindication = filters.excludeContraindications.some(contra =>
              ex.contraindications.includes(contra)
            );
            if (hasContraindication) return false;
          }

          // Filtrar por músculos objetivo
          if (filters.targetMuscles && filters.targetMuscles.length > 0) {
            const targetsRequiredMuscles = filters.targetMuscles.some(muscle =>
              ex.targetMuscles.includes(muscle)
            );
            if (!targetsRequiredMuscles) return false;
          }

          return true;
        });
      })
    );
  }

  /**
   * Obtener solo ejercicios con detección de postura
   */
  getExercisesWithDetection(): Observable<Exercise[]> {
    return this.getExercises({ hasPoseDetection: true });
  }

  /**
   * Obtener ejercicio por ID
   */
  getExerciseById(id: string): Observable<Exercise | null> {
    return this.exercises$.pipe(
      map(exercises => exercises.find(ex => ex.id === id) || null)
    );
  }

  /**
   * Buscar ejercicio por nombre (fuzzy matching)
   */
  searchExerciseByName(name: string): Observable<ExerciseSearchResult[]> {
    const searchTerm = name.toLowerCase().trim();

    return this.exercises$.pipe(
      map(exercises => {
        const results: ExerciseSearchResult[] = [];

        exercises.forEach(exercise => {
          const exerciseName = exercise.name.toLowerCase();
          const displayName = exercise.displayName.toLowerCase();

          // Coincidencia exacta
          if (exerciseName === searchTerm || displayName === searchTerm) {
            results.push({
              exercise,
              matchScore: 1.0,
              matchedBy: 'exact'
            });
            return;
          }

          // Coincidencia parcial
          if (exerciseName.includes(searchTerm) || displayName.includes(searchTerm)) {
            results.push({
              exercise,
              matchScore: 0.8,
              matchedBy: 'fuzzy'
            });
            return;
          }

          // Coincidencia por palabras clave
          const searchWords = searchTerm.split(' ');
          const nameWords = exerciseName.split(' ');
          const matchingWords = searchWords.filter(word =>
            nameWords.some(nw => nw.includes(word) || word.includes(nw))
          );

          if (matchingWords.length > 0) {
            const score = matchingWords.length / searchWords.length;
            if (score >= 0.5) {
              results.push({
                exercise,
                matchScore: score * 0.6,
                matchedBy: 'fuzzy'
              });
            }
          }
        });

        // Ordenar por score
        return results.sort((a, b) => b.matchScore - a.matchScore);
      })
    );
  }

  /**
   * Mapear ejercicio de GPT a ejercicio del sistema
   */
  mapGPTExerciseToSystem(gptExerciseName: string): Observable<Exercise | null> {
    return this.searchExerciseByName(gptExerciseName).pipe(
      map(results => {
        if (results.length === 0) {
          console.warn(`⚠️ No se encontró mapeo para: ${gptExerciseName}`);
          return null;
        }

        const bestMatch = results[0];
        console.log(`✅ Mapeado "${gptExerciseName}" → "${bestMatch.exercise.displayName}" (score: ${bestMatch.matchScore})`);
        return bestMatch.exercise;
      })
    );
  }

  /**
   * Validar que un ejercicio de rutina tenga detección
   */
  hasDetection(exercise: RoutineExercise): boolean {
    return !!exercise.hasPoseDetection && !!exercise.detectionType;
  }

  /**
   * Obtener ejercicios seguros para un perfil médico
   */
  getSafeExercisesForProfile(
    painfulAreas: string[],
    forbiddenExercises: string[],
    fitnessLevel: string
  ): Observable<Exercise[]> {
    return this.exercises$.pipe(
      map(exercises => {
        return exercises.filter(exercise => {
          // Filtrar por contraindicaciones
          const hasContraindication = exercise.contraindications.some(contra =>
            painfulAreas.some(area => contra.includes(area))
          );

          if (hasContraindication) return false;

          // Filtrar por ejercicios prohibidos
          const isForbidden = forbiddenExercises.some(forbidden =>
            exercise.name.toLowerCase().includes(forbidden.toLowerCase()) ||
            exercise.displayName.toLowerCase().includes(forbidden.toLowerCase())
          );

          if (isForbidden) return false;

          // Filtrar por nivel de dificultad apropiado
          const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
          const exerciseLevel = difficultyOrder.indexOf(exercise.difficulty);
          const userLevel = difficultyOrder.indexOf(fitnessLevel);

          if (exerciseLevel > userLevel) return false;

          return true;
        });
      })
    );
  }

  /**
   * Obtener ejercicios por tipo de detección
   */
  getExercisesByDetectionType(type: ExerciseType): Observable<Exercise[]> {
    return this.exercises$.pipe(
      map(exercises =>
        exercises.filter(ex => ex.hasPoseDetection && ex.detectionType === type)
      )
    );
  }

  /**
   * Obtener lista de ejercicios para enviar a GPT
   */
  getExerciseListForGPT(): Observable<string> {
    return this.exercises$.pipe(
      map(exercises => {
        const exerciseList = exercises
          .filter(ex => ex.isActive)
          .map(ex => {
            const detection = ex.hasPoseDetection ? '✅ Con detección' : '⚪ Sin detección';
            return `- ${ex.displayName} (${ex.category}, ${ex.difficulty}) ${detection}`;
          })
          .join('\n');

        return `EJERCICIOS DISPONIBLES EN EL SISTEMA:\n${exerciseList}`;
      })
    );
  }

  /**
   * Crear nuevo ejercicio (solo admin)
   */
  async createExercise(exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const docRef = await this.db.collection('exercises').add({
        ...exercise,
        createdAt: now,
        updatedAt: now
      });

      console.log('✅ Ejercicio creado:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creando ejercicio:', error);
      throw error;
    }
  }

  /**
   * Actualizar ejercicio (solo admin)
   */
  async updateExercise(id: string, updates: Partial<Exercise>): Promise<void> {
    try {
      await this.db.collection('exercises').doc(id).update({
        ...updates,
        updatedAt: new Date()
      });

      console.log('✅ Ejercicio actualizado:', id);
    } catch (error) {
      console.error('❌ Error actualizando ejercicio:', error);
      throw error;
    }
  }
}
