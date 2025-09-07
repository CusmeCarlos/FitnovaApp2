// src/app/pages/routine-view/routine-view.page.ts
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
  IonSpinner,
  IonChip,
  IonBackButton
} from "@ionic/angular/standalone";
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
  imports: [
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
    IonSpinner,
    IonChip,
    IonBackButton
  ]
})
export class RoutineViewPage implements OnInit, OnDestroy {
  
  routineState: RoutineState = { status: RoutineStatus.NONE };
  loading = false;
  private stateSubscription?: Subscription;

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
    // Código existente...
    
    // Debug para ver la estructura
    this.stateSubscription = this.routineStateService.routineState$.subscribe(
      state => {
        this.routineState = state;
        console.log('🔍 Estado rutina completo:', JSON.stringify(state, null, 2));
        console.log('🔍 Estructura routine:', state.routine);
      }
    );
  
    this.loadCurrentRoutine();
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }

 // En routine-view.page.ts, reemplaza el método loadCurrentRoutine:

 async loadCurrentRoutine() {
  try {
    this.loading = true;

    // Buscar directamente en la colección aiRoutines
    const user = await this.auth.user$.pipe(take(1)).toPromise();
    if (!user) {
      this.router.navigate(['/tabs/tab3']);
      return;
    }

    console.log('🔍 Buscando rutina para usuario:', user.uid);

    const routineDoc = await this.firestore
      .collection('aiRoutines')
      .doc(user.uid)
      .get()
      .toPromise();

    console.log('🔍 Documento encontrado:', routineDoc?.exists);
    console.log('🔍 Datos del documento:', routineDoc?.data());

    if (routineDoc && routineDoc.exists) {
      const routineData = routineDoc.data() as any;
      
      // La rutina está en routineData.routine, no directamente en routineData
      if (routineData && routineData.routine) {
        let status: RoutineStatus = RoutineStatus.WAITING_APPROVAL;
        
        if (routineData.status === 'approved') {
          status = RoutineStatus.APPROVED;
        } else if (routineData.status === 'rejected') {
          status = RoutineStatus.REJECTED;
        }

        this.routineStateService.updateRoutineState({
          status,
          routine: routineData, // Pasar todo el objeto
          generatedAt: routineData.generatedAt,
          approvedAt: routineData.approvedAt
        });

        console.log('✅ Rutina cargada exitosamente');
        return;
      }
    }

    console.log('❌ No se encontró rutina válida');
    this.router.navigate(['/tabs/tab3']);

  } catch (error) {
    console.error('❌ Error cargando rutina:', error);
    this.routineStateService.setError('Error cargando rutina');
    this.router.navigate(['/tabs/tab3']);
  } finally {
    this.loading = false;
  }
}

  async regenerateRoutine() {
    const alert = await this.alertController.create({
      header: 'Regenerar Rutina',
      message: '¿Estás seguro de que quieres generar una nueva rutina? La actual se perderá.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Regenerar',
          handler: async () => {
            await this.requestNewRoutine();
          }
        }
      ]
    });

    await alert.present();
  }

  private async requestNewRoutine() {
    const loading = await this.loadingController.create({
      message: 'Generando nueva rutina...',
      spinner: 'circles'
    });

    try {
      await loading.present();
      this.routineStateService.setGenerating();

      const profile = await this.profileService.profile$.pipe(take(1)).toPromise();
      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      const result = await this.cloudFunctionsService.generateAdaptiveRoutine(profile);
      
      if (result.success && result.data) {
        this.routineStateService.setWaitingApproval(result.data as AIGeneratedRoutine);
        
        const toast = await this.toastController.create({
          message: 'Nueva rutina generada exitosamente',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      } else {
        throw new Error(result.error || 'Error generando rutina');
      }

    } catch (error) {
      console.error('Error regenerando rutina:', error);
      this.routineStateService.setError('Error generando nueva rutina');
      
      const toast = await this.toastController.create({
        message: 'Error generando rutina. Intenta nuevamente.',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async startTraining() {
    if (!this.routineState.routine) {
      return;
    }

    this.routineStateService.setActive();

    // Guardar rutina activa para Tab2
    localStorage.setItem('activeRoutine', JSON.stringify(this.routineState.routine));

    this.router.navigate(['/tabs/tab2']);

    const toast = await this.toastController.create({
      message: 'Rutina activada. ¡Comienza tu entrenamiento!',
      duration: 2000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  goToProfile() {
    this.router.navigate(['/tabs/tab3']);
  }

  getStatusColor(): string {
    switch (this.routineState.status) {
      case RoutineStatus.APPROVED:
        return 'success';
      case RoutineStatus.ACTIVE:
        return 'primary';
      case RoutineStatus.WAITING_APPROVAL:
        return 'warning';
      case RoutineStatus.REJECTED:
        return 'danger';
      case RoutineStatus.ERROR:
        return 'danger';
      default:
        return 'medium';
    }
  }

  getStatusMessage(): string {
    switch (this.routineState.status) {
      case RoutineStatus.APPROVED:
        return 'Rutina aprobada por tu entrenador';
      case RoutineStatus.ACTIVE:
        return 'Rutina activa - En entrenamiento';
      case RoutineStatus.WAITING_APPROVAL:
        return 'Esperando aprobación del entrenador';
      case RoutineStatus.REJECTED:
        return 'Rutina rechazada - Se requiere nueva generación';
      case RoutineStatus.ERROR:
        return 'Error en la rutina - Intenta regenerar';
      default:
        return 'Estado desconocido';
    }
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }

// Corrige estos métodos auxiliares:
getRoutineName(): string {
  return this.routineState.routine?.routine?.name || 'Rutina sin nombre';
}

getRoutineDescription(): string {
  return this.routineState.routine?.routine?.description || 'Sin descripción';
}

getRoutineDuration(): number {
  return this.routineState.routine?.routine?.duration || 0;
}

getRoutineExercises(): any[] {
  return this.routineState.routine?.routine?.exercises || [];
}

getRoutineDifficulty(): string {
  return this.routineState.routine?.routine?.difficulty || 'No definido';
}

getRoutineAdaptations(): string[] {
  return this.routineState.routine?.routine?.adaptations || [];
}
}