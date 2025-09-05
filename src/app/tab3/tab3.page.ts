// src/app/tab3/tab3.page.ts
// ✅ TAB3 CORREGIDO - SIN ERRORES DE COMPILACIÓN

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ActionSheetController } from '@ionic/angular';
import { ProfileService } from '../services/profile.service';
import { User } from '../interfaces/user.interface';
import { Profile } from '../interfaces/profile.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import firebase from 'firebase/compat/app';
import 'firebase/compat/storage';
import 'firebase/compat/firestore';
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonCheckbox,
  ToastController,
  AlertController,
} from "@ionic/angular/standalone";

@Component({
  selector: 'app-tab3',
  templateUrl: './tab3.page.html',
  styleUrls: ['./tab3.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    IonChip,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonCheckbox,
  ]
})
export class Tab3Page implements OnInit, OnDestroy {
  user: User | null = null;
  profile: Profile | null = null;
  
  private userSubscription: Subscription = new Subscription();
  private profileSubscription: Subscription = new Subscription();

  // ✅ FORMULARIOS REACTIVOS
  personalInfoForm!: FormGroup;
  medicalHistoryForm!: FormGroup;
  fitnessGoalsForm!: FormGroup;
  fitnessLevelForm!: FormGroup;
  trainingPreferencesForm!: FormGroup;

  // ✅ ESTADO DE LA UI
  currentSection: 'personal' | 'medical' | 'goals' | 'level' | 'preferences' = 'personal';
  isLoading = false;
  isSaving = false;
  profileCompletionPercentage = 0;

  // ✅ DATOS DE OPCIONES PARA SELECTS
  genderOptions = [
    { value: 'male', label: 'Masculino' },
    { value: 'female', label: 'Femenino' },
    { value: 'other', label: 'Otro' }
  ];

  relationshipOptions = [
    'Padre/Madre', 
    'Esposo/Esposa',
    'Hermano/Hermana',
    'Hijo/Hija',
    'Amigo/Amiga',
    'Médico',
    'Otro'
  ];

  severityOptions = [
    { value: 'mild', label: 'Leve' },
    { value: 'moderate', label: 'Moderada' },
    { value: 'severe', label: 'Severa' }
  ];

  primaryGoalsOptions = [
    { value: 'weight_loss', label: 'Pérdida de peso' },
    { value: 'muscle_gain', label: 'Ganancia muscular' },
    { value: 'strength', label: 'Fuerza' },
    { value: 'endurance', label: 'Resistencia' },
    { value: 'flexibility', label: 'Flexibilidad' },
    { value: 'general_fitness', label: 'Fitness general' }
  ];

