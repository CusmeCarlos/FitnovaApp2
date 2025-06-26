// src/app/core/integration.spec.ts
import { TestBed } from '@angular/core/testing';
import { PoseDetectionEngine } from './pose-engine/pose-detection.engine';
import { EnhancedBiomechanicsAnalyzer } from './pose-engine/biomechanics.analyzer.enhanced.ts.backup';
import { PrecisionValidator } from './pose-engine/precision-validator';
import { ExerciseType } from '../shared/models/pose.models';

describe('Core Integration Tests', () => {
  let poseEngine: PoseDetectionEngine;
  let analyzer: EnhancedBiomechanicsAnalyzer;
  let validator: PrecisionValidator;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PoseDetectionEngine,
        EnhancedBiomechanicsAnalyzer,
        PrecisionValidator
      ]
    });

    poseEngine = TestBed.inject(PoseDetectionEngine);
    analyzer = new EnhancedBiomechanicsAnalyzer();
    validator = new PrecisionValidator();

    // Mock MediaPipe
    (window as any).Pose = jasmine.createSpy('Pose').and.returnValue({
      setOptions: jasmine.createSpy('setOptions').and.returnValue(Promise.resolve()),
      onResults: jasmine.createSpy('onResults')
    });
  });

  it('should integrate pose detection with biomechanics analysis', async () => {
    // Configurar ejercicio
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    // Mock pose data
    const mockPose = {
      left_knee: { x: 0.3, y: 0.8, z: 0, visibility: 0.8 },
      right_knee: { x: 0.7, y: 0.8, z: 0, visibility: 0.8 }
    } as any;

    const mockAngles = {
      left_knee_angle: 90,
      right_knee_angle: 90
    };

    // Analizar frame
    const result = analyzer.analyzeFrame(mockPose, mockAngles);
    
    expect(result).toBeDefined();
    expect(result.errors).toEqual(jasmine.any(Array));
    expect(result.qualityScore).toEqual(jasmine.any(Number));
  });

  it('should validate precision across the system', () => {
    validator.startValidation();
    
    // Simular múltiples frames para validación
    for (let i = 0; i < 50; i++) {
      const mockPose = {
        left_shoulder: { x: 0.3 + (Math.random() * 0.01), y: 0.3, z: 0, visibility: 0.9 }
      } as any;
      
      const mockAngles = {
        left_knee_angle: 90 + (Math.random() * 2)
      };
      
      validator.validateFrame(mockPose, mockAngles, performance.now());
    }
    
    const report = validator.getValidationReport();
    
    expect(report.precision.overallPrecision).toBeGreaterThan(0);
    expect(report.isWithinTargets).toEqual(jasmine.any(Boolean));
  });

  it('should handle errors gracefully throughout the system', () => {
    // Test error handling en analyzer
    expect(() => {
      analyzer.analyzeFrame(null as any, null as any);
    }).not.toThrow();

    // Test error handling en validator
    expect(() => {
      validator.validateFrame(null as any, null as any, 0);
    }).not.toThrow();

    // Test cleanup
    expect(() => {
      analyzer.cleanup();
      validator.cleanup();
    }).not.toThrow();
  });
});
