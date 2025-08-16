// src/app/pages/auth/login/login.page.ts
// ✅ CORREGIDO - SOLO EMAIL/PASSWORD SEGÚN DOCUMENTO

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoadingController } from '@ionic/angular';
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

  // ✅ GETTERS PARA ACCEDER A LOS FORM CONTROLS
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  // ✅ TOGGLE PASSWORD VISIBILITY
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // ✅ SUBMIT LOGIN FORM
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
    } catch (error) {
      // El ErrorHandlerService maneja todos los errores
      console.log('Error capturado en login page:', error);
    } finally {
      await loading.dismiss();
      this.loading = false;
    }
  }

  // 🗑️ ELIMINADO: googleLogin() - No está en documento
  // 🗑️ ELIMINADO: Links a reset-password - No está en documento
  // 🗑️ ELIMINADO: Links a register - Solo credenciales entrenador
}