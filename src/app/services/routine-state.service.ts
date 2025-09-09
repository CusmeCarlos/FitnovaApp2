// src/app/services/routine-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AIGeneratedRoutine } from '../interfaces/profile.interface';

export enum RoutineStatus {
  NONE = 'none',
  GENERATING = 'generating', 
  WAITING_APPROVAL = 'waiting_approval',
  APPROVED = 'approved',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  ERROR = 'error'
}

export interface RoutineState {
  status: RoutineStatus;
  routine?: AIGeneratedRoutine;
  error?: string;
  generatedAt?: Date;
  approvedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RoutineStateService {
  private routineStateSubject = new BehaviorSubject<RoutineState>({
    status: RoutineStatus.NONE
  });

  public routineState$ = this.routineStateSubject.asObservable();

  constructor() {}

  updateRoutineState(state: Partial<RoutineState>) {
    const currentState = this.routineStateSubject.value;
    const newState = { ...currentState, ...state };
    this.routineStateSubject.next(newState);
  }
  // En routine-state.service.ts, agrega este método:

  setGenerating(): void {
    this.updateRoutineState({
      status: RoutineStatus.GENERATING,
      error: undefined
    });
    console.log('🔄 Estado cambiado a: GENERATING');
  }

  setWaitingApproval(routine: AIGeneratedRoutine): void {
    this.updateRoutineState({
      status: RoutineStatus.WAITING_APPROVAL,
      routine,
      generatedAt: new Date(),
      error: undefined
    });
    console.log('⏳ Estado cambiado a: WAITING_APPROVAL');
  }

  setApproved(): void {
    this.updateRoutineState({
      status: RoutineStatus.APPROVED,
      approvedAt: new Date()
    });
    console.log('✅ Estado cambiado a: APPROVED');
  }

  setActive(): void {
    this.updateRoutineState({
      status: RoutineStatus.ACTIVE
    });
    console.log('🏃 Estado cambiado a: ACTIVE');
  }

  setError(error: string): void {
    this.updateRoutineState({
      status: RoutineStatus.ERROR,
      error
    });
    console.error('❌ Estado cambiado a: ERROR -', error);
  }

  setRejected(): void {
    this.updateRoutineState({
      status: RoutineStatus.REJECTED
    });
    console.log('❌ Estado cambiado a: REJECTED');
  }


  getCurrentState(): RoutineState {
    return this.routineStateSubject.value;
  }

  hasActiveRoutine(): boolean {
    const state = this.getCurrentState();
    
    // Considerar rutina activa si está aprobada, activa, o esperando aprobación
    const activeStatuses = [
      RoutineStatus.APPROVED, 
      RoutineStatus.ACTIVE, 
      RoutineStatus.WAITING_APPROVAL
    ];
    
    const hasValidStatus = activeStatuses.includes(state.status);
    const hasRoutineData = !!state.routine;
    
    console.log('🔍 Verificando rutina activa:', {
      status: state.status,
      hasValidStatus,
      hasRoutineData,
      resultado: hasValidStatus && hasRoutineData
    });
    
    return hasValidStatus && hasRoutineData;
  }

  getCurrentRoutine(): AIGeneratedRoutine | undefined {
    const state = this.getCurrentState();
    return state.routine;
  }

  reset(): void {
    this.routineStateSubject.next({
      status: RoutineStatus.NONE
    });
    console.log('🔄 Estado reseteado a: NONE');
  }
  logCurrentState(): void {
    const state = this.getCurrentState();
    console.log('📊 Estado actual completo del servicio:', {
      status: state.status,
      hasRoutine: !!state.routine,
      routineName: state.routine?.routine?.name || 'Sin nombre',
      generatedAt: state.generatedAt,
      approvedAt: state.approvedAt,
      error: state.error
    });
  }
}