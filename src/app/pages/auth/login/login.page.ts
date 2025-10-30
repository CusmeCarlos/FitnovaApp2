// src/app/pages/auth/login/login.page.ts
// ✅ CORREGIDO - CON MANEJO DE ERRORES ESPECÍFICOS

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    // Verificar si el usuario ya está autenticado
    this.authService.user$.subscribe(user => {
      if (user) {
        this.router.navigate(['/tabs']);
      }
    });
  }

  // ✅ GETTERS PARA ACCEDER A LOS FORM CONTROLS
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  // ✅ TOGGLE PASSWORD VISIBILITY
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // ✅ SUBMIT LOGIN FORM CON MANEJO DE ERRORES ESPECÍFICOS
  async onSubmit() {
    if (this.loginForm.invalid) return;
    
    this.loading = true;
    const loading = await this.loadingController.create({
      message: 'Iniciando sesión...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      const { email, password } = this.loginForm.value;
      await this.authService.login(email, password);
      // El AuthService maneja el éxito y navegación
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      
      // ✅ MOSTRAR MENSAJE DE ERROR ESPECÍFICO
      let errorMessage = 'Correo o contraseña incorrecta. Verifica e intenta nuevamente';
      
      if (error?.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
          case 'auth/invalid-login-credentials':
            errorMessage = 'Correo o contraseña incorrecta. Verifica e intenta nuevamente';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta cuenta ha sido deshabilitada';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Error de conexión. Verifica tu conexión a internet';
            break;
          default:
            errorMessage = 'Correo o contraseña incorrecta. Verifica e intenta nuevamente';
        }
      }
      
      // ✅ MOSTRAR TOAST PREMIUM CON ERROR
      await this.showErrorToast(errorMessage);
    } finally {
      await loading.dismiss();
      this.loading = false;
    }
  }

  // ✅ MÉTODO PARA MOSTRAR TOAST DE ERROR PREMIUM
  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: 4000,
      position: 'top',
      color: 'danger',
      cssClass: 'custom-error-toast',
      buttons: [
        {
          text: '✕',
          role: 'cancel',
          handler: () => {
            console.log('Toast cerrado');
          }
        }
      ]
    });
    await toast.present();
  }
}