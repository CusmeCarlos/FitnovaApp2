import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner } from "@ionic/angular/standalone";

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner
  ]
})
export class ResetPasswordPage implements OnInit {
  resetForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit() {}

  get email() { return this.resetForm.get('email'); }

  async onSubmit() {
    if (this.resetForm.invalid) return;
    this.loading = true;
    const loading = await this.loadingCtrl.create({ message: 'Enviando correo...' });
    await loading.present();

    try {
      await this.authService.resetPassword(this.email?.value);
      const toast = await this.toastCtrl.create({
        message: 'Mensaje enviado. Revisa tu email.',
        duration: 3000,
        color: 'success'
      });
      toast.present();
      this.router.navigate(['/auth/login']);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Error al enviar correo. Intenta más tarde.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    } finally {
      this.loading = false;
      loading.dismiss();
    }
  }
}
