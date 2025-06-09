// src/app/core/pose-engine/pose-detection.engine.spec.ts
import { TestBed } from '@angular/core/testing';
import { PoseDetectionEngine } from './pose-detection.engine';
import { PoseKeypoints, BiomechanicalAngles } from '../../shared/models/pose.models';

describe('PoseDetectionEngine', () => {
  let service: PoseDetectionEngine;
  let mockVideoElement: HTMLVideoElement;
  let mockCanvasElement: HTMLCanvasElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PoseDetectionEngine);
    
    // Mock elements
    mockVideoElement = document.createElement('video');
    mockCanvasElement = document.createElement('canvas');
    
    // Mock MediaPipe globals
    (window as any).Pose = jasmine.createSpy('Pose').and.returnValue({
      setOptions: jasmine.createSpy('setOptions').and.returnValue(Promise.resolve()),
      onResults: jasmine.createSpy('onResults'),
      send: jasmine.createSpy('send').and.returnValue(Promise.resolve())
    });
    
    (window as any).Camera = jasmine.createSpy('Camera').and.returnValue({
      start: jasmine.createSpy('start').and.returnValue(Promise.resolve()),
      stop: jasmine.createSpy('stop')
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize MediaPipe correctly', async () => {
    await service.initializeMediaPipe();
    expect((window as any).Pose).toHaveBeenCalled();
  });

  it('should convert landmarks to keypoints correctly', () => {
    const mockLandmarks = [
      { x: 0.5, y: 0.5, z: 0, visibility: 0.9 }, // nose
      { x: 0.4, y: 0.4, z: 0, visibility: 0.8 }, // left_eye_inner
      // ... más landmarks de prueba
    ];

    // Test conversión (método privado - testing indirecto)
    spyOn(service as any, 'convertToKeypoints').and.callThrough();
    (service as any).processPoseResults({ poseLandmarks: mockLandmarks });
    
    expect((service as any).convertToKeypoints).toHaveBeenCalledWith(mockLandmarks);
  });

  it('should calculate angles correctly', () => {
    const mockPose: Partial<PoseKeypoints> = {
      left_shoulder: { x: 0.3, y: 0.3, z: 0, visibility: 0.9 },
      left_elbow: { x: 0.4, y: 0.5, z: 0, visibility: 0.9 },
      left_wrist: { x: 0.5, y: 0.7, z: 0, visibility: 0.9 }
    };

    const angles = (service as any).calculateBiomechanicalAngles(mockPose);
    
    expect(angles.left_elbow_angle).toBeDefined();
    expect(typeof angles.left_elbow_angle).toBe('number');
    expect(angles.left_elbow_angle).toBeGreaterThan(0);
    expect(angles.left_elbow_angle).toBeLessThan(180);
  });

  it('should validate pose correctly', () => {
    const validPose: Partial<PoseKeypoints> = {
      left_shoulder: { x: 0.3, y: 0.3, z: 0, visibility: 0.9 },
      right_shoulder: { x: 0.7, y: 0.3, z: 0, visibility: 0.9 },
      left_hip: { x: 0.3, y: 0.6, z: 0, visibility: 0.8 },
      right_hip: { x: 0.7, y: 0.6, z: 0, visibility: 0.8 },
      left_knee: { x: 0.3, y: 0.8, z: 0, visibility: 0.7 },
      right_knee: { x: 0.7, y: 0.8, z: 0, visibility: 0.7 }
    };

    const isValid = (service as any).isPoseValid(validPose);
    expect(isValid).toBe(true);

    const invalidPose: Partial<PoseKeypoints> = {
      left_shoulder: { x: 0.3, y: 0.3, z: 0, visibility: 0.2 }, // Baja visibilidad
      right_shoulder: { x: 0.7, y: 0.3, z: 0, visibility: 0.3 }
    };

    const isInvalid = (service as any).isPoseValid(invalidPose);
    expect(isInvalid).toBe(false);
  });
});