// src/app/tab1/tab1.page.ts - REEMPLAZAR COMPLETO
// 📊 TAB1 DASHBOARD AVANZADO - CON DATOS REALES Y BOTONES FUNCIONALES

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router'; // 🆕 Para navegación
import { AuthService } from '../services/auth.service';
import { DashboardService, DashboardMetrics } from '../services/dashboard.service';
import { User } from '../interfaces/user.interface';
import { Subscription } from 'rxjs';
import { Chart, registerables, ChartConfiguration, ChartTypeRegistry } from 'chart.js';
import { AlertController, ToastController } from '@ionic/angular'; // 🆕 Para alertas

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
    { label: 'L', completed: false },
    { label: 'M', completed: false },
    { label: 'M', completed: false },
    { label: 'J', completed: false },
    { label: 'V', completed: false },
    { label: 'S', completed: false },
    { label: 'D', completed: false }
  ];

  constructor(
    private auth: AuthService,
    private dashboardService: DashboardService,
    private router: Router, // 🆕
    private alertController: AlertController, // 🆕
    private toastController: ToastController // 🆕
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
        
        // 🆕 NO usar métricas por defecto, solo mostrar error
        this.showError('Error cargando datos del dashboard');
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
    if (!this.metrics || this.metrics.isEmpty) {
      console.log('📊 Dashboard vacío, no se inicializan gráficos');
      return;
    }

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
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#ffffff',
              font: { size: 11 }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#ffffff', font: { size: 10 } },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#ffffff', font: { size: 10 } },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
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
          borderColor: '#33c759',
          backgroundColor: 'rgba(51, 199, 89, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#33c759',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
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
          x: {
            ticks: { color: '#ffffff', font: { size: 10 } },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { 
              color: '#ffffff', 
              font: { size: 10 },
              callback: function(value) {
                return value + '%';
              }
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
  }

  // ✅ GRÁFICO DE ANÁLISIS DE ERRORES
  private initErrorsChart(): void {
    if (!this.errorsChartRef || !this.metrics) return;

    const ctx = this.errorsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const errorTypes = Object.keys(this.metrics.errorsByType);
    const errorCounts = Object.values(this.metrics.errorsByType);

    if (errorTypes.length === 0) {
      console.log('📊 No hay errores para mostrar en el gráfico');
      return;
    }

    this.errorsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: errorTypes.map(type => this.getErrorTypeLabel(type)),
        datasets: [{
          data: errorCounts,
          backgroundColor: [
            '#ff5722',
            '#ff9800',
            '#ffeb3b',
            '#4caf50',
            '#2196f3',
            '#9c27b0'
          ],
          borderColor: '#1a1a1a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#ffffff',
              font: { size: 10 },
              padding: 10
            }
          }
        }
      }
    });
  }

  // ✅ DESTRUIR GRÁFICOS EXISTENTES
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

  // ✅ FORMATEAR NÚMEROS PARA DISPLAY
  formatNumber(value: number | undefined): string {
    if (!value || value === 0) return '0';
    return value.toLocaleString('es-ES');
  }

  // ✅ OBTENER ETIQUETA DE TIPO DE ERROR
  getErrorTypeLabel(errorType: string): string {
    const errorLabels: { [key: string]: string } = {
      'KNEE_VALGUS': 'Valgo de rodilla',
      'FORWARD_HEAD': 'Cabeza adelantada',
      'ROUNDED_SHOULDERS': 'Hombros redondeados',
      'EXCESSIVE_KNEE_FLEXION': 'Flexión excesiva',
      'INSUFFICIENT_DEPTH': 'Profundidad insuficiente',
      'FORWARD_LEAN': 'Inclinación adelante'
    };
    return errorLabels[errorType] || errorType;
  }

  async resetDashboard(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Resetear Dashboard',
      message: '¿Estás seguro de que quieres resetear completamente el dashboard? Se eliminarán todos los datos.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Resetear',
          handler: async () => {
            await this.dashboardService.resetDashboardData();
          }
        }
      ]
    });

    await alert.present();
  }
  formatTotalTime(hours: number): string {
    if (hours === 0) return '0s';
    
    const totalSeconds = Math.round(hours * 3600);
    
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const wholeHours = Math.floor(hours);
      const remainingMinutes = Math.floor((hours - wholeHours) * 60);
      return remainingMinutes > 0 ? `${wholeHours}h ${remainingMinutes}m` : `${wholeHours}h`;
    }
  }

  // MÉTODO para obtener el tiempo total formateado
  getTotalTimeFormatted(): string {
    if (!this.metrics || this.metrics.totalHours === 0) {
      return '0s';
    }
    return this.formatTotalTime(this.metrics.totalHours);
  }
    // MÉTODO para obtener unidad de tiempo principal
    getTimeUnit(): string {
      if (!this.metrics || this.metrics.totalHours === 0) return 'segundos';
      
      const totalSeconds = Math.round(this.metrics.totalHours * 3600);
      
      if (totalSeconds < 60) return 'segundos';
      if (totalSeconds < 3600) return 'minutos';
      return 'horas';
    }
  
    // MÉTODO para obtener valor numérico principal
    getTimeValue(): number {
      if (!this.metrics || this.metrics.totalHours === 0) return 0;
      
      const totalSeconds = Math.round(this.metrics.totalHours * 3600);
      
      if (totalSeconds < 60) return totalSeconds;
      if (totalSeconds < 3600) return Math.round(totalSeconds / 60);
      return Math.round(this.metrics.totalHours);
    }
  
    // MÉTODO para mostrar desglose detallado (opcional para tooltip)
    getTimeBreakdown(): string {
      if (!this.metrics || this.metrics.totalHours === 0) return 'Sin entrenamientos aún';
      
      const totalSeconds = Math.round(this.metrics.totalHours * 3600);
      const workouts = this.metrics.totalWorkouts;
      const avgSeconds = Math.round(totalSeconds / workouts);
      
      return `${this.formatTotalTime(this.metrics.totalHours)} en ${workouts} sesión${workouts > 1 ? 'es' : ''} (promedio: ${this.formatTime(avgSeconds)})`;
    }
  
    // MÉTODO auxiliar para formatear tiempo individual
    private formatTime(seconds: number): string {
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSecs = seconds % 60;
      return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
    }
  // ✅ OBTENER COLOR DE MEJORA
  getImprovementColor(improvement: number | undefined): string {
    if (!improvement || improvement === 0) return '#ff9800'; // Naranja para neutro
    if (improvement > 0) return '#4caf50'; // Verde para mejora
    return '#ff5722'; // Rojo para empeoramiento
  }

  // ✅ REFRESCAR MÉTRICAS MANUALMENTE
  refreshMetrics(): void {
    console.log('🔄 Refrescando métricas dashboard...');
    this.loadDashboardMetrics();
  }

  // 🆕 NAVEGACIÓN FUNCIONAL - BOTONES DEL DASHBOARD
  async navigateToTraining(): Promise<void> {
    console.log('🎯 Navegando a entrenamiento...');
    
    const alert = await this.alertController.create({
      header: 'Iniciar Entrenamiento',
      message: '¿Estás listo para empezar tu sesión de entrenamiento?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Comenzar',
          handler: () => {
            this.router.navigate(['/tabs/tab2']).then(() => {
              this.showToast('¡Redirigiéndote al entrenamiento!', 'success');
            });
          }
        }
      ]
    });

    await alert.present();
  }

  navigateToProfile(): void {
    console.log('👤 Navegando a perfil...');
    this.router.navigate(['/tabs/tab3']).then(() => {
      this.showToast('Accediendo a tu perfil', 'primary');
    });
  }

  async navigateToHistory(): Promise<void> {
    console.log('📈 Navegando a historial...');
    
    if (!this.metrics || this.metrics.isEmpty) {
      const alert = await this.alertController.create({
        header: 'Sin Historial',
        message: 'Aún no tienes entrenamientos registrados. ¡Comienza tu primera sesión!',
        buttons: [
          {
            text: 'OK',
            role: 'cancel'
          },
          {
            text: 'Entrenar Ahora',
            handler: () => {
              this.navigateToTraining();
            }
          }
        ]
      });

      await alert.present();
      return;
    }

    // Aquí podrías navegar a una página de historial si la tienes
    this.showToast('Historial de entrenamientos', 'primary');
  }

  // 🆕 ACCIÓN PARA VER MÁS ALERTAS
  async viewAllAlerts(): Promise<void> {
    if (!this.metrics || this.metrics.recentAlerts.length === 0) {
      const alert = await this.alertController.create({
        header: 'Sin Alertas',
        message: 'No tienes alertas recientes. ¡Esto significa que estás entrenando muy bien!',
        buttons: ['OK']
      });

      await alert.present();
      return;
    }

    // Aquí podrías navegar a una página de alertas detalladas
    this.showToast(`Tienes ${this.metrics.recentAlerts.length} alertas recientes`, 'primary');
  }

  // 🆕 OBTENER MENSAJE MOTIVACIONAL SEGÚN EL ESTADO
  getMotivationalMessage(): string {
    if (!this.metrics || this.metrics.isEmpty) {
      return '¡Comienza tu primer entrenamiento con IA!';
    }

    if (this.metrics.accuracy >= 90) {
      return '¡Excelente técnica! Sigue así 💪';
    }

    if (this.metrics.accuracy >= 75) {
      return '¡Buen progreso! Puedes mejorar aún más 🎯';
    }

    return '¡Cada entrenamiento te hace mejor! 🚀';
  }

  // 🆕 OBTENER CONSEJO SEGÚN LOS DATOS
  getTrainingTip(): string {
    if (!this.metrics || this.metrics.isEmpty) {
      return 'Tip: La IA analizará tu postura en tiempo real';
    }

    if (this.metrics.mostCommonError) {
      const errorLabel = this.getErrorTypeLabel(this.metrics.mostCommonError);
      return `Tip: Enfócate en mejorar ${errorLabel.toLowerCase()}`;
    }

    if (this.metrics.currentStreak > 0) {
      return `¡Llevas ${this.metrics.currentStreak} días consecutivos! 🔥`;
    }

    return 'Tip: La constancia es clave para el progreso';
  }

  // ✅ UTILIDADES
  getCompletedDaysCount(): number {
    return this.weeklyGoalDays.filter(day => day.completed).length;
  }

  trackAlert(index: number, alert: any): string {
    return alert.id || index.toString();
  }

  // 🆕 MÉTODOS AUXILIARES PARA EL HTML (CORRIGEN ERRORES TYPESCRIPT)
  getAccuracyBadgeColor(accuracy: number): string {
    if (accuracy >= 90) return '#4caf50';
    if (accuracy >= 75) return '#ff9800';
    return '#ff5722';
  }

  getAccuracyBadgeText(accuracy: number): string {
    if (accuracy >= 90) return 'Excelente';
    if (accuracy >= 75) return 'Bueno';
    return 'Mejorable';
  }

  getImprovementText(improvement: number): string {
    if (improvement > 0) return `+${improvement}%`;
    if (improvement < 0) return `${improvement}%`;
    return '0%';
  }

  getConfidencePercentage(confidence: number): number {
    return Math.round((confidence || 0) * 100);
  }

  hasErrorsByType(metrics: DashboardMetrics): boolean {
    return metrics.errorsByType && Object.keys(metrics.errorsByType).length > 0;
  }

  // 🆕 MOSTRAR MENSAJES AL USUARIO
  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
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
}