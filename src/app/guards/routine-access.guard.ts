// src/app/guards/routine-access.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { RoutineStateService, RoutineStatus } from '../services/routine-state.service';

@Injectable({
  providedIn: 'root'
})
export class RoutineAccessGuard implements CanActivate {

  constructor(
    private routineStateService: RoutineStateService,
    private router: Router
  ) {}

  canActivate(): boolean {
    const state = this.routineStateService.getCurrentState();
    
    // Permitir acceso si tiene rutina en cualquier estado válido
    const validStatuses = [
      RoutineStatus.WAITING_APPROVAL,
      RoutineStatus.APPROVED,
      RoutineStatus.ACTIVE,
      RoutineStatus.REJECTED
    ];

    if (validStatuses.includes(state.status)) {
      return true;
    }

    // Si no tiene rutina o está generando, redirigir a Tab3
    this.router.navigate(['/tabs/tab3']);
    return false;
  }
}