// src/app/core/pose-engine/biomechanics.analyzer.enhanced.spec.ts
import { TestBed } from '@angular/core/testing';
import { EnhancedBiomechanicsAnalyzer } from './biomechanics.analyzer.enhanced.ts.backup';
import { ExerciseType, PoseKeypoints, BiomechanicalAngles, PostureErrorType } from '../../shared/models/pose.models';

describe('EnhancedBiomechanicsAnalyzer', () => {
  let analyzer: EnhancedBiomechanicsAnalyzer;
  let mockPose: PoseKeypoints;
  let mockAngles: BiomechanicalAngles;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    analyzer = new EnhancedBiomechanicsAnalyzer();
    
    // Mock pose data
    mockPose = {
      nose: { x: 0.5, y: 0.2, z: 0, visibility: 0.9 },
      left_shoulder: { x: 0.3, y: 0.3, z: 0, visibility: 0.9 },
      right_shoulder: { x: 0.7, y: 0.3, z: 0, visibility: 0.9 },
      left_elbow: { x: 0.2, y: 0.5, z: 0, visibility: 0.8 },
      right_elbow: { x: 0.8, y: 0.5, z: 0, visibility: 0.8 },
      left_hip: { x: 0.3, y: 0.6, z: 0, visibility: 0.9 },
      right_hip: { x: 0.7, y: 0.6, z: 0, visibility: 0.9 },
      left_knee: { x: 0.3, y: 0.8, z: 0, visibility: 0.8 },
      right_knee: { x: 0.7, y: 0.8, z: 0, visibility: 0.8 },
      left_ankle: { x: 0.3, y: 1.0, z: 0, visibility: 0.7 },
      right_ankle: { x: 0.7, y: 1.0, z: 0, visibility: 0.7 }
    } as PoseKeypoints;

    mockAngles = {
      left_knee_angle: 90,
      right_knee_angle: 92,
      left_hip_angle: 85,
      right_hip_angle: 87,
      spine_angle: 85,
      left_elbow_angle: 170,
      right_elbow_angle: 168
    };
  });

  it('should be created', () => {
    expect(analyzer).toBeTruthy();
  });

  it('should set exercise type correctly', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    expect((analyzer as any).currentExercise).toBe(ExerciseType.SQUATS);
  });

  it('should analyze frame and return results', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    const result = analyzer.analyzeFrame(mockPose, mockAngles);
    
    expect(result).toBeDefined();
    expect(result.errors).toEqual(jasmine.any(Array));
    expect(result.phase).toBeDefined();
    expect(result.repetitionCount).toEqual(jasmine.any(Number));
    expect(result.qualityScore).toEqual(jasmine.any(Number));
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  it('should detect knee valgus error', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    // Simular rodillas muy juntas (valgus)
    const valgusAngles = {
      ...mockAngles,
      left_knee_angle: 60,  // Ángulo crítico
      right_knee_angle: 58
    };

    const valgusPose = {
      ...mockPose,
      left_knee: { x: 0.45, y: 0.8, z: 0, visibility: 0.8 },  // Rodillas muy juntas
      right_knee: { x: 0.55, y: 0.8, z: 0, visibility: 0.8 }
    };

    const result = analyzer.analyzeFrame(valgusPose, valgusAngles);
    
    // Verificar que se detecta algún error relacionado con rodillas
    const hasKneeError = result.errors.some(error => 
      error.type === PostureErrorType.KNEE_VALGUS || 
      error.affectedJoints.includes('left_knee') ||
      error.affectedJoints.includes('right_knee')
    );
    
    expect(hasKneeError).toBe(true);
  });

  it('should calculate quality score accurately', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    // Pose perfecta
    const perfectResult = analyzer.analyzeFrame(mockPose, mockAngles);
    
    // Pose con errores
    const badAngles = {
      ...mockAngles,
      left_knee_angle: 30,  // Muy malo
      spine_angle: 45       // Muy inclinado
    };
    
    const badResult = analyzer.analyzeFrame(mockPose, badAngles);
    
    expect(perfectResult.qualityScore).toBeGreaterThan(badResult.qualityScore);
  });

  it('should provide enhanced metrics when available', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    const result = analyzer.analyzeFrame(mockPose, mockAngles);
    
    // Verificar que las métricas enhanced están disponibles
    if (result.precisionMetrics) {
      expect(result.precisionMetrics.overallPrecision).toBeDefined();
      expect(result.precisionMetrics.angularAccuracy).toBeDefined();
      expect(result.precisionMetrics.frameStability).toBeDefined();
    }
  });

  it('should get session stats correctly', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    // Simular algunas repeticiones
    for (let i = 0; i < 5; i++) {
      analyzer.analyzeFrame(mockPose, mockAngles);
    }
    
    const stats = analyzer.getEnhancedSessionStats();
    
    expect(stats.repetitions).toEqual(jasmine.any(Number));
    expect(stats.averageQuality).toEqual(jasmine.any(Number));
    expect(stats.currentPhase).toBeDefined();
    expect(stats.scientificMetrics).toBeDefined();
  });

  it('should cleanup resources properly', () => {
    analyzer.setCurrentExercise(ExerciseType.SQUATS);
    
    // Verificar que cleanup no arroja errores
    expect(() => {
      analyzer.cleanup();
    }).not.toThrow();
  });
});