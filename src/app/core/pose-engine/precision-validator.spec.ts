// src/app/core/pose-engine/precision-validator.spec.ts
import { TestBed } from '@angular/core/testing';
import { PrecisionValidator } from './precision-validator';
import { PoseKeypoints, BiomechanicalAngles } from '../../shared/models/pose.models';

describe('PrecisionValidator', () => {
  let validator: PrecisionValidator;
  let mockPose: PoseKeypoints;
  let mockAngles: BiomechanicalAngles;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    validator = new PrecisionValidator();
    
    // Mock data similar to other tests
    mockPose = {
      left_shoulder: { x: 0.3, y: 0.3, z: 0, visibility: 0.9 },
      right_shoulder: { x: 0.7, y: 0.3, z: 0, visibility: 0.9 },
      left_hip: { x: 0.3, y: 0.6, z: 0, visibility: 0.9 },
      right_hip: { x: 0.7, y: 0.6, z: 0, visibility: 0.9 }
    } as PoseKeypoints;

    mockAngles = {
      left_knee_angle: 90,
      right_knee_angle: 90,
      left_hip_angle: 90,
      right_hip_angle: 90
    };
  });

  it('should be created', () => {
    expect(validator).toBeTruthy();
  });

  it('should start validation without errors', () => {
    expect(() => {
      validator.startValidation();
    }).not.toThrow();
  });

  it('should validate frame and update metrics', () => {
    validator.startValidation();
    
    const startTime = performance.now();
    
    expect(() => {
      validator.validateFrame(mockPose, mockAngles, startTime);
    }).not.toThrow();
  });

  it('should provide validation report', () => {
    validator.startValidation();
    
    // Simular algunos frames
    for (let i = 0; i < 10; i++) {
      validator.validateFrame(mockPose, mockAngles, performance.now());
    }
    
    const report = validator.getValidationReport();
    
    expect(report).toBeDefined();
    expect(report.precision).toBeDefined();
    expect(report.performance).toBeDefined();
    expect(report.recommendations).toEqual(jasmine.any(Array));
    expect(typeof report.isWithinTargets).toBe('boolean');
  });

  it('should calculate precision metrics correctly', () => {
    validator.startValidation();
    
    // Simular datos consistentes
    for (let i = 0; i < 30; i++) {
      validator.validateFrame(mockPose, mockAngles, performance.now() - i);
    }
    
    const report = validator.getValidationReport();
    
    expect(report.precision.overallPrecision).toBeGreaterThanOrEqual(0);
    expect(report.precision.overallPrecision).toBeLessThanOrEqual(100);
    expect(report.precision.angularAccuracy).toBeGreaterThanOrEqual(0);
    expect(report.precision.frameStability).toBeGreaterThanOrEqual(0);
  });

  it('should cleanup without errors', () => {
    validator.startValidation();
    
    expect(() => {
      validator.cleanup();
    }).not.toThrow();
  });
});