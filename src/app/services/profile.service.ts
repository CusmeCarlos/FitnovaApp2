// src/app/services/profile.service.ts
// ✅ PROFILESERVICE SIMPLIFICADO - SIN NG0203

import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';
import { Profile } from '../interfaces/profile.interface';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private readonly COLLECTION = 'profiles';
  private profileSubject = new BehaviorSubject<Profile | null>(null);
  
  public profile$ = this.profileSubject.asObservable();
  public profileComplete$ = this.profile$.pipe(
    map(profile => profile?.profileComplete || false)
  );

  constructor(
    private firestore: AngularFirestore,
    private auth: AuthService
  ) {
    this.initializeProfileListener();
  }

  private initializeProfileListener(): void {
    this.auth.user$.subscribe(user => {
      if (user?.uid) {
        this.loadUserProfile(user.uid);
      } else {
        this.profileSubject.next(null);
      }
    });
  }

  private async loadUserProfile(uid: string): Promise<void> {
    try {
      const docRef = firebase.firestore().collection(this.COLLECTION).doc(uid);
      const doc = await docRef.get();
      
      if (doc.exists) {
        const profile = { uid, ...doc.data() } as Profile;
        this.profileSubject.next(profile);
      } else {
        this.profileSubject.next(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.profileSubject.next(null);
    }
  }

  getCurrentProfile(): Observable<Profile | null> {
    return this.profile$;
  }

  async updatePersonalInfo(personalInfo: Partial<Profile['personalInfo']>): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      console.log('💾 Guardando información personal:', personalInfo);

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      
      await docRef.update({
        personalInfo: personalInfo,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Información personal guardada');
      
      // Recargar perfil para actualizar UI
      await this.loadUserProfile(user.uid);
      
      return true;
    } catch (error) {
      console.error('❌ Error guardando información personal:', error);
      return false;
    }
  }

  async updateMedicalHistory(medicalHistory: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');
  
      const updateData = {
        medicalHistory: {
          ...medicalHistory,
          lastUpdated: new Date()
        },
        lastUpdated: new Date()
      };
  
      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      await docRef.update(updateData);
  
      // Actualizar el BehaviorSubject
      const currentProfile = this.profileSubject.value;
      if (currentProfile) {
        const updatedProfile = {
          ...currentProfile,
          ...updateData
        };
        this.profileSubject.next(updatedProfile);
      }
  
      return true;
    } catch (error) {
      console.error('❌ Error actualizando historial médico:', error);
      return false;
    }
  }
  
  async updateFitnessGoals(fitnessGoals: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');
  
      const updateData = {
        fitnessGoals: {
          ...fitnessGoals,
          lastUpdated: new Date()
        },
        lastUpdated: new Date()
      };
  
      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      await docRef.update(updateData);
  
      // Actualizar el BehaviorSubject
      const currentProfile = this.profileSubject.value;
      if (currentProfile) {
        const updatedProfile = {
          ...currentProfile,
          ...updateData
        };
        this.profileSubject.next(updatedProfile);
      }
  
      return true;
    } catch (error) {
      console.error('❌ Error actualizando objetivos fitness:', error);
      return false;
    }
  }

  async updateFitnessLevel(fitnessLevel: 'beginner' | 'intermediate' | 'advanced'): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');
  
      const updateData = {
        fitnessLevel,
        lastUpdated: new Date()
      };
  
      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      await docRef.update(updateData);
  
      const currentProfile = this.profileSubject.value;
      if (currentProfile) {
        const updatedProfile: Profile = {
          ...currentProfile,
          fitnessLevel, // ✅ TIPO CORRECTO
          lastUpdated: new Date()
        };
        this.profileSubject.next(updatedProfile);
      }
  
      return true;
    } catch (error) {
      console.error('❌ Error actualizando nivel fitness:', error);
      return false;
    }
  }

  async updateTrainingPreferences(trainingPreferences: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');
  
      const updateData = {
        trainingPreferences: {
          ...trainingPreferences,
          lastUpdated: new Date()
        },
        lastUpdated: new Date()
      };
  
      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      await docRef.update(updateData);
  
      // Actualizar el BehaviorSubject
      const currentProfile = this.profileSubject.value;
      if (currentProfile) {
        const updatedProfile = {
          ...currentProfile,
          ...updateData
        };
        this.profileSubject.next(updatedProfile);
      }
  
      return true;
    } catch (error) {
      console.error('❌ Error actualizando preferencias:', error);
      return false;
    }
  }

  async updateProfilePhoto(photoDataUrl: string): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');
  
      // Actualizar en Firebase Auth
      await firebase.auth().currentUser?.updateProfile({
        photoURL: photoDataUrl
      });
  
      // Actualizar en Firestore
      const updateData = {
        'personalInfo.photoURL': photoDataUrl,
        lastUpdated: new Date()
      };
  
      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      await docRef.update(updateData);
  
      return true;
    } catch (error) {
      console.error('❌ Error actualizando foto:', error);
      return false;
    }
  }

  async markProfileComplete(): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      const currentProfile = this.profileSubject.value;
      if (!currentProfile) throw new Error('Perfil no encontrado');

      const completionPercentage = this.calculateCompletionPercentage(currentProfile);
      const isComplete = completionPercentage >= 80;

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      
      await docRef.update({
        profileComplete: isComplete,
        profileCompletionPercentage: completionPercentage,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Recargar perfil
      await this.loadUserProfile(user.uid);

      return true;
    } catch (error) {
      console.error('❌ Error marcando perfil completo:', error);
      return false;
    }
  }

  async createInitialProfile(data: {
    personalInfo: {
      age: number;
      gender: string;
      weight: number;
      height: number;
    };
    medicalHistory: {
      conditions?: string[];
      injuries?: string[];
      limitations?: string[];
    };
    fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
    goals: string[];
  }): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      const initialProfile: Profile = {
        uid: user.uid,
        personalInfo: {
          ...data.personalInfo,
          gender: data.personalInfo.gender as 'male' | 'female' | 'other', // ✅ CAST TIPO
          bodyMassIndex: this.calculateBMI(data.personalInfo.weight, data.personalInfo.height)
        },
        medicalHistory: {
          ...data.medicalHistory,
          lastUpdated: new Date()
        },
        fitnessLevel: data.fitnessLevel,
        goals: data.goals,
        profileComplete: false,
        profileCompletionPercentage: this.calculateBasicCompletionPercentage(data),
        createdAt: new Date(),
        lastUpdated: new Date(),
        profileVersion: 1
      };

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      await docRef.set(initialProfile);

      this.profileSubject.next(initialProfile);
      return true;
    } catch (error) {
      console.error('❌ Error creando perfil inicial:', error);
      return false;
    }
  }

  private calculateBMI(weight: number, height: number): number {
    if (!weight || !height) return 0;
    const heightInMeters = height / 100;
    return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
  }

  private calculateBasicCompletionPercentage(data: any): number {
    let completedSections = 0;
    const totalSections = 4;

    if (data.personalInfo?.age && data.personalInfo?.gender && 
        data.personalInfo?.weight && data.personalInfo?.height) {
      completedSections++;
    }

    if (data.medicalHistory) {
      completedSections++;
    }

    if (data.fitnessLevel) {
      completedSections++;
    }

    if (data.goals?.length) {
      completedSections++;
    }

    return Math.round((completedSections / totalSections) * 100);
  }

  private calculateCompletionPercentage(profile: Profile): number {
    let completedSections = 0;
    const totalSections = 5;

    if (profile.personalInfo?.age && profile.personalInfo?.gender && 
        profile.personalInfo?.weight && profile.personalInfo?.height) {
      completedSections++;
    }

    if (profile.medicalHistory) {
      completedSections++;
    }

    if (profile.fitnessGoals || profile.goals?.length) {
      completedSections++;
    }

    if (profile.fitnessLevel) {
      completedSections++;
    }

    if (profile.trainingPreferences) {
      completedSections++;
    }

    return Math.round((completedSections / totalSections) * 100);
  }
}