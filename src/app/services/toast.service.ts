// CREAR NUEVO ARCHIVO: src/app/services/toast.service.ts
// 🎨 SERVICIO CENTRALIZADO PARA TOASTS PREMIUM

import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

export type ToastType = 'success' | 'warning' | 'danger' | 'medium' | 'primary' | 'secondary';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  showCloseButton?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(private toastController: ToastController) {}

  /**
   * Muestra un toast premium con estilos automáticos
   */
  async show(options: ToastOptions): Promise<void> {
    const {
      message,
      type = 'medium',
      duration = 3000,
      position = 'bottom',
      showCloseButton = false
    } = options;

    const toast = await this.toastController.create({
      message,
      duration,
      position,
      color: type,
      cssClass: [`toast-${type}`, 'professional-toast'],
      buttons: showCloseButton ? [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ] : undefined
    });

    await toast.present();
  }

  /**
   * Muestra un toast de éxito
   */
  async success(message: string, duration = 2000): Promise<void> {
    await this.show({ message, type: 'success', duration });
  }

  /**
   * Muestra un toast de advertencia
   */
  async warning(message: string, duration = 3000): Promise<void> {
    await this.show({ message, type: 'warning', duration });
  }

  /**
   * Muestra un toast de error
   */
  async error(message: string, duration = 4000): Promise<void> {
    await this.show({ message, type: 'danger', duration, showCloseButton: true });
  }

  /**
   * Muestra un toast informativo
   */
  async info(message: string, duration = 3000): Promise<void> {
    await this.show({ message, type: 'primary', duration });
  }

  /**
   * Muestra un toast de IA/generación
   */
  async ai(message: string, duration = 3000): Promise<void> {
    await this.show({ message, type: 'secondary', duration });
  }

  // ================================================================================
  // MENSAJES PREDEFINIDOS PREMIUM
  // ================================================================================

  async accediendoPerfil(): Promise<void> {
    await this.info('🔐 Accediendo a tu perfil...');
  }

  async bienvenido(nombre?: string): Promise<void> {
    const message = nombre 
      ? `¡Bienvenido de vuelta, ${nombre}! 👋` 
      : '¡Bienvenido a FitNova! 🚀';
    await this.success(message);
  }

  async sesionCerrada(): Promise<void> {
    await this.success('✅ Sesión cerrada correctamente');
  }

  async redirigiendo(destino: string = 'entrenamiento'): Promise<void> {
    await this.info(`🏃‍♂️ Redirigiendo a ${destino}...`);
  }

  async guardandoCambios(): Promise<void> {
    await this.info('💾 Guardando cambios...');
  }

  async cambiosGuardados(): Promise<void> {
    await this.success('✅ Cambios guardados correctamente');
  }

  async generandoRutina(): Promise<void> {
    await this.ai('🤖 Generando rutina personalizada con IA...');
  }

  async rutinaGenerada(): Promise<void> {
    await this.success('✨ ¡Rutina generada exitosamente!');
  }

  async esperandoAprobacion(): Promise<void> {
    await this.warning('⏳ Esperando aprobación del entrenador...');
  }

  async errorGenerico(mensaje?: string): Promise<void> {
    await this.error(mensaje || '❌ Ha ocurrido un error inesperado');
  }

  async sincronizando(): Promise<void> {
    await this.info('🔄 Sincronizando datos...');
  }

  async sincronizacionCompleta(): Promise<void> {
    await this.success('✅ Sincronización completada');
  }

  async perfilActualizado(): Promise<void> {
    await this.success('✨ Perfil actualizado correctamente');
  }

  async fotoCambiada(): Promise<void> {
    await this.success('📸 Foto de perfil actualizada');
  }

  async entrenamientoIniciado(): Promise<void> {
    await this.success('🏋️ ¡Entrenamiento iniciado! Dale con todo 💪');
  }

  async entrenamientoCompletado(): Promise<void> {
    await this.success('🎉 ¡Entrenamiento completado! Excelente trabajo 💪');
  }

  async errorConexion(): Promise<void> {
    await this.error('🌐 Error de conexión. Verifica tu internet');
  }

  async funcionNoDisponible(): Promise<void> {
    await this.warning('⚠️ Esta función estará disponible próximamente');
  }
}