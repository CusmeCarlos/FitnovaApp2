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

  setGenerating() {
    this.updateRoutineState({
      status: RoutineStatus.GENERATING,
      error: undefined
    });
  }

  setWaitingApproval(routine: AIGeneratedRoutine) {
    this.updateRoutineState({
      status: RoutineStatus.WAITING_APPROVAL,
      routine,
      generatedAt: new Date(),
      error: undefined
    });
  }

  setApproved() {
    this.updateRoutineState({
      status: RoutineStatus.APPROVED,
      approvedAt: new Date()
    });
  }

  setActive() {
    this.updateRoutineState({
      status: RoutineStatus.ACTIVE
    });
  }

  setError(error: string) {
    this.updateRoutineState({
      status: RoutineStatus.ERROR,
      error
    });
  }

  setRejected() {
    this.updateRoutineState({
      status: RoutineStatus.REJECTED
    });
  }

  getCurrentState(): RoutineState {
    return this.routineStateSubject.value;
  }

  hasActiveRoutine(): boolean {
    const state = this.getCurrentState();
    return state.status === RoutineStatus.APPROVED || 
           state.status === RoutineStatus.ACTIVE;
  }

  getCurrentRoutine(): AIGeneratedRoutine | undefined {
    return this.getCurrentState().routine;
  }

  reset() {
    this.routineStateSubject.next({
      status: RoutineStatus.NONE
    });
  }
}