import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FirebaseError } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  constructor(private toastController: ToastController) { }

  async handleFirebaseError(error: any): Promise<void> {
    let message = 'Ocurrió un error inesperado';
    
    console.error('🛑 Firebase Error:', error);
    
    if (error?.code) {
      switch (error.code) {
        case 'auth/user-not-found':
          message = 'No existe una cuenta con este correo electrónico';
          break;
        case 'auth/wrong-password':
          message = 'Contraseña incorrecta';
          break;
        case 'auth/email-already-in-use':
          message = 'Ya existe una cuenta con este correo electrónico';
          break;
        case 'auth/weak-password':
          message = 'La contraseña debe tener al menos 6 caracteres';
          break;
        case 'auth/invalid-email':
          message = 'El formato del correo electrónico no es válido';
          break;
        case 'auth/too-many-requests':
          message = 'Demasiados intentos fallidos. Intente más tarde';
          break;
        case 'auth/network-request-failed':
          message = 'Error de conexión. Verifica tu conexión a internet';
          break;
        case 'auth/operation-not-allowed':
          message = 'Método de autenticación no habilitado';
          break;
        case 'auth/user-disabled':
          message = 'Esta cuenta ha sido deshabilitada';
          break;
        case 'auth/requires-recent-login':
          message = 'Por seguridad, debes iniciar sesión nuevamente';
          break;
        default:
          message = error.message || 'Error de autenticación';
      }
    } else if (error?.message) {
      message = error.message;
    }

    const toast = await this.toastController.create({
      message,
      duration: 4000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  async handleGeneralError(error: any, customMessage?: string): Promise<void> {
    const message = customMessage || error?.message || 'Ocurrió un error inesperado';
    
    console.error('🛑 General Error:', error);
    
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }

  async showSuccess(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }
}