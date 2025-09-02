// src/app/tab1/tab1.page.ts
// 📊 TAB1 DASHBOARD AVANZADO - CONECTADO A FIRESTORE CON CHART.JS

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { DashboardService, DashboardMetrics } from '../services/dashboard.service';
import { User } from '../interfaces/user.interface';
import { Subscription } from 'rxjs';
import { Chart, registerables, ChartConfiguration, ChartTypeRegistry } from 'chart.js';
// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('progressChart', { static: false }) progressChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('accuracyChart', { static: false }) accuracyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('errorsChart', { static: false }) errorsChartRef!: ElementRef<HTMLCanvasElement>;

  // ✅ DATOS DEL USUARIO Y MÉTRICAS
  user: User | null = null;
  metrics: DashboardMetrics | null = null;
  isLoading = true;
  lastUpdated: Date = new Date();
  
  // ✅ CHARTS
  private progressChart: Chart | null = null;
  private accuracyChart: Chart | null = null;
  private errorsChart: Chart | null = null;

  // ✅ SUBSCRIPCIONES
  private subscriptions = new Subscription();

  // ✅ DATOS CALCULADOS PARA LA UI
  weeklyGoalDays = [
    { label: 'L', completed: true },
    { label: 'M', completed: true },
    { label: 'M', completed: true },
    { label: 'J', completed: true },
    { label: 'V', completed: false },
    { label: 'S', completed: false },
    { label: 'D', completed: false }
  ];

  constructor(
    private auth: AuthService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit() {
    console.log('📊 Inicializando Tab1 Dashboard Avanzado...');
    this.loadUserData();
    this.loadDashboardMetrics();
  }

  ngAfterViewInit() {
    // Los charts se inicializan cuando se cargan las métricas
    console.log('🎨 Tab1 Vista inicializada, esperando datos para charts...');
  }

  ngOnDestroy() {
    console.log('🧹 Limpiando Tab1 Dashboard...');
    this.subscriptions.unsubscribe();
    this.destroyCharts();
  }

  // ✅ CARGAR DATOS DEL USUARIO
  private loadUserData(): void {
    const userSub = this.auth.user$.subscribe({
      next: (user) => {
        this.user = user;
        console.log('👤 Usuario cargado en Dashboard:', user?.displayName);
      },
      error: (error) => {
        console.error('🛑 Error cargando usuario:', error);
        this.isLoading = false;
      }
    });

    this.subscriptions.add(userSub);
  }

  // ✅ CARGAR MÉTRICAS DEL DASHBOARD
  private loadDashboardMetrics(): void {
    this.isLoading = true;

    const metricsSub = this.dashboardService.getDashboardMetrics().subscribe({
      next: (metrics) => {
        console.log('📊 Métricas Dashboard cargadas:', metrics);
        this.metrics = metrics;
        this.updateWeeklyGoalDays();
        this.isLoading = false;
        this.lastUpdated = new Date();
        
        // Inicializar charts cuando tengamos datos
        setTimeout(() => {
          this.initializeCharts();
        }, 100);
      },
      error: (error) => {
        console.error('🛑 Error cargando métricas:', error);
        this.isLoading = false;
        
        // Usar métricas por defecto en caso de error
        this.metrics = this.getDefaultMetrics();
        setTimeout(() => {
          this.initializeCharts();
        }, 100);
      }
    });

    this.subscriptions.add(metricsSub);
  }

  // ✅ ACTUALIZAR DÍAS DE META SEMANAL
  private updateWeeklyGoalDays(): void {
    if (!this.metrics) return;

    this.weeklyGoalDays = this.metrics.weeklyProgress.map(day => ({
      label: day.day.charAt(0),
      completed: day.workouts > 0
    }));
  }

  // ✅ INICIALIZAR TODOS LOS GRÁFICOS
  private initializeCharts(): void {
    if (!this.metrics) return;

    console.log('🎨 Inicializando gráficos Chart.js...');
    
    this.destroyCharts(); // Limpiar charts existentes
    
    try {
      this.initProgressChart();
      this.initAccuracyChart();
      this.initErrorsChart();
      console.log('✅ Todos los gráficos inicializados correctamente');
    } catch (error) {
      console.error('🛑 Error inicializando gráficos:', error);
    }
  }

  // ✅ GRÁFICO DE PROGRESO SEMANAL
  private initProgressChart(): void {
    if (!this.progressChartRef || !this.metrics) return;

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.progressChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.metrics.weeklyProgress.map(d => d.day),
        datasets: [{
          label: 'Entrenamientos',
          data: this.metrics.weeklyProgress.map(d => d.workouts),
          backgroundColor: 'rgba(255, 87, 34, 0.8)',
          borderColor: 'rgba(255, 87, 34, 1)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }, {
          label: 'Errores',
          data: this.metrics.weeklyProgress.map(d => d.errors),
          backgroundColor: 'rgba(255, 193, 7, 0.6)',
          borderColor: 'rgba(255, 193, 7, 1)',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              font: { size: 12, weight: 600 }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              stepSize: 1
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        }
      }
    });
  }

  // ✅ GRÁFICO DE TENDENCIA DE PRECISIÓN
  private initAccuracyChart(): void {
    if (!this.accuracyChartRef || !this.metrics) return;

    const ctx = this.accuracyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.accuracyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.metrics.accuracyTrend.map(d => d.date),
        datasets: [{
          label: 'Precisión (%)',
          data: this.metrics.accuracyTrend.map(d => d.accuracy),
          borderColor: 'rgba(33, 150, 243, 1)',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(33, 150, 243, 1)',
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
            min: 80,
            max: 100,
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              callback: function(value) {
                return value + '%';
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)'
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // ✅ GRÁFICO CIRCULAR DE ERRORES POR TIPO
  private initErrorsChart(): void {
    if (!this.errorsChartRef || !this.metrics) return;

    const ctx = this.errorsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const errorTypes = Object.keys(this.metrics.errorsByType);
    const errorCounts = Object.values(this.metrics.errorsByType);

    if (errorTypes.length === 0) {
      // Mostrar gráfico con datos de ejemplo si no hay errores
      errorTypes.push('Sin errores');
      errorCounts.push(1);
    }

    this.errorsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: errorTypes.map(type => this.getErrorTypeLabel(type)),
        datasets: [{
          data: errorCounts,
          backgroundColor: [
            'rgba(255, 87, 34, 0.8)',
            'rgba(255, 193, 7, 0.8)',
            'rgba(33, 150, 243, 0.8)',
            'rgba(156, 39, 176, 0.8)',
            'rgba(76, 175, 80, 0.8)'
          ],
          borderColor: [
            'rgba(255, 87, 34, 1)',
            'rgba(255, 193, 7, 1)',
            'rgba(33, 150, 243, 1)',
            'rgba(156, 39, 176, 1)',
            'rgba(76, 175, 80, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              font: { size: 11 },
              padding: 15,
              usePointStyle: true
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  // ✅ DESTRUIR TODOS LOS GRÁFICOS
  private destroyCharts(): void {
    if (this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }
    if (this.accuracyChart) {
      this.accuracyChart.destroy();
      this.accuracyChart = null;
    }
    if (this.errorsChart) {
      this.errorsChart.destroy();
      this.errorsChart = null;
    }
  }

  // ✅ CONVERTIR TIPOS DE ERROR A LABELS LEGIBLES
  public getErrorTypeLabel(errorType: string): string {
    const labels: { [key: string]: string } = {
      'KNEE_VALGUS': 'Valgo rodilla',
      'FORWARD_HEAD': 'Cabeza adelantada',
      'ROUNDED_SHOULDERS': 'Hombros redondeados',
      'EXCESSIVE_ARCH': 'Arco excesivo',
      'ANKLE_COLLAPSE': 'Colapso tobillo',
      'HIP_SHIFT': 'Desplazamiento cadera',
      'SQUAT_DEPTH': 'Profundidad sentadilla',
      'PUSH_UP_FORM': 'Forma flexión'
    };
    
    return labels[errorType] || errorType.replace('_', ' ').toLowerCase();
  }
  trackAlert(index: number, alert: any): any {
    return alert.id;
  }
  
  trackExercise(index: number, exercise: any): any {
    return exercise.exercise;
  }

  // ✅ FORMATEAR NÚMEROS PARA LA UI
  formatNumber(value: number | undefined): string {
    if (!value) return '0';
    
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    
    return Math.round(value).toString();
  }

  // ✅ FORMATEAR TIEMPO EN HORAS
  formatTime(hours: number | undefined): string {
    if (!hours) return '0h';
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${Math.round(remainingHours)}h`;
    }
    
    return Math.round(hours) + 'h';
  }

  // ✅ OBTENER COLOR DE PRECISIÓN
  getAccuracyColor(accuracy: number | undefined): string {
    if (!accuracy) return '#ff5722';
    
    if (accuracy >= 95) return '#4caf50'; // Verde
    if (accuracy >= 90) return '#2196f3'; // Azul
    if (accuracy >= 85) return '#ff9800'; // Naranja
    return '#ff5722'; // Rojo
  }

  // ✅ OBTENER COLOR DE MEJORA
  getImprovementColor(improvement: number | undefined): string {
    if (!improvement) return '#757575';
    
    if (improvement > 0) return '#4caf50'; // Verde para mejora
    if (improvement === 0) return '#ff9800'; // Naranja para neutro
    return '#ff5722'; // Rojo para empeoramiento
  }

  // ✅ REFRESCAR MÉTRICAS MANUALMENTE
  refreshMetrics(): void {
    console.log('🔄 Refrescando métricas dashboard...');
    this.loadDashboardMetrics();
  }

  // ✅ OBTENER MÉTRICAS POR DEFECTO EN CASO DE ERROR
  private getDefaultMetrics(): DashboardMetrics {
    return {
      totalWorkouts: 127,
      accuracy: 94,
      totalHours: 45,
      weeklyImprovement: 15,
      weeklyGoalProgress: 80,
      currentStreak: 4,
      criticalErrorsToday: 0,
      mostCommonError: 'KNEE_VALGUS',
      recentAlerts: [],
      errorsByType: {
        'KNEE_VALGUS': 3,
        'FORWARD_HEAD': 2,
        'ROUNDED_SHOULDERS': 1
      },
      weeklyProgress: [
        { day: 'Lun', workouts: 1, errors: 2 },
        { day: 'Mar', workouts: 1, errors: 1 },
        { day: 'Mié', workouts: 1, errors: 1 },
        { day: 'Jue', workouts: 1, errors: 0 },
        { day: 'Vie', workouts: 0, errors: 0 },
        { day: 'Sáb', workouts: 0, errors: 0 },
        { day: 'Dom', workouts: 0, errors: 0 }
      ],
      accuracyTrend: [
        { date: 'Lun', accuracy: 90 },
        { date: 'Mar', accuracy: 92 },
        { date: 'Mié', accuracy: 94 },
        { date: 'Jue', accuracy: 96 },
        { date: 'Vie', accuracy: 94 },
        { date: 'Sáb', accuracy: 93 },
        { date: 'Dom', accuracy: 94 }
      ],
      exerciseStats: [
        { exercise: 'SQUATS', count: 8, avgAccuracy: 92 },
        { exercise: 'PUSH_UPS', count: 6, avgAccuracy: 95 },
        { exercise: 'LUNGES', count: 4, avgAccuracy: 88 }
      ]
    };
  }

  // ✅ NAVEGAR A SECCIÓN ESPECÍFICA
  navigateToTraining(): void {
    console.log('🎯 Navegando a entrenamiento...');
    // Implementar navegación a Tab2
  }

  navigateToProfile(): void {
    console.log('👤 Navegando a perfil...');
    // Implementar navegación a Tab3
  }

  navigateToHistory(): void {
    console.log('📈 Navegando a historial...');
    // Implementar navegación a historial
  }

  getCompletedDaysCount(): number {
    return this.weeklyGoalDays.filter(day => day.completed).length;
  }
}