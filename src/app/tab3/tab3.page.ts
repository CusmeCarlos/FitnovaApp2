import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/user.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton, 
  IonButtons, 
  IonIcon, 
  IonLabel,
  IonInput,
  IonTextarea,
  IonToggle,
  IonChip,
  IonSpinner,
  ToastController,
  AlertController
} from "@ionic/angular/standalone";

interface MedicalHistory {
  conditions: string;
  injuries: string;
  medications: string;
  lastUpdated?: Date;
}

interface AppSettings {
  pushNotifications: boolean;
  autoDetection: boolean;
  soundFeedback: boolean;
  darkMode: boolean;
}

interface UserStats {
  totalWorkouts: number;
  achievements: number;
  activeDays: number;
  aiAccuracy: number;
  errorsDetected: string;
}

@Component({
  selector: 'app-tab3',
  templateUrl: './tab3.page.html',
  styleUrls: ['./tab3.page.scss'],
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
    IonInput,
    IonTextarea,
    IonToggle,
    IonChip,
    IonSpinner
  ]
})
export class Tab3Page implements OnInit, OnDestroy {
  user: User | null = null;
  private userSubscription: Subscription = new Subscription();

  // Datos del perfil
  userStats: UserStats = {
    totalWorkouts: 127,
    achievements: 15,
    activeDays: 45,
    aiAccuracy: 94,
    errorsDetected: '8/10'
  };

  // Historial médico
  medicalHistory: MedicalHistory = {
    conditions: '',
    injuries: '',
    medications: '',
    lastUpdated: undefined
  };

  // Configuraciones de la app
  appSettings: AppSettings = {
    pushNotifications: true,
    autoDetection: true,
    soundFeedback: false,
    darkMode: true
  };

  // Estado de la UI
  isEditingProfile = false;
  isSavingMedical = false;

  constructor(
    private auth: AuthService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadMedicalHistory();
    this.loadAppSettings();
  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
  }

  private loadUserData() {
    this.userSubscription = this.auth.user$.subscribe(user => {
      this.user = user;
      if (user) {
        this.loadUserStats(user.uid);
      }
    });
  }

