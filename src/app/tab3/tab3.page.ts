// src/app/tab3/tab3.page.ts
// ✅ TAB3 CORREGIDO - SIN ERRORES DE COMPILACIÓN

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import { User } from '../interfaces/user.interface';
import { Profile } from '../interfaces/profile.interface';
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
  ActionSheetController
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
    private actionSheetController: ActionSheetController
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
      bodyFatPercentage: [''],
      muscleMassPercentage: ['']
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
      bloodPressure: this.formBuilder.group({
        systolic: [''],
        diastolic: [''],
        date: ['']
      }),
      restingHeartRate: ['']
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
        bodyFatPercentage: profile.personalInfo.bodyFatPercentage || '',
        muscleMassPercentage: profile.personalInfo.muscleMassPercentage || ''
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
      
      if (profile.medicalHistory.bloodPressure) {
        this.medicalHistoryForm.get('bloodPressure')?.patchValue(profile.medicalHistory.bloodPressure);
      }
      
      this.medicalHistoryForm.patchValue({
        lastMedicalCheckup: profile.medicalHistory.lastMedicalCheckup || '',
        doctorClearance: profile.medicalHistory.doctorClearance || false,
        doctorNotes: profile.medicalHistory.doctorNotes || '',
        restingHeartRate: profile.medicalHistory.restingHeartRate || ''
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
        bodyMassIndex: this.calculateBMI(formValue.weight, formValue.height)
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
        restingHeartRate: formValue.restingHeartRate || undefined,
        bloodPressure: formValue.bloodPressure.systolic ? formValue.bloodPressure : undefined
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

  // ✅ MÉTODOS DE UTILIDAD
  calculateBMI(weight: number, height: number): number {
    if (!weight || !height) return 0;
    const heightInMeters = height / 100;
    return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
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
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.showToast('Funcionalidad próximamente', 'warning');
          }
        },
        {
          text: 'Elegir de galería',
          icon: 'images',
          handler: () => {
            this.showToast('Funcionalidad próximamente', 'warning');
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async verifyEmail(): Promise<void> {
    this.showToast('Verificación de email próximamente', 'warning');
  }

  getSectionIcon(section: string): string {
    const icons = {
      personal: 'person-outline',
      medical: 'medical-outline',
      goals: 'trophy-outline',
      level: 'fitness-outline',
      preferences: 'settings-outline'
    };
    return icons[section as keyof typeof icons] || 'ellipse-outline';
  }

  getSectionTitle(section: string): string {
    const titles = {
      personal: 'Información Personal',
      medical: 'Historial Médico',
      goals: 'Objetivos Fitness',
      level: 'Nivel Fitness',
      preferences: 'Preferencias'
    };
    return titles[section as keyof typeof titles] || 'Sección';
  }

  // Agrega este método a tab3.page.ts (al final, antes del último })

// ✅ MÉTODO PARA CALCULAR EL ANCHO DE LA BARRA DE PROGRESO
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