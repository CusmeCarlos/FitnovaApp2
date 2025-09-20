import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../../services/auth.service';

import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton, 
  IonButtons, 
  IonIcon, 
  IonLabel,
  IonChip,
  IonBackButton,
  IonRefresher,
  IonRefresherContent, IonItem, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent } from "@ionic/angular/standalone";

import { RoutineStateService, RoutineState, RoutineStatus } from '../../services/routine-state.service';
import { AiRoutineService } from '../../services/ai-routine.service';
import { CloudFunctionsService } from '../../services/cloud-functions.service';
import { ProfileService } from '../../services/profile.service';
import { AIGeneratedRoutine } from '../../interfaces/profile.interface';

@Component({
  selector: 'app-routine-view',
  templateUrl: './routine-view.page.html',
  styleUrls: ['./routine-view.page.scss'],
  standalone: true,
  imports: [IonCardContent, IonCardSubtitle, IonCardTitle, IonCardHeader, IonCard, IonSpinner, IonItem, 
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonLabel,
    IonChip,
    IonBackButton,
    IonRefresher,
    IonRefresherContent
  ]
})
export class RoutineViewPage implements OnInit, OnDestroy {
  
  routineState: RoutineState = { 
    status: RoutineStatus.NONE,
    lastSyncAt: new Date()
  };
  loading = false;
  connectionStatus = 'connected';
  
  private stateSubscription?: Subscription;
  private connectionCheckInterval?: any;

  RoutineStatus = RoutineStatus;

  constructor(
    private routineStateService: RoutineStateService,
    private aiRoutineService: AiRoutineService,
    private cloudFunctionsService: CloudFunctionsService,
    private profileService: ProfileService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private auth: AuthService,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    console.log('🚀 RoutineViewPage iniciado con listeners tiempo real');
    this.initializeRealtimeSubscription();
    this.startConnectionMonitoring();
  }

  ngOnDestroy() {
    console.log('🧹 Limpiando RoutineViewPage...');
    this.cleanupSubscriptions();
  }

  // ✅ INICIALIZAR SUSCRIPCIÓN TIEMPO REAL
  private initializeRealtimeSubscription(): void {
    this.stateSubscription = this.routineStateService.routineState$.subscribe(
      (state) => {
        console.log('📡 Estado de rutina actualizado en tiempo real:', {
          status: state.status,
          hasRoutine: !!state.routine,
          lastSync: state.lastSyncAt,
          timestamp: new Date().toISOString()
        });
        
        this.routineState = state;
        this.updateConnectionStatus();
        
        // Auto-manejar transiciones de estado
        this.handleStateTransitions(state);
      },
      (error) => {
        console.error('❌ Error en suscripción de rutina:', error);
        this.showError('Error conectando con el servidor');
      }
    );
  }

  // ✅ MANEJAR TRANSICIONES DE ESTADO AUTOMÁTICAMENTE
  private handleStateTransitions(state: RoutineState): void {
    switch (state.status) {
      case RoutineStatus.APPROVED:
        console.log('✅ Rutina aprobada - actualizando UI');
        this.loading = false;
        break;
        
      case RoutineStatus.REJECTED:
        console.log('❌ Rutina rechazada - mostrando opciones');
        this.loading = false;
        this.showRejectionInfo(state.error);
        break;
        
      case RoutineStatus.ERROR:
        console.log('💥 Error en rutina - mostrando mensaje');
        this.loading = false;
        this.showError(state.error || 'Error desconocido en la rutina');
        break;
        
      case RoutineStatus.NONE:
        console.log('📭 Sin rutina - redirigiendo a generación');
        setTimeout(() => this.router.navigate(['/tabs/tab3']), 2000);
        break;
    }
  }

