import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { trigger, transition, style, animate } from '@angular/animations';
import { DashboardService, CriticalAlert } from '../../services/dashboard.service';

interface AlertStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

@Component({
  selector: 'app-alerts-modal',
  templateUrl: './alerts-modal.component.html',
  styleUrls: ['./alerts-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.4s ease-in', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class AlertsModalComponent implements OnInit {
  alerts: CriticalAlert[] = [];
  stats: AlertStats = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0
  };
  loading = true;

  constructor(
    private modalController: ModalController,
    private dashboardService: DashboardService
  ) {}

  async ngOnInit() {
    await this.loadAlerts();
  }

  async loadAlerts() {
    this.loading = true;
    try {
      // Obtener alertas del dashboard service (máximo 100)
      this.dashboardService.getRecentCriticalAlerts(100).subscribe((alerts: CriticalAlert[]) => {
        this.alerts = alerts;
        this.calculateStats();
        this.loading = false;
      });
    } catch (error) {
      console.error('❌ Error cargando alertas:', error);
      this.loading = false;
    }
  }

  calculateStats() {
    this.stats = {
      critical: this.alerts.filter(a => a.severity === 'critical').length,
      high: this.alerts.filter(a => a.severity === 'high').length,
      medium: this.alerts.filter(a => a.severity === 'medium').length,
      low: this.alerts.filter(a => a.severity === 'low').length,
      total: this.alerts.length
    };
  }

  getSeverityGradient(severity: string): string {
    if (severity === 'critical') return 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
    if (severity === 'high') return 'linear-gradient(135deg, #ffa502 0%, #ff6348 100%)';
    if (severity === 'medium') return 'linear-gradient(135deg, #ffd32a 0%, #ffa502 100%)';
    return 'linear-gradient(135deg, #48dbfb 0%, #0abde3 100%)';
  }

  getSeverityColor(severity: string): string {
    if (severity === 'critical') return 'danger';
    if (severity === 'high') return 'warning';
    if (severity === 'medium') return 'medium';
    return 'success';
  }

  getSeverityText(severity: string): string {
    if (severity === 'critical') return 'Crítica';
    if (severity === 'high') return 'Alta';
    if (severity === 'medium') return 'Media';
    return 'Baja';
  }

  getSeverityIcon(severity: string): string {
    if (severity === 'critical') return 'alert-circle';
    if (severity === 'high') return 'warning';
    if (severity === 'medium') return 'information-circle';
    return 'checkmark-circle';
  }

  getRelativeTime(timestamp: Date | any): string {
    const now = new Date();
    const alertTime = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return alertTime.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
