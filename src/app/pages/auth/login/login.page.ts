import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { FirebaseError } from 'firebase/app';
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
    private toastController: ToastController,
    private loadingController: LoadingController
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

  // Getters para acceder fácilmente a los form controls
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;
    
    const loading = await this.loadingController.create({
      message: 'Iniciando sesión...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      const { email, password } = this.loginForm.value;
      await this.authService.login(email, password);
      await this.router.navigate(['/tabs']);
    } catch (error) {
      let message = 'Ocurrió un error durante el inicio de sesión';
      
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/user-not-found':
            message = 'No existe una cuenta con este correo electrónico';
            break;
          case 'auth/wrong-password':
            message = 'Contraseña incorrecta';
            break;
          case 'auth/too-many-requests':
            message = 'Demasiados intentos fallidos. Intente más tarde';
            break;
          case 'auth/invalid-email':
            message = 'El formato del correo electrónico no es válido';
            break;
        }
      }
      
      const toast = await this.toastController.create({
        message,
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
      this.loading = false;
    }
  }

  async googleLogin() {
    const loading = await this.loadingController.create({
      message: 'Iniciando sesión con Google...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      await this.authService.googleLogin();
      await this.router.navigate(['/tabs']);
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Error al iniciar sesión con Google',
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
      this.loading = false;
    }
  }
}