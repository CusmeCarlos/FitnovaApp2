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
    // ================================================================================
    // 🎨 HISTORIAL PREMIUM - DISEÑO OSCURO AVANZADO
    // ================================================================================

    :host {
      --primary-dark: #0a0e1a;
      --secondary-dark: #1a1f2e;
      --card-dark: #1e293b;
      --accent-blue: #3b82f6;
      --accent-orange: #ff5722;
      --accent-green: #10b981;
      --text-white: #f8fafc;
      --text-gray: #94a3b8;
      --glass-bg: rgba(255, 255, 255, 0.05);
      --glass-border: rgba(255, 255, 255, 0.1);
    }

    // ================================================================================
    // 🎭 HEADER PREMIUM
    // ================================================================================
    ion-header {
      ion-toolbar {
        --background: rgba(26, 31, 46, 0.98) !important;
        --border-color: transparent;
        backdrop-filter: blur(20px) saturate(180%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 0.5rem 0;

        ion-title {
          font-weight: 800;
          font-size: 1.3rem;
          letter-spacing: 0.3px;
          background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        ion-button {
          --color: #94a3b8;
          transition: all 0.3s ease;

          &:hover {
            --color: #ff5722;
            transform: scale(1.1) rotate(90deg);
          }
        }
      }
    }

    // ================================================================================
    // 📜 CONTENT BACKGROUND
    // ================================================================================
    .history-content {
      --background: #0a0e1a !important;
      background: linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 100%) !important;
      position: relative;

      &::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background:
          radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(255, 87, 34, 0.06) 0%, transparent 50%);
        pointer-events: none;
        z-index: 0;
      }
    }

    // ================================================================================
    // 📊 METRICS SUMMARY - RESUMEN PREMIUM
    // ================================================================================
    .metrics-summary {
      margin: 1.5rem 1rem 1rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.05)) !important;
      backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 20px;
      overflow: hidden;
      position: relative;
      z-index: 1;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: slideDown 0.6s ease-out;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
        background-size: 200% 100%;
        animation: shimmer 3s infinite;
      }

      ion-card-header {
        padding: 1.25rem 1.5rem 0.75rem;

        ion-card-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #f8fafc;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 0.5rem;

          &::before {
            content: '📊';
            font-size: 1.25rem;
          }
        }
      }

      ion-card-content {
        padding: 1rem 1.5rem 1.5rem;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(59, 130, 246, 0.3);
        transform: translateY(-3px);
        box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
      }

      &:nth-child(1) .metric-value { color: #3b82f6; }
      &:nth-child(2) .metric-value { color: #10b981; }
      &:nth-child(3) .metric-value { color: #8b5cf6; }
      &:nth-child(4) .metric-value { color: #ff5722; }
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    .metric-label {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      text-align: center;
    }

    // ================================================================================
    // 📋 HISTORY LIST - LISTA PREMIUM
    // ================================================================================
    .history-list {
      margin: 0 1rem 1.5rem;
      background: #1e293b !important;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      position: relative;
      z-index: 1;
      animation: slideUp 0.6s ease-out 0.2s both;

      ion-card-header {
        padding: 1.25rem 1.5rem 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);

        ion-card-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #f8fafc;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 0.5rem;

          &::before {
            content: '🏋️';
            font-size: 1.25rem;
          }
        }
      }

      ion-card-content {
        padding: 0;
      }

      ion-list {
        background: transparent;
        padding: 0.5rem;
      }
    }

    .session-item {
      --background: rgba(255, 255, 255, 0.03);
      --border-color: rgba(255, 255, 255, 0.1);
      --padding-start: 1rem;
      --padding-end: 1rem;
      --padding-top: 1rem;
      --padding-bottom: 1rem;
      margin-bottom: 0.75rem;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(180deg, #3b82f6, #8b5cf6);
        transform: scaleY(0);
        transition: transform 0.3s ease;
      }

      &:hover {
        --background: rgba(255, 255, 255, 0.06);
        --border-color: rgba(59, 130, 246, 0.3);
        transform: translateX(8px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);

        &::before {
          transform: scaleY(1);
        }

        .session-icon {
          transform: scale(1.1) rotate(5deg);
        }
      }

      &:last-child {
        margin-bottom: 0;
      }
    }

    .session-icon {
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1));
      border: 2px solid rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      ion-icon {
        font-size: 1.75rem;
      }
    }

    ion-label {
      h3 {
        font-size: 1.05rem;
        font-weight: 800;
        color: #f8fafc;
        margin-bottom: 0.35rem;
        letter-spacing: 0.2px;
      }

      p {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-bottom: 0.35rem;
        font-weight: 500;
      }

      ion-note {
        font-size: 0.8rem;
        color: #64748b;
        font-weight: 600;
        letter-spacing: 0.3px;
      }
    }

    .session-stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .accuracy-chip {
      font-size: 0.8rem;
      height: 28px;
      font-weight: 800;
      border-radius: 10px;
      padding: 0 0.875rem;
      letter-spacing: 0.3px;
    }

    // ================================================================================
    // 🎭 EMPTY STATE PREMIUM
    // ================================================================================
    .empty-state {
      margin: 3rem 1rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.05)) !important;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      position: relative;
      z-index: 1;
      overflow: hidden;
      animation: slideUp 0.8s ease-out;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ff5722);
        background-size: 200% 100%;
        animation: shimmer 3s infinite;
      }

      ion-card-content {
        padding: 2.5rem 1.5rem;
      }
    }

    .empty-content {
      text-align: center;

      ion-icon {
        font-size: 5rem;
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.4));
        animation: float 3s ease-in-out infinite;
      }

      h3 {
        font-size: 1.75rem;
        font-weight: 900;
        margin: 0 0 1rem;
        background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
      }

      p {
        font-size: 1rem;
        color: #94a3b8;
        margin: 0 0 2.5rem;
        line-height: 1.6;
        font-weight: 500;
      }

      ion-button {
        --background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        --border-radius: 14px;
        --padding-top: 16px;
        --padding-bottom: 16px;
        --box-shadow: 0 8px 24px rgba(59, 130, 246, 0.35);
        font-weight: 800;
        font-size: 1rem;
        letter-spacing: 0.5px;
        position: relative;
        overflow: hidden;

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.6s ease;
        }

        &:hover {
          --box-shadow: 0 12px 32px rgba(59, 130, 246, 0.5);
          transform: translateY(-2px);

          &::before {
            left: 100%;
          }
        }

        ion-icon {
          font-size: 1.35rem;
          margin-right: 0.5rem;
        }
      }
    }

    // ================================================================================
    // 🎬 ANIMACIONES PREMIUM
    // ================================================================================
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    // ================================================================================
    // 📱 RESPONSIVE PREMIUM
    // ================================================================================
    @media (max-width: 480px) {
      .metrics-grid {
        gap: 1rem;
      }

      .metric-item {
        padding: 0.875rem;
      }

      .metric-value {
        font-size: 1.75rem;
      }

      .metric-label {
        font-size: 0.7rem;
      }

      .session-item {
        --padding-start: 0.875rem;
        --padding-end: 0.875rem;
        --padding-top: 0.875rem;
        --padding-bottom: 0.875rem;
      }

      .session-icon {
        width: 44px;
        height: 44px;

        ion-icon {
          font-size: 1.5rem;
        }
      }

      ion-label h3 {
        font-size: 0.95rem;
      }

      .empty-content {
        ion-icon {
          font-size: 4rem;
        }

        h3 {
          font-size: 1.5rem;
        }

        p {
          font-size: 0.9rem;
        }
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