  // ✅ MONITOREO DE CONEXIÓN
  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(() => {
      this.updateConnectionStatus();
    }, 30000); // Verificar cada 30 segundos
  }

  private updateConnectionStatus(): void {
    const isConnected = this.routineStateService.isConnected();
    this.connectionStatus = isConnected ? 'connected' : 'disconnected';
    
    if (!isConnected) {
      console.warn('⚠️ Conexión perdida con el servidor');
    }
  }

  // ✅ PULL TO REFRESH
  async handleRefresh(event: any): Promise<void> {
    try {
      console.log('🔄 Pull to refresh activado');
      await this.routineStateService.forceSyncFromFirebase();
      await this.showToast('Rutina sincronizada', 'success');
    } catch (error) {
      console.error('❌ Error en refresh:', error);
      await this.showToast('Error sincronizando', 'danger');
    } finally {
      event.target.complete();
    }
  }

  // ✅ FORZAR SINCRONIZACIÓN MANUAL
  async forceSyncManual(): Promise<void> {
    try {
      this.loading = true;
      await this.showToast('Sincronizando...', 'medium');
      await this.routineStateService.forceSyncFromFirebase();
      await this.showToast('Sincronización completada', 'success');
    } catch (error) {
      await this.showToast('Error en sincronización', 'danger');
    } finally {
      this.loading = false;
    }
  }

  // ✅ MOSTRAR INFORMACIÓN DE RECHAZO
  private async showRejectionInfo(reason?: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Rutina Rechazada',
      message: reason ? `Motivo: ${reason}` : 'Tu rutina fue rechazada por el entrenador.',
      buttons: [
        {
          text: 'Generar Nueva',
          handler: () => {
            this.router.navigate(['/tabs/tab3']);
          }
        },
        {
          text: 'Entendido',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  // ✅ REGENERAR RUTINA
  async regenerateRoutine(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Regenerar Rutina',
      message: '¿Estás seguro de que quieres generar una nueva rutina? La actual se perderá.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Sí, regenerar',
          handler: async () => {
            await this.doRegenerateRoutine();
          }
        }
      ]
    });
    await alert.present();
  }

  private async doRegenerateRoutine(): Promise<void> {
    try {
      this.loading = true;
      
      const profile = await this.profileService.getCurrentProfile().pipe(take(1)).toPromise();
      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      // Generar nueva rutina
      const result = await this.aiRoutineService.generateAdaptiveRoutine(profile);
      
      if (result.success) {
        await this.showToast('Nueva rutina generada exitosamente', 'success');
        // El listener automáticamente detectará la nueva rutina
      } else {
        throw new Error(result.error || 'Error generando rutina');
      }
      
    } catch (error: any) {
      console.error('❌ Error regenerando rutina:', error);
      await this.showError('Error generando nueva rutina: ' + error.message);
    } finally {
      this.loading = false;
    }
  }

  // ✅ NAVEGAR A ENTRENAMIENTO
  async startTraining(): Promise<void> {
    if (this.routineState.status !== RoutineStatus.APPROVED) {
      await this.showToast('La rutina debe estar aprobada para entrenar', 'warning');
      return;
    }

    try {
      this.loading = true;
      
      // Mostrar loading
      const loading = await this.loadingController.create({
        message: 'Preparando entrenamiento...',
        duration: 2000
      });
      await loading.present();

      // Marcar rutina como activa
      await this.aiRoutineService.setActiveRoutineForTraining(this.routineState.routine!);
      
      // Dismiss loading
      await loading.dismiss();
      
      // Navegar a Tab2 (entrenamiento)
      await this.router.navigate(['/tabs/tab2']);
      await this.showToast('¡Iniciando entrenamiento!', 'success');
      
    } catch (error) {
      console.error('❌ Error iniciando entrenamiento:', error);
      await this.showError('Error iniciando entrenamiento');
    } finally {
      this.loading = false;
    }
  }

  // ✅ OBTENER INFORMACIÓN DE RUTINA FORMATEADA
  getRoutineInfo(): any {
    if (!this.routineState.routine) return null;

    const routine = this.routineState.routine;
    return {
      title: routine.routine?.name || 'Rutina Personalizada',
      difficulty: routine.routine?.difficulty || 'Principiante',
      duration: routine.routine?.duration ? `${routine.routine.duration} min` : '30-45 min',
      exercises: routine.routine?.exercises?.length || 0,
      muscleGroups: routine.routine?.focusAreas || [],
      description: routine.routine?.description || 'Rutina adaptada a tu perfil',
      estimatedCalories: routine.routine?.estimatedCalories || 71
    };
  }

  // ✅ OBTENER ESTADO DE CONEXIÓN FORMATEADO
  getConnectionStatusText(): string {
    const lastSync = this.routineState.lastSyncAt;
    if (!lastSync) return 'Sin sincronizar';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Sincronizado ahora';
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    return `Hace ${diffHours}h`;
  }

  // ✅ OBTENER COLOR DEL ESTADO
  getStatusColor(): string {
    switch (this.routineState.status) {
      case RoutineStatus.APPROVED:
        return 'success';
      case RoutineStatus.WAITING_APPROVAL:
        return 'warning';
      case RoutineStatus.REJECTED:
      case RoutineStatus.ERROR:
        return 'danger';
      default:
        return 'medium';
    }
  }

  // ✅ OBTENER ICONO DEL ESTADO
  getStatusIcon(): string {
    switch (this.routineState.status) {
      case RoutineStatus.APPROVED:
        return 'checkmark-circle';
      case RoutineStatus.WAITING_APPROVAL:
        return 'time';
      case RoutineStatus.REJECTED:
        return 'close-circle';
      case RoutineStatus.ERROR:
        return 'warning';
      case RoutineStatus.GENERATING:
        return 'sync';
      default:
        return 'document';
    }
  }

  // ✅ UTILITIES
  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
      cssClass: 'professional-toast'
    });
    await toast.present();
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private cleanupSubscriptions(): void {
    this.stateSubscription?.unsubscribe();
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
  }

  // ✅ MÉTODOS PARA TEMPLATE
  shouldShowApprovedActions(): boolean {
    return this.routineState.status === RoutineStatus.APPROVED && 
           !!this.routineState.routine;
  }

  shouldShowWaitingMessage(): boolean {
    return this.routineState.status === RoutineStatus.WAITING_APPROVAL;
  }

  shouldShowRejectedActions(): boolean {
    return this.routineState.status === RoutineStatus.REJECTED;
  }

  shouldShowErrorActions(): boolean {
    return this.routineState.status === RoutineStatus.ERROR;
  }

  shouldShowLoadingSpinner(): boolean {
    return this.routineState.status === RoutineStatus.GENERATING || this.loading;
  }
}