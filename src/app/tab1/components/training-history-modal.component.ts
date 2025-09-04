// src/app/tab1/components/training-history-modal.component.ts
// ✅ REEMPLAZAR IMPORTS COMPLETOS:

import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

interface TrainingSession {
  date: string;
  exercise: string;
  duration: number;
  repetitions: number;
  errorsCount: number;
  accuracy: number;
  sessionId: string;
}

@Component({
  selector: 'app-training-history-modal',
  standalone: true,
  imports: [CommonModule, IonicModule], // ✅ AGREGAR IMPORTS
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Historial de Entrenamientos</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="closeModal()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="history-content">
      
      <!-- Resumen rápido -->
      <div class="summary-section">
        <h3>Resumen General</h3>
        <div class="summary-grid">
          <div class="summary-card">
            <ion-icon name="calendar-outline"></ion-icon>
            <div class="summary-value">{{ getSummary().totalSessions }}</div>
            <div class="summary-label">Sesiones</div>
          </div>
          <div class="summary-card">
            <ion-icon name="time-outline"></ion-icon>
            <div class="summary-value">{{ getSummary().totalDuration }}</div>
            <div class="summary-label">Tiempo Total</div>
          </div>
          <div class="summary-card">
            <ion-icon name="fitness-outline"></ion-icon>
            <div class="summary-value">{{ getSummary().totalReps }}</div>
            <div class="summary-label">Repeticiones</div>
          </div>
        </div>
      </div>

      <!-- Gráfico de progreso -->
      <div class="chart-section" *ngIf="historyData && historyData.length > 0">
        <h3>Progreso de Precisión</h3>
        <div class="chart-container">
          <canvas #progressChart></canvas>
        </div>
      </div>

      <!-- Lista de sesiones -->
      <div class="sessions-section">
        <h3>Últimas Sesiones</h3>
        <ion-card *ngFor="let session of getRecentSessions()" class="session-card">
          <ion-card-header>
            <div class="session-header">
              <div class="session-info">
                <ion-card-title>{{ session.exercise }}</ion-card-title>
                <ion-card-subtitle>{{ formatDate(session.date) }}</ion-card-subtitle>
              </div>
              <div class="accuracy-badge" [class.high]="session.accuracy >= 85" [class.medium]="session.accuracy >= 70 && session.accuracy < 85" [class.low]="session.accuracy < 70">
                {{ session.accuracy }}%
              </div>
            </div>
          </ion-card-header>
          <ion-card-content>
            <div class="session-stats">
              <div class="stat">
                <ion-icon name="time-outline"></ion-icon>
                {{ formatDuration(session.duration) }}
              </div>
              <div class="stat">
                <ion-icon name="repeat-outline"></ion-icon>
                {{ session.repetitions }} reps
              </div>
              <div class="stat">
                <ion-icon name="warning-outline" [color]="session.errorsCount > 5 ? 'warning' : 'medium'"></ion-icon>
                {{ session.errorsCount }} errores
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Estado vacío -->
        <div class="empty-state" *ngIf="!historyData || historyData.length === 0">
          <ion-icon name="calendar-outline" color="medium"></ion-icon>
          <h3>Sin entrenamientos</h3>
          <p>Comienza tu primer entrenamiento para ver tu historial aquí</p>
          <ion-button color="primary" (click)="startTraining()">
            <ion-icon name="play-outline" slot="start"></ion-icon>
            Comenzar Ahora
          </ion-button>
        </div>
      </div>

    </ion-content>
  `,
  styles: [`
    .history-content {
      --padding-start: 1rem;
      --padding-end: 1rem;
    }

    .summary-section, .chart-section, .sessions-section {
      margin: 1.5rem 0;
    }

    .summary-section h3, .chart-section h3, .sessions-section h3 {
      color: var(--ion-color-primary);
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 1rem;
    }

    .summary-card {
      background: var(--ion-color-light);
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
      border: 1px solid var(--ion-color-light-shade);
    }

    .summary-card ion-icon {
      font-size: 1.5rem;
      color: var(--ion-color-primary);
    }

    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--ion-color-primary);
      margin: 0.5rem 0;
    }

    .summary-label {
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      text-transform: uppercase;
    }

    .chart-container {
      background: white;
      border-radius: 12px;
      padding: 1rem;
      height: 200px;
    }

    .session-card {
      margin-bottom: 1rem;
      border-radius: 12px;
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .accuracy-badge {
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .accuracy-badge.high {
      background: var(--ion-color-success-tint);
      color: var(--ion-color-success-shade);
    }

    .accuracy-badge.medium {
      background: var(--ion-color-warning-tint);
      color: var(--ion-color-warning-shade);
    }

    .accuracy-badge.low {
      background: var(--ion-color-danger-tint);
      color: var(--ion-color-danger-shade);
    }

    .session-stats {
      display: flex;
      justify-content: space-around;
      margin-top: 0.5rem;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.9rem;
      color: var(--ion-color-medium);
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: var(--ion-color-medium);
    }

    .empty-state ion-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
  `]
})
export class TrainingHistoryModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() historyData: TrainingSession[] = [];
  @Input() userMetrics: any;
  @ViewChild('progressChart', { static: false }) chartCanvas!: ElementRef;

  private progressChart: Chart | null = null;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    if (!this.historyData || this.historyData.length === 0) {
      this.generateMockData();
    }
  }

  ngAfterViewInit() {
    if (this.historyData && this.historyData.length > 0) {
      setTimeout(() => this.createProgressChart(), 100);
    }
  }

  ngOnDestroy() {
    if (this.progressChart) {
      this.progressChart.destroy();
    }
  }

  closeModal() {
    this.modalController.dismiss();
  }

  startTraining() {
    this.modalController.dismiss({ action: 'startTraining' });
  }

  getSummary() {
    if (!this.historyData || this.historyData.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: '0m',
        totalReps: 0
      };
    }

    const totalSessions = this.historyData.length;
    const totalMinutes = this.historyData.reduce((sum, session) => sum + session.duration, 0);
    const totalReps = this.historyData.reduce((sum, session) => sum + session.repetitions, 0);

    return {
      totalSessions,
      totalDuration: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
      totalReps
    };
  }

  getRecentSessions(): TrainingSession[] {
    if (!this.historyData) return [];
    return this.historyData.slice(0, 10);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Ayer';
    if (diffDays <= 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-ES', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  private generateMockData() {
    const exercises = ['Sentadillas', 'Flexiones', 'Plancha', 'Estocadas'];
    const mockData: TrainingSession[] = [];

    for (let i = 0; i < 15; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      mockData.push({
        date: date.toISOString(),
        exercise: exercises[Math.floor(Math.random() * exercises.length)],
        duration: Math.floor(Math.random() * 30) + 15,
        repetitions: Math.floor(Math.random() * 20) + 10,
        errorsCount: Math.floor(Math.random() * 8),
        accuracy: Math.floor(Math.random() * 30) + 70,
        sessionId: `session_${Date.now()}_${i}`
      });
    }

    this.historyData = mockData;
  }

  private createProgressChart() {
    if (!this.chartCanvas?.nativeElement) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const last7Sessions = this.historyData.slice(0, 7).reverse();
    const labels = last7Sessions.map(session => this.formatDate(session.date));
    const accuracyData = last7Sessions.map(session => session.accuracy);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Precisión (%)',
          data: accuracyData,
          borderColor: '#3880ff',
          backgroundColor: 'rgba(56, 128, 255, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3880ff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 60,
            max: 100,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 8
          }
        }
      }
    };

    this.progressChart = new Chart(ctx, config);
  }
}