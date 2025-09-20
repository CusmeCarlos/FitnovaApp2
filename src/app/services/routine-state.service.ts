// src/app/services/routine-state.service.ts
// ✅ ESTRUCTURA FIREBASE CORRECTA BASADA EN CLOUD FUNCTIONS

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { AIGeneratedRoutine } from '../interfaces/profile.interface';
import { AuthService } from './auth.service';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

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
  rejectedAt?: Date;
  lastSyncAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RoutineStateService implements OnDestroy {
  private db = firebase.firestore();
  private routineStateSubject = new BehaviorSubject<RoutineState>({
    status: RoutineStatus.NONE,
    lastSyncAt: new Date()
  });

  public routineState$ = this.routineStateSubject.asObservable();
  
  private userSubscription?: Subscription;
  private routineListener?: () => void;
  private currentUserId?: string;

  constructor(private auth: AuthService) {
    console.log('🔥 RoutineStateService inicializado - estructura Firebase correcta');
    this.initializeRealtimeListeners();
  }

  private initializeRealtimeListeners(): void {
    this.userSubscription = this.auth.user$.subscribe(user => {
      console.log('👤 Usuario cambió en RoutineStateService:', user?.uid);
      
      this.cleanupRoutineListener();
      
      if (user?.uid) {
        this.currentUserId = user.uid;
        this.setupCorrectListener(user.uid);
      } else {
        this.currentUserId = undefined;
        this.resetState();
      }
    });
  }

  // ✅ LISTENER PARA ESTRUCTURA REAL: aiRoutines/{uid}/routines/{routineId}
  private setupCorrectListener(uid: string): void {
    try {
      console.log('🎯 Configurando listener para estructura CORRECTA:', `aiRoutines/${uid}/routines/`);
      
      // ✅ ESTA ES LA ESTRUCTURA QUE USA TU CLOUD FUNCTION
      this.routineListener = this.db
        .collection('aiRoutines')
        .doc(uid)
        .collection('routines')
        .onSnapshot(
          (snapshot) => this.handleCorrectSnapshot(snapshot),
          (error) => {
            console.error('❌ Error en listener correcto:', error);
            this.setError('Error de conexión con Firebase');
          }
        );

      console.log('✅ Listener correcto configurado para subcolección');
      
    } catch (error) {
      console.error('❌ Error configurando listener correcto:', error);
      this.setError('Error configurando sincronización');
    }
  }

  // ✅ MANEJAR SNAPSHOT DE LA ESTRUCTURA CORRECTA
  private handleCorrectSnapshot(snapshot: firebase.firestore.QuerySnapshot): void {
    try {
      console.log('📡 Snapshot correcto recibido:', snapshot.docs.length, 'rutinas');
      
      if (snapshot.empty) {
        console.log('📭 No hay rutinas en la subcolección');
        this.updateRoutineState({
          status: RoutineStatus.NONE,
          routine: undefined,
          error: undefined,
          lastSyncAt: new Date()
        });
        return;
      }

      // Encontrar la rutina más reciente
      let latestRoutine: any = null;
      let latestDate = new Date(0);

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const routineDate = data['generatedAt']?.toDate?.() || new Date(0);
        
        if (routineDate > latestDate) {
          latestDate = routineDate;
          latestRoutine = { id: doc.id, ...data };
        }
      });

      if (!latestRoutine) {
        console.log('❌ No se encontró rutina válida en subcolección');
        return;
      }
      
      console.log('🔄 Procesando rutina de subcolección:', {
        id: latestRoutine.id,
        status: latestRoutine['status'],
        generatedAt: latestDate
      });

      const status = this.mapFirebaseStatusToLocal(latestRoutine['status']);
      
      const newState: Partial<RoutineState> = {
        status: status,
        routine: latestRoutine,
        generatedAt: latestDate,
        approvedAt: latestRoutine['approvedAt']?.toDate?.(),
        rejectedAt: latestRoutine['rejectedAt']?.toDate?.(),
        error: status === RoutineStatus.REJECTED ? latestRoutine['rejectionReason'] : undefined,
        lastSyncAt: new Date()
      };

      this.updateRoutineState(newState);
      
      console.log('✅ Estado actualizado desde subcolección:', {
        newStatus: status,
        routineId: latestRoutine.id
      });

      this.notifyImportantChanges(status, latestRoutine);
      
    } catch (error) {
      console.error('❌ Error procesando snapshot correcto:', error);
      this.setError('Error procesando datos de rutina');
    }
  }

  private mapFirebaseStatusToLocal(firebaseStatus: string): RoutineStatus {
    const statusMap: { [key: string]: RoutineStatus } = {
      'pending_approval': RoutineStatus.WAITING_APPROVAL,
      'waiting_approval': RoutineStatus.WAITING_APPROVAL,
      'approved': RoutineStatus.APPROVED,
      'active': RoutineStatus.ACTIVE,
      'rejected': RoutineStatus.REJECTED
    };

    return statusMap[firebaseStatus] || RoutineStatus.ERROR;
  }

  private async notifyImportantChanges(status: RoutineStatus, routineData: any): Promise<void> {
    const currentState = this.routineStateSubject.value;
    
    if (currentState.status === status) return;

    try {
      const { ToastController } = await import('@ionic/angular');
      const toastController = new ToastController();

      let message = '';
      let color = 'medium';

      switch (status) {
        case RoutineStatus.APPROVED:
          message = 'Tu rutina ha sido aprobada! Ya puedes comenzar a entrenar.';
          color = 'success';
          break;
        case RoutineStatus.REJECTED:
          message = 'Tu rutina fue rechazada. Puedes generar una nueva.';
          color = 'danger';
          break;
        case RoutineStatus.WAITING_APPROVAL:
          message = 'Rutina generada, esperando aprobación del entrenador.';
          color = 'warning';
          break;
      }

      if (message) {
        const toast = await toastController.create({
          message,
          duration: 4000,
          color,
          position: 'top',
          buttons: [{
            text: 'OK',
            role: 'cancel'
          }]
        });
        await toast.present();
      }
    } catch (error) {
      console.error('❌ Error mostrando notificación:', error);
    }
  }

  private cleanupRoutineListener(): void {
    if (this.routineListener) {
      console.log('🧹 Limpiando listener de rutina');
      this.routineListener();
      this.routineListener = undefined;
    }
  }

  // ✅ MÉTODOS PÚBLICOS
  updateRoutineState(state: Partial<RoutineState>): void {
    const currentState = this.routineStateSubject.value;
    const newState = { ...currentState, ...state };
    this.routineStateSubject.next(newState);
  }

  setGenerating(): void {
    this.updateRoutineState({
      status: RoutineStatus.GENERATING,
      error: undefined,
      lastSyncAt: new Date()
    });
    console.log('🔄 Estado cambiado a: GENERATING');
  }

  setWaitingApproval(routine: AIGeneratedRoutine): void {
    this.updateRoutineState({
      status: RoutineStatus.WAITING_APPROVAL,
      routine,
      generatedAt: new Date(),
      error: undefined,
      lastSyncAt: new Date()
    });
    console.log('⏳ Estado cambiado a: WAITING_APPROVAL');
  }

  setApproved(): void {
    this.updateRoutineState({
      status: RoutineStatus.APPROVED,
      approvedAt: new Date(),
      lastSyncAt: new Date()
    });
    console.log('✅ Estado cambiado a: APPROVED');
  }

  setActive(): void {
    this.updateRoutineState({
      status: RoutineStatus.ACTIVE,
      lastSyncAt: new Date()
    });
    console.log('🏃 Estado cambiado a: ACTIVE');
  }

  setError(error: string): void {
    this.updateRoutineState({
      status: RoutineStatus.ERROR,
      error,
      lastSyncAt: new Date()
    });
    console.error('❌ Estado cambiado a: ERROR -', error);
  }

  setRejected(): void {
    this.updateRoutineState({
      status: RoutineStatus.REJECTED,
      lastSyncAt: new Date()
    });
    console.log('❌ Estado cambiado a: REJECTED');
  }

  getCurrentState(): RoutineState {
    return this.routineStateSubject.value;
  }

  hasActiveRoutine(): boolean {
    const state = this.getCurrentState();
    
    const activeStatuses = [
      RoutineStatus.APPROVED, 
      RoutineStatus.ACTIVE, 
      RoutineStatus.WAITING_APPROVAL
    ];
    
    const hasValidStatus = activeStatuses.includes(state.status);
    const hasRoutineData = !!(state.routine && Object.keys(state.routine).length > 0);
    
    return hasValidStatus && hasRoutineData;
  }

  // ✅ SINCRONIZACIÓN MANUAL CON ESTRUCTURA CORRECTA
  async forceSyncFromFirebase(): Promise<void> {
    if (!this.currentUserId) {
      console.warn('⚠️ No se puede sincronizar: usuario no autenticado');
      return;
    }

    try {
      console.log('🔄 Forzando sincronización desde subcolección...');
      
      // ✅ CONSULTAR LA ESTRUCTURA CORRECTA
      const routinesSnapshot = await this.db
        .collection('aiRoutines')
        .doc(this.currentUserId)
        .collection('routines')
        .get();

      console.log('📊 Rutinas encontradas en subcolección:', routinesSnapshot.docs.length);
      
      this.handleCorrectSnapshot(routinesSnapshot);
      console.log('✅ Sincronización manual completada');
      
    } catch (error) {
      console.error('❌ Error en sincronización manual:', error);
      this.setError('Error sincronizando con el servidor');
    }
  }

  isConnected(): boolean {
    const state = this.getCurrentState();
    const lastSync = state.lastSyncAt;
    
    if (!lastSync) return false;
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSync > fiveMinutesAgo;
  }

  private resetState(): void {
    this.updateRoutineState({
      status: RoutineStatus.NONE,
      routine: undefined,
      error: undefined,
      generatedAt: undefined,
      approvedAt: undefined,
      rejectedAt: undefined,
      lastSyncAt: new Date()
    });
  }

  ngOnDestroy(): void {
    console.log('🧹 Limpiando RoutineStateService...');
    this.cleanupRoutineListener();
    this.userSubscription?.unsubscribe();
  }
}