  private loadUserStats(userId: string) {
    // TODO: Cargar estadísticas reales desde Firebase
    // Por ahora usar datos de ejemplo
    try {
      const savedStats = localStorage.getItem(`fitnova_stats_${userId}`);
      if (savedStats) {
        this.userStats = { ...this.userStats, ...JSON.parse(savedStats) };
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  }

  private loadMedicalHistory() {
    // TODO: Cargar historial médico desde Firebase
    try {
      const savedMedical = localStorage.getItem(`fitnova_medical_${this.user?.uid}`);
      if (savedMedical) {
        this.medicalHistory = JSON.parse(savedMedical);
      }
    } catch (error) {
      console.error('Error loading medical history:', error);
    }
  }

  private loadAppSettings() {
    // TODO: Cargar configuraciones desde Firebase/Storage
    try {
      const savedSettings = localStorage.getItem(`fitnova_settings_${this.user?.uid}`);
      if (savedSettings) {
        this.appSettings = { ...this.appSettings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Error loading app settings:', error);
    }
  }

  // 💾 Guardar historial médico
  async saveMedicalHistory() {
    if (!this.user) return;

    this.isSavingMedical = true;
    
    try {
      this.medicalHistory.lastUpdated = new Date();
      
      // TODO: Guardar en Firebase
      localStorage.setItem(
        `fitnova_medical_${this.user.uid}`, 
        JSON.stringify(this.medicalHistory)
      );

      await this.showToast('Historial médico guardado correctamente', 'success');
    } catch (error) {
      console.error('Error saving medical history:', error);
      await this.showToast('Error al guardar el historial médico', 'danger');
    } finally {
      this.isSavingMedical = false;
    }
  }

  // ⚙️ Cambiar configuración
  async onSettingChange(setting: keyof AppSettings, value: boolean) {
    this.appSettings[setting] = value;
    
    try {
      // TODO: Guardar en Firebase
      localStorage.setItem(
        `fitnova_settings_${this.user?.uid}`, 
        JSON.stringify(this.appSettings)
      );

      // Lógica específica para cada configuración
      switch (setting) {
        case 'pushNotifications':
          await this.handlePushNotifications(value);
          break;
        case 'darkMode':
          await this.handleDarkMode(value);
          break;
        case 'autoDetection':
          await this.showToast(
            value ? 'Detección automática activada' : 'Detección automática desactivada',
            'primary'
          );
          break;
        case 'soundFeedback':
          await this.showToast(
            value ? 'Sonidos activados' : 'Sonidos desactivados',
            'primary'
          );
          break;
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      // Revertir el cambio si hay error
      this.appSettings[setting] = !value;
    }
  }

  // 🔔 Manejar notificaciones push
  private async handlePushNotifications(enabled: boolean) {
    if (enabled) {
      // TODO: Solicitar permisos de notificación
      // TODO: Registrar con Firebase Cloud Messaging
      await this.showToast('Notificaciones activadas', 'success');
    } else {
      // TODO: Desregistrar notificaciones
      await this.showToast('Notificaciones desactivadas', 'warning');
    }
  }

  // 🌙 Manejar modo oscuro
  private async handleDarkMode(enabled: boolean) {
    // TODO: Implementar toggle de tema
    document.body.classList.toggle('dark', enabled);
    await this.showToast(
      enabled ? 'Modo oscuro activado' : 'Modo claro activado',
      'primary'
    );
  }

  // 📷 Cambiar avatar
  async changeAvatar() {
    const alert = await this.alertController.create({
      header: 'Cambiar Avatar',
      message: 'Esta función estará disponible próximamente',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Galería',
          handler: () => {
            // TODO: Implementar selección desde galería
            this.showToast('Función en desarrollo', 'warning');
          }
        },
        {
          text: 'Cámara',
          handler: () => {
            // TODO: Implementar captura con cámara
            this.showToast('Función en desarrollo', 'warning');
          }
        }
      ]
    });

    await alert.present();
  }

  // 📧 Verificar email
  async verifyEmail() {
    if (!this.user || this.user.emailVerified) return;

    try {
      // TODO: Enviar email de verificación
      await this.showToast('Email de verificación enviado', 'success');
    } catch (error) {
      console.error('Error sending verification email:', error);
      await this.showToast('Error al enviar verificación', 'danger');
    }
  }

  // 🚪 Cerrar sesión
  async logout() {
    const alert = await this.alertController.create({
      header: '¿Cerrar Sesión?',
      message: 'Se perderán los datos no guardados.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              await this.auth.logout();
              await this.showToast('Sesión cerrada correctamente', 'success');
            } catch (error) {
              console.error('Error during logout:', error);
              await this.showToast('Error al cerrar sesión', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // 🍞 Mostrar toast
  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  // 📊 Obtener estadísticas formateadas
  get formattedStats() {
    return {
      totalWorkouts: this.userStats.totalWorkouts.toLocaleString(),
      achievements: this.userStats.achievements.toString(),
      activeDays: this.userStats.activeDays.toString(),
      aiAccuracy: `${this.userStats.aiAccuracy}%`,
      errorsDetected: this.userStats.errorsDetected
    };
  }

  // 📅 Obtener fecha de última actualización médica
  get lastMedicalUpdate(): string {
    if (!this.medicalHistory.lastUpdated) {
      return 'Sin actualizar';
    }
    
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(this.medicalHistory.lastUpdated));
  }

  // ✅ Verificar si el historial médico está completo
  get isMedicalHistoryComplete(): boolean {
    return !!(
      this.medicalHistory.conditions.trim() ||
      this.medicalHistory.injuries.trim() ||
      this.medicalHistory.medications.trim()
    );
  }
}