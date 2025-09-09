// src/app/tab3/tab3.page.ts
// ✅ TAB3 COMPLETO CON RUTINAS ADAPTATIVAS IA

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import { AiRoutineService } from '../services/ai-routine.service';
import { CloudFunctionsService } from '../services/cloud-functions.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ActionSheetController, LoadingController } from '@ionic/angular';
import { User } from '../interfaces/user.interface';
import { Profile } from '../interfaces/profile.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AIGeneratedRoutine } from '../interfaces/profile.interface';
import { RoutineStateService, RoutineStatus } from '../services/routine-state.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
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
  IonRadio,        // ✅ AGREGAR
  IonRadioGroup,
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
    IonRadio,
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
  
  // ✅ NUEVAS PROPIEDADES PARA IA
  aiReadinessPercentage = 0;
  isAIReady = false;
  isGeneratingRoutine = false;
  selectedBodyAreas: string[] = [];

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

  // ✅ ÁREAS DEL CUERPO PARA IA
  bodyAreas = [
    { value: 'neck', label: 'Cuello', icon: 'person-outline', color: 'medium' },
    { value: 'shoulders', label: 'Hombros', icon: 'fitness-outline', color: 'medium' },
    { value: 'back', label: 'Espalda', icon: 'body-outline', color: 'medium' },
    { value: 'lower_back', label: 'Espalda Baja', icon: 'medical-outline', color: 'medium' },
    { value: 'knees', label: 'Rodillas', icon: 'walk-outline', color: 'medium' },
    { value: 'ankles', label: 'Tobillos', icon: 'footsteps-outline', color: 'medium' },
    { value: 'wrists', label: 'Muñecas', icon: 'hand-left-outline', color: 'medium' },
    { value: 'hips', label: 'Caderas', icon: 'body-outline', color: 'medium' }
  ];

  constructor(
    private auth: AuthService,
    private profileService: ProfileService,
    private aiRoutineService: AiRoutineService,
    private cloudFunctionsService: CloudFunctionsService,
    private formBuilder: FormBuilder,
    private toastController: ToastController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController,
    private router: Router,
    private routineStateService: RoutineStateService,
    private firestore: AngularFirestore,

  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.initializeSubscriptions();
    this.setupFormChangeListeners();
  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
    this.profileSubscription.unsubscribe();
  }
  
  hasActiveRoutine(): boolean {
    return this.routineStateService.hasActiveRoutine();
  }
  
  viewCurrentRoutine() {
    this.router.navigate(['/routine-view']);
  }

  // ✅ INICIALIZAR SUSCRIPCIONES
  private initializeSubscriptions(): void {
    this.userSubscription = this.auth.user$.subscribe(user => {
      this.user = user;
    });

    this.profileSubscription = this.profileService.getCurrentProfile().subscribe(profile => {
      this.profile = profile;
      this.profileCompletionPercentage = profile?.profileCompletionPercentage || 0;
      
      if (profile) {
        this.populateFormsWithProfile(profile);
        this.calculateAIReadiness();
      }
    });
  }

  // ✅ CONFIGURAR LISTENERS DE CAMBIOS DE FORMULARIOS
  private setupFormChangeListeners(): void {
    this.medicalHistoryForm.valueChanges.subscribe(() => {
      this.calculateAIReadiness();
    });
    
    this.personalInfoForm.valueChanges.subscribe(() => {
      this.calculateAIReadiness();
    });
    
    this.fitnessGoalsForm.valueChanges.subscribe(() => {
      this.calculateAIReadiness();
    });

    this.fitnessLevelForm.valueChanges.subscribe(() => {
      this.calculateAIReadiness();
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

    // ✅ FORMULARIO HISTORIAL MÉDICO EXPANDIDO PARA IA
    this.medicalHistoryForm = this.formBuilder.group({
      // Campos básicos existentes
      conditions: this.formBuilder.array([]),
      injuries: this.formBuilder.array([]),
      limitations: this.formBuilder.array([]),
      currentConditions: this.formBuilder.array([]),
      chronicDiseases: this.formBuilder.array([]),
      allergies: this.formBuilder.array([]),
      medications: this.formBuilder.array([]),
      heartConditions: this.formBuilder.array([]),
      lastMedicalCheckup: [''],
      doctorClearance: [false],
      doctorNotes: [''],
      
      // ✅ NUEVOS CAMPOS CRÍTICOS PARA IA
      currentInjuries: [''],
      painfulAreas: [[]],
      forbiddenExercises: [''],
      movementLimitations: [''],
      exercisesToAvoid: [''],
      
      // ✅ CAPACIDAD FÍSICA ACTUAL (CRÍTICO PARA IA)
      walkingCapacity: ['', Validators.required],
      stairsCapacity: ['', Validators.required],
      weightExperience: ['', Validators.required],
      maxComfortableWeight: [''],
      energyLevel: ['', Validators.required]
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
        }
      });
    }

    // Historial médico
    if (profile.medicalHistory) {
      // Campos básicos
      this.populateStringArrays('medicalHistoryForm', 'conditions', profile.medicalHistory.conditions);
      this.populateStringArrays('medicalHistoryForm', 'injuries', profile.medicalHistory.injuries);
      this.populateStringArrays('medicalHistoryForm', 'limitations', profile.medicalHistory.limitations);
      this.populateStringArrays('medicalHistoryForm', 'currentConditions', profile.medicalHistory.currentConditions);
      this.populateStringArrays('medicalHistoryForm', 'chronicDiseases', profile.medicalHistory.chronicDiseases);
      this.populateStringArrays('medicalHistoryForm', 'allergies', profile.medicalHistory.allergies);
      this.populateStringArrays('medicalHistoryForm', 'medications', profile.medicalHistory.medications);
      this.populateStringArrays('medicalHistoryForm', 'heartConditions', profile.medicalHistory.heartConditions);
      
      // ✅ CAMPOS PARA IA
      this.selectedBodyAreas = profile.medicalHistory.painfulAreas || [];
      
      this.medicalHistoryForm.patchValue({
        lastMedicalCheckup: profile.medicalHistory.lastMedicalCheckup || '',
        doctorClearance: profile.medicalHistory.doctorClearance || false,
        doctorNotes: profile.medicalHistory.doctorNotes || '',
        currentInjuries: profile.medicalHistory.currentInjuries || '',
        painfulAreas: this.selectedBodyAreas,
        forbiddenExercises: profile.medicalHistory.forbiddenExercises || '',
        movementLimitations: profile.medicalHistory.movementLimitations || '',
        exercisesToAvoid: profile.medicalHistory.exercisesToAvoid || '',
        walkingCapacity: profile.medicalHistory.physicalCapacity?.walkingCapacity || '',
        stairsCapacity: profile.medicalHistory.physicalCapacity?.stairsCapacity || '',
        weightExperience: profile.medicalHistory.physicalCapacity?.weightExperience || '',
        maxComfortableWeight: profile.medicalHistory.physicalCapacity?.maxComfortableWeight || '',
        energyLevel: profile.medicalHistory.physicalCapacity?.energyLevel || ''
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

  // ✅ MANEJAR CAMBIOS EN ÁREAS DEL CUERPO
  onBodyAreaChange(event: any, areaValue: string): void {
    if (event.detail.checked) {
      if (!this.selectedBodyAreas.includes(areaValue)) {
        this.selectedBodyAreas.push(areaValue);
      }
    } else {
      this.selectedBodyAreas = this.selectedBodyAreas.filter(area => area !== areaValue);
    }
    
    this.medicalHistoryForm.patchValue({
      painfulAreas: this.selectedBodyAreas
    });
    
    this.calculateAIReadiness();
  }

  // ✅ CALCULAR PREPARACIÓN PARA IA
  calculateAIReadiness(): void {
    let readinessScore = 0;
    const totalCriteria = 8;

    const formValue = this.medicalHistoryForm.value;
    const personalValue = this.personalInfoForm.value;
    const goalsValue = this.fitnessGoalsForm.value;
    const levelValue = this.fitnessLevelForm.value;

    // 1. Información personal básica
    if (personalValue.age && personalValue.gender && personalValue.weight && personalValue.height) {
      readinessScore++;
    }

    // 2. Capacidad de caminar
    if (formValue.walkingCapacity) readinessScore++;

    // 3. Capacidad de escaleras
    if (formValue.stairsCapacity) readinessScore++;

    // 4. Experiencia con pesas
    if (formValue.weightExperience) readinessScore++;

    // 5. Nivel de energía
    if (formValue.energyLevel) readinessScore++;

    // 6. Limitaciones descritas (aunque sea vacío está bien)
    if (formValue.currentInjuries !== undefined) readinessScore++;

    // 7. Objetivos fitness
    if (goalsValue.primaryGoals?.length > 0) readinessScore++;

    // 8. Nivel fitness
    if (levelValue.overallLevel) readinessScore++;

    this.aiReadinessPercentage = Math.round((readinessScore / totalCriteria) * 100);
    this.isAIReady = this.aiReadinessPercentage >= 80;
    this.calculateProfileCompletion();
  }

  // ✅ CAMBIAR SECCIÓN ACTIVA
  changeSection(section: any): void {
    if (section && typeof section === 'string') {
      this.currentSection = section as 'personal' | 'medical' | 'goals' | 'level' | 'preferences';
    }
  }
// ✅ AGREGAR ESTE NUEVO MÉTODO
private calculateProfileCompletion(): void {
  let completedSections = 0;
  const totalSections = 5;

  // Sección Personal
  const personalForm = this.personalInfoForm.value;
  if (personalForm.age && personalForm.gender && personalForm.weight && personalForm.height) {
    completedSections++;
  }

  // Sección Médica 
  const medicalForm = this.medicalHistoryForm.value;
  if (medicalForm.walkingCapacity && medicalForm.stairsCapacity && 
      medicalForm.weightExperience && medicalForm.energyLevel) {
    completedSections++;
  }

  // Sección Objetivos
  const goalsForm = this.fitnessGoalsForm.value;
  if (goalsForm.primaryGoals && goalsForm.primaryGoals.length > 0) {
    completedSections++;
  }

  // Sección Nivel
  const levelForm = this.fitnessLevelForm.value;
  if (levelForm.overallLevel) {
    completedSections++;
  }

  // Sección Preferencias
  const preferencesForm = this.trainingPreferencesForm.value;
  if (preferencesForm.availableDays && preferencesForm.availableDays.length > 0) {
    completedSections++;
  }

  this.profileCompletionPercentage = Math.round((completedSections / totalSections) * 100);
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
      const personalInfo = { ...formValue };

      const success = await this.profileService.updatePersonalInfo(personalInfo);
      
      if (success) {
        await this.showToast('✅ Información personal guardada correctamente', 'success');
      } else {
        await this.showToast('❌ Error al guardar la información personal', 'danger');
      }
    } catch (error) {
      await this.showToast('❌ Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR HISTORIAL MÉDICO EXPANDIDO
  async saveMedicalHistory(): Promise<void> {
    this.isSaving = true;
    try {
      const formValue = this.medicalHistoryForm.value;
      const expandedMedicalHistory = {
        // Campos básicos existentes
        conditions: this.getArrayValues('medicalHistoryForm', 'conditions'),
        injuries: this.getArrayValues('medicalHistoryForm', 'injuries'),
        limitations: this.getArrayValues('medicalHistoryForm', 'limitations'),
        currentConditions: this.getArrayValues('medicalHistoryForm', 'currentConditions'),
        chronicDiseases: this.getArrayValues('medicalHistoryForm', 'chronicDiseases'),
        allergies: this.getArrayValues('medicalHistoryForm', 'allergies'),
        medications: this.getArrayValues('medicalHistoryForm', 'medications'),
        heartConditions: this.getArrayValues('medicalHistoryForm', 'heartConditions'),
        
        // ✅ NUEVOS CAMPOS CRÍTICOS PARA IA
        currentInjuries: formValue.currentInjuries || '',
        painfulAreas: this.selectedBodyAreas,
        forbiddenExercises: formValue.forbiddenExercises || '',
        movementLimitations: formValue.movementLimitations || '',
        exercisesToAvoid: formValue.exercisesToAvoid || '',
        
        // ✅ CAPACIDAD FÍSICA PARA IA
        physicalCapacity: {
          walkingCapacity: formValue.walkingCapacity,
          stairsCapacity: formValue.stairsCapacity,
          weightExperience: formValue.weightExperience,
          maxComfortableWeight: formValue.maxComfortableWeight || 0,
          energyLevel: formValue.energyLevel
        },

        // Campos existentes
        lastMedicalCheckup: formValue.lastMedicalCheckup || null,
        doctorClearance: formValue.doctorClearance || false,
        doctorNotes: formValue.doctorNotes || '',
        lastUpdated: new Date(),
        
        // ✅ INDICADORES PARA IA
        aiReadiness: this.aiReadinessPercentage,
        readyForAI: this.isAIReady
      };

      const success = await this.profileService.updateMedicalHistory(expandedMedicalHistory);
      
      if (success) {
        await this.showToast('✅ Historial médico guardado - Listo para IA', 'success');
        
        if (this.isAIReady) {
          await this.showAIReadyAlert();
        }
      } else {
        await this.showToast('❌ Error al guardar el historial médico', 'danger');
      }
    } catch (error) {
      console.error('Error guardando historial médico:', error);
      await this.showToast('❌ Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR OBJETIVOS FITNESS
  async saveFitnessGoals(): Promise<void> {
    if (this.fitnessGoalsForm.invalid) {
      await this.showValidationErrors('Objetivos de Fitness');
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.fitnessGoalsForm.value;
      const fitnessGoals = { ...formValue, lastUpdated: new Date() };

      const success = await this.profileService.updateFitnessGoals(fitnessGoals);
      
      if (success) {
        await this.showToast('✅ Objetivos de fitness guardados', 'success');
      } else {
        await this.showToast('❌ Error al guardar objetivos', 'danger');
      }
    } catch (error) {
      await this.showToast('❌ Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR NIVEL FITNESS
  async saveFitnessLevel(): Promise<void> {
    if (this.fitnessLevelForm.invalid) {
      await this.showValidationErrors('Nivel de Fitness');
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.fitnessLevelForm.value;
      const success = await this.profileService.updateFitnessLevel(formValue.overallLevel);
      
      if (success) {
        await this.showToast('✅ Nivel de fitness guardado', 'success');
      } else {
        await this.showToast('❌ Error al guardar nivel', 'danger');
      }
    } catch (error) {
      await this.showToast('❌ Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ GUARDAR PREFERENCIAS DE ENTRENAMIENTO
  async saveTrainingPreferences(): Promise<void> {
    this.isSaving = true;
    try {
      const formValue = this.trainingPreferencesForm.value;
      const trainingPreferences = { ...formValue, lastUpdated: new Date() };

      const success = await this.profileService.updateTrainingPreferences(trainingPreferences);
      
      if (success) {
        await this.showToast('✅ Preferencias de entrenamiento guardadas', 'success');
      } else {
        await this.showToast('❌ Error al guardar preferencias', 'danger');
      }
    } catch (error) {
      await this.showToast('❌ Error inesperado al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ✅ MOSTRAR ALERTA CUANDO ESTÉ LISTO PARA IA
  async showAIReadyAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: '🧠 ¡Listo para IA!',
      message: 'Tu perfil está completo. ¿Quieres que la IA genere una rutina personalizada para ti?',
      buttons: [
        {
          text: 'Más tarde',
          role: 'cancel'
        },
        {
          text: '🏋️ Generar Rutina',
          handler: () => {
            this.generateAIRoutine();
          }
        }
      ]
    });
    await alert.present();
  }

  async generateAIRoutine(): Promise<void> {
    if (!this.isAIReady) {
      await this.showToast('⚠️ Completa tu perfil médico primero', 'warning');
      return;
    }
  
    const loading = await this.loadingController.create({
      message: '🧠 La IA está creando tu rutina personalizada...',
      spinner: 'dots'
    });
    await loading.present();
  
    this.isGeneratingRoutine = true;
  
    try {
      // Recopilar todos los datos del perfil
      const profileData: Profile = {
        uid: this.user?.uid || '',
        personalInfo: this.personalInfoForm.value,
        medicalHistory: {
          ...this.medicalHistoryForm.value,
          physicalCapacity: {
            walkingCapacity: this.medicalHistoryForm.value.walkingCapacity,
            stairsCapacity: this.medicalHistoryForm.value.stairsCapacity,
            weightExperience: this.medicalHistoryForm.value.weightExperience,
            maxComfortableWeight: this.medicalHistoryForm.value.maxComfortableWeight || 0,
            energyLevel: this.medicalHistoryForm.value.energyLevel
          },
          painfulAreas: this.selectedBodyAreas,
          aiReadiness: this.aiReadinessPercentage,
          readyForAI: this.isAIReady
        },
        fitnessGoals: this.fitnessGoalsForm.value,
        fitnessLevel: this.fitnessLevelForm.get('overallLevel')?.value || 'beginner',
        trainingPreferences: this.trainingPreferencesForm.value,
        profileComplete: true,
        aiReadinessPercentage: this.aiReadinessPercentage
      };
  
      console.log('🧠 Enviando datos a AI-Routine Service:', profileData);
  
      // Llamar al servicio para generar rutina
      const result = await this.aiRoutineService.generateAdaptiveRoutine(profileData);
      
      console.log('🔍 Resultado generación:', result);
      
      if (result.success && result.routine) {
        // ✅ ACTUALIZAR ESTADO CORRECTAMENTE
        const routineStatus = result.needsTrainerApproval ? 
          RoutineStatus.WAITING_APPROVAL : 
          RoutineStatus.APPROVED;
  
        this.routineStateService.updateRoutineState({
          status: routineStatus,
          routine: result.routine,
          generatedAt: new Date(),
          approvedAt: result.needsTrainerApproval ? undefined : new Date()
        });
  
        await this.showToast('🎉 ¡Rutina generada exitosamente!', 'success');
        
        console.log('🚀 Navegando a routine-view...');
        
        // ✅ PEQUEÑA PAUSA PARA ASEGURAR ESTADO ACTUALIZADO
        setTimeout(async () => {
          const navigationResult = await this.router.navigate(['/routine-view']);
          console.log('🔍 Resultado navegación:', navigationResult);
        }, 500);
        
      } else {
        throw new Error(result.error || 'Error generando rutina');
      }
  
    } catch (error: any) {
      console.error('❌ Error generando rutina IA:', error);
      await this.showToast(`❌ Error: ${error.message}`, 'danger');
    } finally {
      await loading.dismiss();
      this.isGeneratingRoutine = false;
    }
  }

  // ✅ MOSTRAR DETALLES DE RUTINA GENERADA
  async showRoutineDetails(result: any): Promise<void> {
    const alert = await this.alertController.create({
      header: '🏋️ Rutina Generada por IA',
      message: `
        <strong>Duración:</strong> ${result.routine?.routine?.duration || 30} minutos<br>
        <strong>Dificultad:</strong> ${result.routine?.routine?.difficulty || 'Personalizada'}<br>
        <strong>Ejercicios:</strong> ${result.routine?.routine?.exercises?.length || 0} ejercicios<br>
        <strong>Confianza IA:</strong> ${result.confidenceScore}%<br>
        <strong>Estado:</strong> Esperando aprobación del entrenador<br><br>
        <em>Recibirás una notificación cuando sea aprobada.</em>
      `,
      buttons: [
        {
          text: 'Ver Dashboard',
          handler: () => {
            this.router.navigate(['/tabs/tab1']);
          }
        },
        {
          text: 'Entendido',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
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
      header: 'Campos Requeridos',
      message: `Por favor completa todos los campos obligatorios en la sección: ${section}`,
      buttons: ['Entendido']
    });
    await alert.present();
  }

  // ✅ GESTIÓN DE FOTO DE PERFIL
  async selectImage(): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: 'Seleccionar Imagen',
      buttons: [
        {
          text: 'Galería',
          handler: () => {
            this.getImage(CameraSource.Photos);
          }
        },
        {
          text: 'Cámara',
          handler: () => {
            this.getImage(CameraSource.Camera);
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  private async getImage(source: CameraSource): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source
      });

      if (image.dataUrl) {
        const success = await this.profileService.updateProfilePhoto(image.dataUrl);
        if (success) {
          await this.showToast('✅ Foto de perfil actualizada', 'success');
        } else {
          await this.showToast('❌ Error al actualizar foto', 'danger');
        }
      }
    } catch (error) {
      console.error('Error capturando imagen:', error);
      await this.showToast('❌ Error al capturar imagen', 'danger');
    }
  }

  // ✅ VERIFICAR EMAIL
  async sendEmailVerification(): Promise<boolean> {
    try {
      const user = firebase.auth().currentUser;
      if (user && !user.emailVerified) {
        await user.sendEmailVerification();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error enviando verificación:', error);
      return false;
    }
  }

  // ✅ LOGOUT
  async logout(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro que quieres cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar Sesión',
          handler: async () => {
            await this.auth.logout();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }

  // ✅ NAVEGAR A RUTINAS
  goToRoutines(): void {
    this.router.navigate(['/tabs/tab1']);
  }

  // ✅ VER PROGRESO DE IA
  async showAIProgress(): Promise<void> {
    const alert = await this.alertController.create({
      header: '🧠 Progreso para IA',
      message: `
        <div style="text-align: left;">
          <p><strong>Preparación actual: ${this.aiReadinessPercentage}%</strong></p>
          <p>Para generar rutinas personalizadas necesitas:</p>
          <ul>
            <li>✅ Información personal básica</li>
            <li>✅ Capacidad física actual</li>
            <li>✅ Objetivos de entrenamiento</li>
            <li>✅ Nivel de experiencia</li>
          </ul>
          ${this.isAIReady ? 
            '<p style="color: green;"><strong>🎉 ¡Listo para generar rutinas!</strong></p>' : 
            '<p style="color: orange;">⚠️ Completa la información faltante</p>'
          }
        </div>
      `,
      buttons: [
        {
          text: this.isAIReady ? '🏋️ Generar Rutina' : 'Completar Perfil',
          handler: () => {
            if (this.isAIReady) {
              this.generateAIRoutine();
            } else {
              this.changeSection('medical');
            }
          }
        },
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  // ✅ OBTENER RUTINAS EXISTENTES
  async showExistingRoutines(): Promise<void> {
    try {
      const routines = await this.aiRoutineService.getRoutineHistory().pipe(take(1)).toPromise();
      
      if (!routines || routines.length === 0) {
        await this.showToast('No tienes rutinas generadas aún', 'warning');
        return;
      }

      let routinesList = '<ul>';
      routines.slice(0, 5).forEach(routine => {
        const status = routine.status === 'approved' ? '✅' : 
                      routine.status === 'pending_approval' ? '⏳' : '❌';
        routinesList += `<li>${status} ${routine.routine.name} - ${routine.routine.difficulty}</li>`;
      });
      routinesList += '</ul>';

      const alert = await this.alertController.create({
        header: '📋 Mis Rutinas',
        message: routinesList,
        buttons: [
          {
            text: 'Ver Dashboard',
            handler: () => this.router.navigate(['/tabs/tab1'])
          },
          {
            text: 'Cerrar',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
      
    } catch (error) {
      console.error('Error obteniendo rutinas:', error);
      await this.showToast('Error cargando rutinas', 'danger');
    }
  }

  // ✅ TOGGLE OBJETIVO FITNESS
toggleGoal(goalValue: string): void {
  const currentGoals = this.fitnessGoalsForm.get('primaryGoals')?.value || [];
  let updatedGoals: string[];

  if (currentGoals.includes(goalValue)) {
    updatedGoals = currentGoals.filter((goal: string) => goal !== goalValue);
  } else {
    updatedGoals = [...currentGoals, goalValue];
  }

  this.fitnessGoalsForm.patchValue({
    primaryGoals: updatedGoals
  });

  this.calculateAIReadiness();
}

// ✅ OBTENER DESCRIPCIÓN DE NIVEL FITNESS
getLevelDescription(level: string): string {
  const descriptions = {
    'beginner': 'Nuevo en el ejercicio o con menos de 6 meses de experiencia',
    'intermediate': 'Entre 6 meses y 2 años de entrenamiento regular',
    'advanced': 'Más de 2 años de experiencia con rutinas complejas'
  };
  return descriptions[level as keyof typeof descriptions] || '';
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
    
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('No se pudo obtener contexto del canvas');
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    });
    
    console.log('✅ Stream de cámara obtenido');
    
    canvas.width = 640;
    canvas.height = 480;
    video.srcObject = stream;
    video.play();
    
    const alert = await this.alertController.create({
      header: '📸 Capturar Foto',
      message: `
        <div style="text-align: center;">
          <p>Sonríe para la cámara</p>
          <div style="position: relative; width: 300px; height: 225px; margin: 10px auto; border: 2px solid #3880ff; border-radius: 8px; overflow: hidden;">
            <video id="preview-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
          </div>
        </div>
      `,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => {
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
    
    setTimeout(() => {
      const previewVideo = document.getElementById('preview-video') as HTMLVideoElement;
      if (previewVideo) {
        previewVideo.srcObject = stream;
        previewVideo.play();
        console.log('✅ Preview de cámara activo');
      }
    }, 200);
    
  } catch (error) {
    console.error('❌ Error accediendo a cámara:', error);
    await this.showToast('Error accediendo a la cámara', 'danger');
  }
}
private async capturePhotoFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D,
  stream: MediaStream
): Promise<void> {
  try {
    console.log('📸 Capturando foto...');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/jpeg', 0.8);
    });
    
    stream.getTracks().forEach(track => track.stop());
    console.log('✅ Stream detenido');
    
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
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    const fileSelected = new Promise<File | null>((resolve) => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        resolve(file);
      });
      
      input.addEventListener('cancel', () => resolve(null));
    });
    
    document.body.appendChild(input);
    input.click();
    
    const file = await fileSelected;
    document.body.removeChild(input);
    
    if (file) {
      console.log('✅ Archivo seleccionado:', file.name);
      
      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo debe ser una imagen');
      }
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es muy grande (max 5MB)');
      }
      
      await this.uploadProfilePhoto(file);
    }
    
  } catch (error) {
    console.error('❌ Error seleccionando de galería:', error);
    await this.showToast(error instanceof Error ? error.message : 'Error seleccionando imagen', 'danger');
  }
}
private async uploadProfilePhoto(file: Blob | File): Promise<void> {
  try {
    this.isSaving = true;
    await this.showToast('Procesando imagen...', 'warning');
    
    const base64 = await this.fileToBase64(file);
    
    console.log('💾 Guardando en Firestore...');
    
    if (this.user?.uid) {
      // Guardar en Firestore users collection
      await firebase.firestore().collection('users').doc(this.user.uid).update({
        photoURL: base64,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // También actualizar en profiles collection
      const profileRef = firebase.firestore().collection('profiles').doc(this.user.uid);
      const profileDoc = await profileRef.get();
      if (profileDoc.exists) {
        await profileRef.update({
          'personalInfo.photoURL': base64,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // ✅ ACTUALIZAR INTERFAZ LOCAL
      if (this.user) {
        this.user.photoURL = base64;
      }
      
      console.log('✅ Foto guardada correctamente');
      await this.showToast('✅ Foto actualizada correctamente', 'success');
    }
    
  } catch (error) {
    console.error('❌ Error guardando foto:', error);
    await this.showToast('Error guardando la imagen', 'danger');
  } finally {
    this.isSaving = false;
  }
}
private fileToBase64(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}


// ✅ MÉTODO VERIFICAR EMAIL EN TAB3
async verifyEmail(): Promise<void> {
  try {
    const success = await this.auth.sendEmailVerification();
    if (success) {
      await this.showToast('✅ Email de verificación enviado', 'success');
    } else {
      await this.showToast('❌ Error enviando verificación', 'danger');
    }
  } catch (error) {
    await this.showToast('❌ Error inesperado', 'danger');
  }
}
  // ✅ ACTUALIZAR EL MÉTODO resetSection()
async resetSection(section: string): Promise<void> {
  const alert = await this.alertController.create({
    header: 'Resetear Sección',
    message: `¿Estás seguro que quieres borrar todos los datos de ${section}?`,
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Resetear',
        handler: () => {
          switch(section) {
            case 'personal':
              this.personalInfoForm.reset();
              break;
            case 'medical':
              this.medicalHistoryForm.reset();
              this.selectedBodyAreas = [];
              break;
            case 'goals':
              this.fitnessGoalsForm.reset();
              break;
            case 'level':
              this.fitnessLevelForm.reset();
              break;
            case 'preferences':
              this.trainingPreferencesForm.reset();
              break;
          }
          // ✅ AGREGAR ESTA LÍNEA
          this.calculateProfileCompletion();
          this.calculateAIReadiness();
        }
      }
    ]
  });
  await alert.present();
}
}