// src/app/tab1/components/training-history-modal.component.ts - CREAR ARCHIVO NUEVO
// ✅ COMPONENTE MODAL PARA HISTORIAL DE ENTRENAMIENTOS

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController } from '@ionic/angular';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton, 
  IonButtons, 
  IonIcon, 
  IonLabel,
  IonItem,
  IonList,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonNote
} from "@ionic/angular/standalone";

@Component({
  selector: 'app-training-history-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonLabel,
    IonItem,
    IonList,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonNote
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Historial de Entrenamientos</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="history-content">
      
      <!-- Resumen de métricas -->
      <ion-card *ngIf="userMetrics" class="metrics-summary">
        <ion-card-header>
          <ion-card-title>Resumen General</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-value">{{ userMetrics.totalWorkouts }}</span>
              <span class="metric-label">Entrenamientos</span>
            </div>
            <div class="metric-item">
              <span class="metric-value">{{ userMetrics.accuracy }}%</span>
              <span class="metric-label">Precisión</span>
            </div>
            <div class="metric-item">
              <span class="metric-value">{{ userMetrics.totalHours.toFixed(1) }}h</span>
              <span class="metric-label">Tiempo Total</span>
            </div>
            <div class="metric-item">
              <span class="metric-value">{{ userMetrics.currentStreak }}</span>
              <span class="metric-label">Racha Actual</span>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Lista de entrenamientos -->
      <ion-card *ngIf="historyData.length > 0" class="history-list">
        <ion-card-header>
          <ion-card-title>Sesiones Recientes</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item *ngFor="let session of historyData; trackBy: trackBySesion" class="session-item">
              <div slot="start" class="session-icon">
                <ion-icon [name]="getExerciseIcon(session.exercise)" [color]="getAccuracyColor(session.accuracy)"></ion-icon>
              </div>
              
              <ion-label>
                <h3>{{ session.exercise }}</h3>
                <p>{{ formatDate(session.date) }}</p>
                <ion-note color="medium">
                  {{ session.duration }} min • {{ session.repetitions }} reps
                </ion-note>
              </ion-label>
              
              <div slot="end" class="session-stats">
                <ion-chip [color]="getAccuracyColor(session.accuracy)" class="accuracy-chip">
                  {{ session.accuracy }}%
                </ion-chip>
                <ion-note *ngIf="session.errorsCount > 0" color="warning">
                  {{ session.errorsCount }} errores
                </ion-note>
              </div>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Estado vacío -->
      <ion-card *ngIf="historyData.length === 0" class="empty-state">
        <ion-card-content>
          <div class="empty-content">
            <ion-icon name="fitness-outline" size="large" color="medium"></ion-icon>
            <h3>Sin historial disponible</h3>
            <p>Completa tu primer entrenamiento para ver tu progreso aquí.</p>
            <ion-button expand="block" (click)="startTraining()">
              <ion-icon name="play-outline" slot="start"></ion-icon>
              Comenzar Entrenamiento
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>

    </ion-content>
  `,
  styles: [`
    .history-content {
      --background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    }

    .metrics-summary {
      margin: 1rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      text-align: center;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--ion-color-primary);
    }

    .metric-label {
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .history-list {
      margin: 0 1rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .session-item {
      --background: transparent;
      --border-color: rgba(255, 255, 255, 0.1);
      margin-bottom: 0.5rem;
    }

    .session-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
    }

    .session-stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }

    .accuracy-chip {
      font-size: 0.75rem;
      height: 24px;
    }

    .empty-state {
      margin: 2rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .empty-content {
      text-align: center;
      padding: 2rem 1rem;
    }

    .empty-content ion-icon {
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-content h3 {
      margin: 1rem 0 0.5rem;
      color: var(--ion-color-light);
    }

    .empty-content p {
      color: var(--ion-color-medium);
      margin-bottom: 2rem;
    }

    @media (max-width: 768px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class TrainingHistoryModalComponent implements OnInit {
  @Input() historyData: any[] = [];
  @Input() userMetrics: any = null;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    console.log('📊 Modal historial inicializado:', {
      sesiones: this.historyData?.length || 0,
      metricas: !!this.userMetrics
    });
  }

  dismiss() {
    this.modalController.dismiss();
  }

  startTraining() {
    this.modalController.dismiss({ action: 'startTraining' });
  }

  trackBySesion(index: number, session: any): string {
    return session.sessionId || index.toString();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
  }

  getExerciseIcon(exercise: string): string {
    const iconMap: { [key: string]: string } = {
      'Sentadillas': 'fitness-outline',
      'Flexiones': 'barbell-outline',
      'Plancha': 'body-outline',
      'Estocadas': 'walk-outline',
      'Peso Muerto': 'barbell-outline'
    };
    
    return iconMap[exercise] || 'fitness-outline';
  }

  getAccuracyColor(accuracy: number): string {
    if (accuracy >= 90) return 'success';
    if (accuracy >= 75) return 'warning';
    return 'danger';
  }
}