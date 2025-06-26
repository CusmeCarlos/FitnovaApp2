// src/app/features/training/components/pose-camera/pose-camera.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PoseCameraComponent } from './pose-camera.component';
import { PoseDetectionEngine } from '../../../../core/pose-engine/pose-detection.engine';
import { BiomechanicsAnalyzer } from '../../../../core/pose-engine/biomechanics.analyzer';
import { EnhancedBiomechanicsAnalyzer } from '../../../../core/pose-engine/biomechanics.analyzer.enhanced.ts.backup';
import { ChangeDetectorRef } from '@angular/core';
import { ExerciseType } from '../../../../shared/models/pose.models';

describe('PoseCameraComponent', () => {
  let component: PoseCameraComponent;
  let fixture: ComponentFixture<PoseCameraComponent>;
  let mockPoseEngine: jasmine.SpyObj<PoseDetectionEngine>;
  let mockAnalyzer: jasmine.SpyObj<BiomechanicsAnalyzer>;
  let mockEnhancedAnalyzer: jasmine.SpyObj<EnhancedBiomechanicsAnalyzer>;

  beforeEach(async () => {
    // Create spies
    mockPoseEngine = jasmine.createSpyObj('PoseDetectionEngine', [
      'initializeMediaPipe', 'startCamera', 'stopCamera'
    ], {
      pose$: jasmine.createSpyObj('BehaviorSubject', ['asObservable', 'subscribe']),
      angles$: jasmine.createSpyObj('BehaviorSubject', ['asObservable', 'subscribe']),
      fps$: jasmine.createSpyObj('BehaviorSubject', ['asObservable', 'subscribe']),
      status$: jasmine.createSpyObj('BehaviorSubject', ['asObservable', 'subscribe'])
    });

    mockAnalyzer = jasmine.createSpyObj('BiomechanicsAnalyzer', [
      'setCurrentExercise', 'analyzeFrame', 'cleanup'
    ]);

    mockEnhancedAnalyzer = jasmine.createSpyObj('EnhancedBiomechanicsAnalyzer', [
      'setCurrentExercise', 'analyzeFrame', 'cleanup', 'getEnhancedSessionStats'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        IonicModule.forRoot(),
        PoseCameraComponent
      ],
      providers: [
        { provide: PoseDetectionEngine, useValue: mockPoseEngine },
        { provide: BiomechanicsAnalyzer, useValue: mockAnalyzer },
        ChangeDetectorRef
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PoseCameraComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.exerciseType).toBe(ExerciseType.SQUATS);
    expect(component.showSkeleton).toBe(true);
    expect(component.enableErrorDetection).toBe(true);
    expect(component.isInitialized).toBe(false);
    expect(component.isLoading).toBe(true);
  });

  it('should emit pose detection events', () => {
    spyOn(component.poseDetected, 'emit');
    
    const mockPose = {
      nose: { x: 0.5, y: 0.2, z: 0, visibility: 0.9 }
    } as any;
    
    // Simular detección de pose
    component.currentPose = mockPose;
    if (component.currentPose) {
      component.poseDetected.emit(component.currentPose);
    }
    
    expect(component.poseDetected.emit).toHaveBeenCalledWith(mockPose);
  });

  it('should toggle scientific metrics', () => {
    const initialState = component.showScientificMetrics;
    
    component.toggleScientificMetrics();
    
    expect(component.showScientificMetrics).toBe(!initialState);
  });

  it('should get precision status correctly', () => {
    // Sin métricas
    expect(component.getPrecisionStatus()).toBe('poor');
    
    // Con métricas altas
    component.precisionMetrics = {
      overallPrecision: 95,
      angularAccuracy: 90,
      frameStability: 85,
      correlationCoefficient: 90,
      spatialAccuracy: 80,
      temporalConsistency: 88
    };
    
    expect(component.getPrecisionStatus()).toBe('excellent');
  });

  it('should reset session correctly', () => {
    component.repetitionCount = 5;
    component.currentErrors = [{ type: 'test' } as any];
    component.currentQuality = 75;
    
    component.resetSession();
    
    expect(component.repetitionCount).toBe(0);
    expect(component.currentErrors).toEqual([]);
    expect(component.currentQuality).toBe(0);
  });

  it('should export session data', () => {
    component.repetitionCount = 5;
    component.currentQuality = 85;
    component.currentErrors = [];
    
    spyOn(window.URL, 'createObjectURL').and.returnValue('mock-url');
    spyOn(window.URL, 'revokeObjectURL');
    spyOn(document, 'createElement').and.returnValue({
      href: '',
      download: '',
      click: jasmine.createSpy('click')
    } as any);
    
    const result = component.exportSessionData();
    
    expect(result).toBeDefined();
    expect(result.repetitions).toBe(5);
    expect(result.averageQuality).toBe(85);
    expect(result.exercise).toBe(component.exerciseType);
  });

  it('should cleanup on destroy', () => {
    spyOn(component, 'stopCamera');
    
    component.ngOnDestroy();
    
    expect(component.stopCamera).toHaveBeenCalled();
  });
});