  fitnessLevelOptions = [
    { value: 'beginner', label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio' },
    { value: 'advanced', label: 'Avanzado' }
  ];

  experienceLevelOptions = [
    { value: 'none', label: 'Ninguna' },
    { value: 'beginner', label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio' },
    { value: 'advanced', label: 'Avanzado' }
  ];

  daysOptions = [
    { value: 'monday', label: 'Lunes' },
    { value: 'tuesday', label: 'Martes' },
    { value: 'wednesday', label: 'Miércoles' },
    { value: 'thursday', label: 'Jueves' },
    { value: 'friday', label: 'Viernes' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' }
  ];

  constructor(
    private auth: AuthService,
    private profileService: ProfileService,
    private formBuilder: FormBuilder,
    private toastController: ToastController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private router: Router,
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.initializeSubscriptions();
  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
    this.profileSubscription.unsubscribe();
  }

  // ✅ INICIALIZAR SUSCRIPCIONES
  private initializeSubscriptions(): void {
    // Suscripción al usuario
    this.userSubscription = this.auth.user$.subscribe(user => {
      this.user = user;
    });

    // Suscripción al perfil
    this.profileSubscription = this.profileService.getCurrentProfile().subscribe(profile => {
      this.profile = profile;
      this.profileCompletionPercentage = profile?.profileCompletionPercentage || 0;
      
      if (profile) {
        this.populateFormsWithProfile(profile);
      }
    });
  }

  // ✅ INICIALIZAR FORMULARIOS
  private initializeForms(): void {
    // Formulario información personal
    this.personalInfoForm = this.formBuilder.group({
      age: ['', [Validators.required, Validators.min(13), Validators.max(100)]],
      gender: ['', Validators.required],
      weight: ['', [Validators.required, Validators.min(30), Validators.max(300)]],
      height: ['', [Validators.required, Validators.min(100), Validators.max(250)]],
      dateOfBirth: [''],
      phoneNumber: [''],
      emergencyContact: this.formBuilder.group({
        name: [''],
        phone: [''],
        relationship: ['']
      }),
      
    });

    // Formulario historial médico
    this.medicalHistoryForm = this.formBuilder.group({
      // Campos básicos existentes
      conditions: this.formBuilder.array([]),
      injuries: this.formBuilder.array([]),
      limitations: this.formBuilder.array([]),
      // Campos expandidos
      currentConditions: this.formBuilder.array([]),
      chronicDiseases: this.formBuilder.array([]),
      allergies: this.formBuilder.array([]),
      medications: this.formBuilder.array([]),
      lastMedicalCheckup: [''],
      doctorClearance: [false],
      doctorNotes: [''],
      heartConditions: this.formBuilder.array([]),
    });

    // Formulario objetivos fitness
    this.fitnessGoalsForm = this.formBuilder.group({
      primaryGoals: [[], Validators.required],
      targetWeight: [''],
      targetBodyFat: [''],
      preferredWorkoutTypes: [[]],
      preferredWorkoutDuration: [''],
      preferredWorkoutFrequency: ['']
    });

    // Formulario nivel fitness
   // Formulario nivel fitness
  this.fitnessLevelForm = this.formBuilder.group({
  overallLevel: ['', Validators.required],
  strengthTraining: [''],
  cardioTraining: [''],
  flexibilityTraining: [''],
  sportsExperience: [''],
  yearsOfTraining: [''],
  monthsOfTraining: [''],
  previousGymExperience: [false]
});

    // Formulario preferencias de entrenamiento
    this.trainingPreferencesForm = this.formBuilder.group({
      availableDays: [[]],
      preferredTimeSlots: [[]],
      maxSessionDuration: [''],
      preferredEnvironment: [[]],
      spaceConstraints: [''],
      preferredIntensity: [''],
      needsMotivation: [false],
      prefersGroupWorkouts: [false],
      feedbackPreferences: this.formBuilder.group({
        audioFeedback: [true],
        visualFeedback: [true],
        hapticFeedback: [false],
        realTimeCorrections: [true],
        postWorkoutAnalysis: [true]
      })
    });
  }

  // ✅ POBLAR FORMULARIOS CON DATOS DEL PERFIL
  private populateFormsWithProfile(profile: Profile): void {
    // Información personal
    if (profile.personalInfo) {
      this.personalInfoForm.patchValue({
        age: profile.personalInfo.age || '',
        gender: profile.personalInfo.gender || '',
        weight: profile.personalInfo.weight || '',
        height: profile.personalInfo.height || '',
        dateOfBirth: profile.personalInfo.dateOfBirth || '',
        phoneNumber: profile.personalInfo.phoneNumber || '',
        emergencyContact: {
          name: profile.personalInfo.emergencyContact?.name || '',
          phone: profile.personalInfo.emergencyContact?.phone || '',
          relationship: profile.personalInfo.emergencyContact?.relationship || ''
        },
      
      });
    }

    // Historial médico
    if (profile.medicalHistory) {
      // Campos básicos
      this.populateStringArrays('medicalHistoryForm', 'conditions', profile.medicalHistory.conditions);
      this.populateStringArrays('medicalHistoryForm', 'injuries', profile.medicalHistory.injuries);
      this.populateStringArrays('medicalHistoryForm', 'limitations', profile.medicalHistory.limitations);
      
      // Campos expandidos
      this.populateStringArrays('medicalHistoryForm', 'currentConditions', profile.medicalHistory.currentConditions);
      this.populateStringArrays('medicalHistoryForm', 'chronicDiseases', profile.medicalHistory.chronicDiseases);
      this.populateStringArrays('medicalHistoryForm', 'allergies', profile.medicalHistory.allergies);
      this.populateStringArrays('medicalHistoryForm', 'medications', profile.medicalHistory.medications);
      this.populateStringArrays('medicalHistoryForm', 'heartConditions', profile.medicalHistory.heartConditions);
    
      
      this.medicalHistoryForm.patchValue({
        lastMedicalCheckup: profile.medicalHistory.lastMedicalCheckup || '',
        doctorClearance: profile.medicalHistory.doctorClearance || false,
        doctorNotes: profile.medicalHistory.doctorNotes || '',
      });
    }

    // Objetivos fitness
    if (profile.fitnessGoals) {
      this.fitnessGoalsForm.patchValue({
        primaryGoals: profile.fitnessGoals.primaryGoals || [],
        targetWeight: profile.fitnessGoals.targetWeight || '',
        targetBodyFat: profile.fitnessGoals.targetBodyFat || '',
        preferredWorkoutTypes: profile.fitnessGoals.preferredWorkoutTypes || [],
        preferredWorkoutDuration: profile.fitnessGoals.preferredWorkoutDuration || '',
        preferredWorkoutFrequency: profile.fitnessGoals.preferredWorkoutFrequency || ''
      });
    }

    // Nivel fitness
    this.fitnessLevelForm.patchValue({
      overallLevel: profile.fitnessLevel || ''
    });

    // Preferencias de entrenamiento
    if (profile.trainingPreferences) {
      this.trainingPreferencesForm.patchValue({
        availableDays: profile.trainingPreferences.availableDays || [],
        preferredTimeSlots: profile.trainingPreferences.preferredTimeSlots || [],
        maxSessionDuration: profile.trainingPreferences.maxSessionDuration || '',
        preferredEnvironment: profile.trainingPreferences.preferredEnvironment || [],
        spaceConstraints: profile.trainingPreferences.spaceConstraints || '',
        preferredIntensity: profile.trainingPreferences.preferredIntensity || '',
        needsMotivation: profile.trainingPreferences.needsMotivation || false,
        prefersGroupWorkouts: profile.trainingPreferences.prefersGroupWorkouts || false
      });

      if (profile.trainingPreferences.feedbackPreferences) {
        this.trainingPreferencesForm.get('feedbackPreferences')?.patchValue(
          profile.trainingPreferences.feedbackPreferences
        );
      }
    }
  }

  // ✅ CAMBIAR SECCIÓN ACTIVA
  changeSection(section: any): void {
    if (section && typeof section === 'string') {
      this.currentSection = section as 'personal' | 'medical' | 'goals' | 'level' | 'preferences';
    }
  }

  // ✅ GUARDAR INFORMACIÓN PERSONAL
  async savePersonalInfo(): Promise<void> {
    if (this.personalInfoForm.invalid) {
      await this.showValidationErrors('Información Personal');
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.personalInfoForm.value;
      const personalInfo = {
        ...formValue,
      };

      const success = await this.profileService.updatePersonalInfo(personalInfo);
      
      if (success) {
        await this.showToast('Información personal guardada correctamente', 'success');
      } else {
        await this.showToast('Error al guardar la información personal', 'danger');
      }
    } catch (error) {
      await this.showToast('Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR HISTORIAL MÉDICO
  async saveMedicalHistory(): Promise<void> {
    this.isSaving = true;
    try {
      const formValue = this.medicalHistoryForm.value;
      const medicalHistory = {
        // Campos básicos
        conditions: this.getArrayValues('medicalHistoryForm', 'conditions'),
        injuries: this.getArrayValues('medicalHistoryForm', 'injuries'),
        limitations: this.getArrayValues('medicalHistoryForm', 'limitations'),
        // Campos expandidos
        currentConditions: this.getArrayValues('medicalHistoryForm', 'currentConditions'),
        chronicDiseases: this.getArrayValues('medicalHistoryForm', 'chronicDiseases'),
        allergies: this.getArrayValues('medicalHistoryForm', 'allergies'),
        medications: this.getArrayValues('medicalHistoryForm', 'medications'),
        heartConditions: this.getArrayValues('medicalHistoryForm', 'heartConditions'),
        lastMedicalCheckup: formValue.lastMedicalCheckup || undefined,
        doctorClearance: formValue.doctorClearance,
        doctorNotes: formValue.doctorNotes || undefined,

      };

      const success = await this.profileService.updateMedicalHistory(medicalHistory);
      
      if (success) {
        await this.showToast('Historial médico guardado correctamente', 'success');
      } else {
        await this.showToast('Error al guardar el historial médico', 'danger');
      }
    } catch (error) {
      await this.showToast('Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR OBJETIVOS FITNESS
  async saveFitnessGoals(): Promise<void> {
    if (this.fitnessGoalsForm.invalid) {
      await this.showValidationErrors('Objetivos Fitness');
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.fitnessGoalsForm.value;
      const fitnessGoals = {
        primaryGoals: formValue.primaryGoals,
        targetWeight: formValue.targetWeight || undefined,
        targetBodyFat: formValue.targetBodyFat || undefined,
        preferredWorkoutTypes: formValue.preferredWorkoutTypes,
        preferredWorkoutDuration: formValue.preferredWorkoutDuration || undefined,
        preferredWorkoutFrequency: formValue.preferredWorkoutFrequency || undefined
      };

      const success = await this.profileService.updateFitnessGoals(fitnessGoals);
      
      if (success) {
        await this.showToast('Objetivos fitness guardados correctamente', 'success');
      } else {
        await this.showToast('Error al guardar los objetivos fitness', 'danger');
      }
    } catch (error) {
      await this.showToast('Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR NIVEL FITNESS
  async saveFitnessLevel(): Promise<void> {
    if (this.fitnessLevelForm.invalid) {
      await this.showValidationErrors('Nivel Fitness');
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.fitnessLevelForm.value;
      const success = await this.profileService.updateFitnessLevel(formValue.overallLevel);
      
      if (success) {
        await this.showToast('Nivel fitness guardado correctamente', 'success');
      } else {
        await this.showToast('Error al guardar el nivel fitness', 'danger');
      }
    } catch (error) {
      await this.showToast('Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR PREFERENCIAS DE ENTRENAMIENTO
  async saveTrainingPreferences(): Promise<void> {
    this.isSaving = true;
    try {
      const formValue = this.trainingPreferencesForm.value;
      const trainingPreferences = {
        availableDays: formValue.availableDays,
        preferredTimeSlots: formValue.preferredTimeSlots,
        maxSessionDuration: formValue.maxSessionDuration || undefined,
        preferredEnvironment: formValue.preferredEnvironment,
        spaceConstraints: formValue.spaceConstraints || undefined,
        preferredIntensity: formValue.preferredIntensity || undefined,
        needsMotivation: formValue.needsMotivation,
        prefersGroupWorkouts: formValue.prefersGroupWorkouts,
        feedbackPreferences: formValue.feedbackPreferences
      };

      const success = await this.profileService.updateTrainingPreferences(trainingPreferences);
      
      if (success) {
        await this.showToast('Preferencias guardadas correctamente', 'success');
        await this.profileService.markProfileComplete(); // Marcar como completo al final
      } else {
        await this.showToast('Error al guardar las preferencias', 'danger');
      }
    } catch (error) {
      await this.showToast('Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }
  private populateStringArrays(formName: string, fieldName: string, values?: string[]): void {
    if (!values?.length) return;
    
    const form = this[formName as keyof this] as FormGroup;
    const formArray = form.get(fieldName) as FormArray;
    
    formArray.clear();
    values.forEach(value => {
      formArray.push(this.formBuilder.control(value));
    });
  }

  private getArrayValues(formName: string, fieldName: string): string[] {
    const form = this[formName as keyof this] as FormGroup;
    const formArray = form.get(fieldName) as FormArray;
    return formArray.value.filter((v: string) => v && v.trim());
  }

  // ✅ MÉTODOS DE FORMULARIOS DINÁMICOS
  addToArray(formName: string, fieldName: string, value: string = ''): void {
    const form = this[formName as keyof this] as FormGroup;
    const formArray = form.get(fieldName) as FormArray;
    formArray.push(this.formBuilder.control(value));
  }

  removeFromArray(formName: string, fieldName: string, index: number): void {
    const form = this[formName as keyof this] as FormGroup;
    const formArray = form.get(fieldName) as FormArray;
    formArray.removeAt(index);
  }

  getFormArray(formName: string, fieldName: string): FormArray {
    const form = this[formName as keyof this] as FormGroup;
    return form.get(fieldName) as FormArray;
  }

  // ✅ MÉTODOS DE UI
  async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  async showValidationErrors(section: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Campos requeridos',
      message: `Por favor, completa todos los campos obligatorios en la sección ${section}.`,
      buttons: ['OK']
    });
    await alert.present();
  }

  async changeAvatar(): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: 'Cambiar foto de perfil',
      cssClass: 'custom-action-sheet',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera-outline',
          handler: () => {
            this.takePictureFromCamera();
          }
        },
        {
          text: 'Elegir de galería', 
          icon: 'images-outline',
          handler: () => {
            this.selectFromGallery();
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }
  private async takePictureFromCamera(): Promise<void> {
    try {
      console.log('📸 Abriendo cámara web...');
      
      // Crear elementos temporales para captura
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('No se pudo obtener contexto del canvas');
      }
      
      // Obtener stream de cámara (igual que pose-camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      console.log('✅ Stream de cámara obtenido');
      
      // Configurar video
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      
      // Esperar a que cargue
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          console.log('✅ Video metadata cargada');
          resolve();
        };
        
        if (video.readyState >= 2) {
          onLoadedMetadata();
        } else {
          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        }
      });
      
      // Reproducir video
      await video.play();
      console.log('✅ Video reproduciendo');
      
      // Mostrar toast de preparación
      await this.showToast('Preparando cámara...', 'warning');
      
      // Configurar canvas con dimensiones del video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Crear modal con preview de cámara
      await this.showCameraModal(video, canvas, ctx, stream);
      
    } catch (error) {
      console.error('❌ Error abriendo cámara:', error);
      await this.showToast('Error al acceder a la cámara', 'danger');
    }
  }
  // ✅ MODAL DE CÁMARA CON PREVIEW:
private async showCameraModal(
  video: HTMLVideoElement, 
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D, 
  stream: MediaStream
): Promise<void> {
  const alert = await this.alertController.create({
    header: '📸 Capturar Foto',
    message: `
      <div style="text-align: center;">
        <p>Posiciona tu rostro en el centro</p>
        <div id="camera-preview" style="position: relative; width: 300px; height: 225px; margin: 10px auto; border: 2px solid #3880ff; border-radius: 8px; overflow: hidden;">
          <video id="preview-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
        </div>
      </div>
    `,
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel',
        handler: () => {
          // Detener stream
          stream.getTracks().forEach(track => track.stop());
        }
      },
      {
        text: '📸 Capturar',
        handler: () => {
          this.capturePhotoFromVideo(video, canvas, ctx, stream);
        }
      }
    ],
    cssClass: 'camera-modal'
  });
  
  await alert.present();
  
  // Después de que el modal se muestre, insertar el video
  setTimeout(() => {
    const previewContainer = document.getElementById('camera-preview');
    const previewVideo = document.getElementById('preview-video') as HTMLVideoElement;
    
    if (previewVideo && previewContainer) {
      previewVideo.srcObject = stream;
      previewVideo.play();
      console.log('✅ Preview de cámara activo');
    }
  }, 200);
}
// ✅ CAPTURAR FOTO DEL VIDEO:
private async capturePhotoFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D,
  stream: MediaStream
): Promise<void> {
  try {
    console.log('📸 Capturando foto...');
    
    // Dibujar frame actual en canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir a blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/jpeg', 0.8);
    });
    
    // Detener stream
    stream.getTracks().forEach(track => track.stop());
    console.log('✅ Stream detenido');
    
    // Subir foto
    await this.uploadProfilePhoto(blob);
    
  } catch (error) {
    console.error('❌ Error capturando foto:', error);
    stream.getTracks().forEach(track => track.stop());
    await this.showToast('Error capturando foto', 'danger');
  }
}
  
private async selectFromGallery(): Promise<void> {
  try {
    console.log('📁 Abriendo selector de archivos...');
    
    // Crear input file temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    // Promise para manejar selección
    const fileSelected = new Promise<File | null>((resolve) => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        resolve(file);
      });
      
      // Si se cancela
      input.addEventListener('cancel', () => resolve(null));
    });
    
    // Agregar al DOM y hacer click
    document.body.appendChild(input);
    input.click();
    
    // Esperar selección
    const file = await fileSelected;
    document.body.removeChild(input);
    
    if (file) {
      console.log('✅ Archivo seleccionado:', file.name);
      
      // Validar que sea imagen
      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo debe ser una imagen');
      }
      
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es muy grande (max 5MB)');
      }
      
      // Subir foto
      await this.uploadProfilePhoto(file);
    }
    
  } catch (error) {
    console.error('❌ Error seleccionando de galería:', error);
    await this.showToast(error instanceof Error ? error.message : 'Error seleccionando imagen', 'danger');
  }
}
// ✅ MÉTODO CORREGIDO - SIN ACTUALIZAR AUTH
private async uploadProfilePhoto(file: Blob | File): Promise<void> {
  try {
    this.isSaving = true;
    await this.showToast('Procesando imagen...', 'warning');
    
    // Convertir a base64
    const base64 = await this.fileToBase64(file);
    
    console.log('💾 Guardando en Firestore...');
    
    if (this.user?.uid) {
      // Guardar en Firestore users
      await firebase.firestore().collection('users').doc(this.user.uid).update({
        photoURL: base64,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // También en profiles
      const profileRef = firebase.firestore().collection('profiles').doc(this.user.uid);
      const profileDoc = await profileRef.get();
      if (profileDoc.exists) {
        await profileRef.update({
          photoURL: base64,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // ✅ SOLO ACTUALIZAR INTERFAZ LOCAL (NO FIREBASE AUTH)
      if (this.user) {
        this.user.photoURL = base64;
      }
      
      console.log('✅ Foto guardada correctamente');
      await this.showToast('✅ Foto actualizada correctamente', 'success');
    }
    
  } catch (error) {
    console.error('❌ Error guardando foto:', error);
    await this.showToast('Error al guardar la foto', 'danger');
  } finally {
    this.isSaving = false;
  }
}

// ✅ MÉTODO AUXILIAR PARA CONVERTIR A BASE64
private fileToBase64(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
  
private async updateUserPhotoProfile(photoURL: string): Promise<void> {
  try {
    // Actualizar Firebase Auth
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      await currentUser.updateProfile({ photoURL });
      console.log('✅ Foto actualizada en Auth');
    }
    
    // Actualizar interfaz local
    if (this.user) {
      this.user.photoURL = photoURL;
    }
    
    // Actualizar en Firestore users
    if (this.user?.uid) {
      await firebase.firestore().collection('users').doc(this.user.uid)
        .update({ 
          photoURL,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      console.log('✅ Foto actualizada en Firestore users');
    }
    
    // Actualizar en profiles si existe
    if (this.user?.uid) {
      const profileRef = firebase.firestore().collection('profiles').doc(this.user.uid);
      const profileDoc = await profileRef.get();
      
      if (profileDoc.exists) {
        await profileRef.update({ 
          photoURL,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Foto actualizada en Firestore profiles');
      }
    }
    
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
  }
}

  
  private async updateUserPhoto(photoURL: string): Promise<void> {
    try {
      if (this.user?.uid) {
        const userRef = firebase.firestore().collection('users').doc(this.user.uid);
        await userRef.update({ photoURL });
        
        // También actualizar en profiles si existe
        const profileRef = firebase.firestore().collection('profiles').doc(this.user.uid);
        const profileDoc = await profileRef.get();
        if (profileDoc.exists) {
          await profileRef.update({ photoURL });
        }
      }
    } catch (error) {
      console.error('Error actualizando foto en Firestore:', error);
    }
  }

  async verifyEmail(): Promise<void> {
    try {
      const currentUser = firebase.auth().currentUser;
      
      if (currentUser && !currentUser.emailVerified) {
        await currentUser.sendEmailVerification();
        
        const alert = await this.alertController.create({
          header: '📧 Verificación Enviada',
          message: 'Se ha enviado un correo de verificación a tu email. Revisa tu bandeja de entrada y spam.',
          buttons: [
            {
              text: 'OK',
              handler: () => {
                this.showToast('Revisa tu correo para verificar tu cuenta', 'success');
              }
            },
            {
              text: 'Reenviar',
              handler: async () => {
                try {
                  await currentUser.sendEmailVerification();
                  this.showToast('Correo reenviado', 'success');
                } catch (error) {
                  this.showToast('Error reenviando correo', 'danger');
                }
              }
            }
          ]
        });
        
        await alert.present();
      } else if (currentUser?.emailVerified) {
        await this.showToast('Tu email ya está verificado ✓', 'success');
      } else {
        await this.showToast('No hay usuario autenticado', 'warning');
      }
    } catch (error) {
      console.error('Error enviando verificación:', error);
      await this.showToast('Error enviando verificación. Inténtalo más tarde', 'danger');
    }
  }
  // Agrega este método a tab3.page.ts (al final, antes del último })

// ✅ MÉTODO PARA CALCULAR EL ANCHO DE LA BARRA DE PROGRESO

navigateToTraining(): void {
  console.log('🏃‍♂️ Navegando a entrenamiento desde perfil...');
  this.router.navigate(['/tabs/tab2']).then(() => {
    this.showToast('¡Redirigiéndote al entrenamiento!', 'success');
  });
}

getProgressWidth(): number {
  const sections = ['personal', 'medical', 'goals', 'level', 'preferences'];
  const currentIndex = sections.indexOf(this.currentSection);
  
  if (currentIndex === -1) return 0;
  
  // Calcular progreso basado en la sección actual
  const baseProgress = (currentIndex / (sections.length - 1)) * 100;
  
  // Ajustar progreso basado en completitud del perfil si está disponible
  if (this.profileCompletionPercentage > 0) {
    const sectionWeight = 20; // 20% por sección
    const currentSectionProgress = Math.min(this.profileCompletionPercentage, (currentIndex + 1) * sectionWeight);
    return Math.max(baseProgress, currentSectionProgress);
  }
  
  return baseProgress;
  
}
}