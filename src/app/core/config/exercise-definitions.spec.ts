// src/app/core/config/exercise-definitions.spec.ts
import { EXERCISE_DEFINITIONS, BIOMECHANICAL_THRESHOLDS } from './exercise-definitions';
import { ExerciseType, PostureErrorType } from '../../shared/models/pose.models';

describe('Exercise Definitions', () => {
  
  it('should have definitions for all exercise types', () => {
    const exerciseTypes = Object.values(ExerciseType);
    
    exerciseTypes.forEach(type => {
      expect(EXERCISE_DEFINITIONS[type]).toBeDefined();
      expect(EXERCISE_DEFINITIONS[type].type).toBe(type);
    });
  });

  it('should have valid biomechanical thresholds', () => {
    Object.values(BIOMECHANICAL_THRESHOLDS).forEach(thresholdGroup => {
      Object.values(thresholdGroup).forEach(threshold => {
        expect(threshold.min).toBeLessThan(threshold.max);
        expect(threshold.ideal).toBeGreaterThanOrEqual(threshold.min);
        expect(threshold.ideal).toBeLessThanOrEqual(threshold.max);
    
        if ('critical' in threshold) {
          expect(threshold.critical).toBeDefined();
        }
      });
    });
  });

  it('should have error detection rules for each exercise', () => {
    Object.values(EXERCISE_DEFINITIONS).forEach(exercise => {
      expect(exercise.errorDetectionRules).toBeDefined();
      expect(Array.isArray(exercise.errorDetectionRules)).toBe(true);
      
      exercise.errorDetectionRules.forEach(rule => {
        expect(rule.errorType).toBeDefined();
        expect(Object.values(PostureErrorType)).toContain(rule.errorType);
        expect(rule.threshold).toEqual(jasmine.any(Number));
        expect(rule.severity).toBeGreaterThan(0);
        expect(rule.severity).toBeLessThanOrEqual(10);
        expect(rule.message).toBeTruthy();
        expect(rule.recommendation).toBeTruthy();
      });
    });
  });

  it('should have proper scientific validation data', () => {
    Object.values(EXERCISE_DEFINITIONS).forEach(exercise => {
      if (exercise.scientificValidation) {
        expect(exercise.scientificValidation.referenceStudy).toBeTruthy();
        expect(exercise.scientificValidation.validationAccuracy).toBeGreaterThan(0);
        expect(exercise.scientificValidation.validationAccuracy).toBeLessThanOrEqual(1);
        expect(exercise.scientificValidation.sampleSize).toBeGreaterThan(0);
      }
    });
  });
});