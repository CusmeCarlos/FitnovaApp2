import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileService } from '../../services/profile.service';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonSelect, IonSelectOption } from "@ionic/angular/standalone";
import { ReactiveFormsModule } from '@angular/forms';
  

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
    IonSelect,
    IonSelectOption
  ]
})
export class ProfilePage implements OnInit {
  profileForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private profileSvc: ProfileService,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    this.profileForm = this.fb.group({
      age: ['', Validators.required],
      gender: ['', Validators.required],
      weight: ['', Validators.required],
      height: ['', Validators.required],
      // puedes añadir más controles para medicalHistory y goals
    });
  }

  ngOnInit() {
    this.profileSvc.getUserProfile().subscribe(profile => {
      if (profile) {
        this.profileForm.patchValue({
          age: profile.personalInfo.age,
          gender: profile.personalInfo.gender,
          weight: profile.personalInfo.weight,
          height: profile.personalInfo.height
        });
      }
    });
  }

  async onSubmit() {
    if (this.profileForm.invalid) return;
    try {
      const data = {
        personalInfo: {
          age: this.profileForm.value.age,
          gender: this.profileForm.value.gender,
          weight: this.profileForm.value.weight,
          height: this.profileForm.value.height
        }
      };
      await this.profileSvc.updateProfile(data);
      const toast = await this.toastCtrl.create({
        message: 'Perfil guardado con éxito',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      this.router.navigate(['/tabs']); // o a la siguiente página
    } catch (err) {
      const toast = await this.toastCtrl.create({
        message: 'Error al guardar perfil',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }
}
