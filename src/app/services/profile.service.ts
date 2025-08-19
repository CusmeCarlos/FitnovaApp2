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

  async updateMedicalHistory(medicalHistory: Partial<Profile['medicalHistory']>): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      console.log('💾 Guardando historial médico:', medicalHistory);

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      
      await docRef.update({
        medicalHistory: {
          ...medicalHistory,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Historial médico guardado');
      
      // Recargar perfil
      await this.loadUserProfile(user.uid);
      
      return true;
    } catch (error) {
      console.error('❌ Error guardando historial médico:', error);
      return false;
    }
  }

  async updateFitnessGoals(fitnessGoals: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      console.log('💾 Guardando objetivos fitness:', fitnessGoals);

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      
      await docRef.update({
        fitnessGoals: {
          ...fitnessGoals,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Objetivos fitness guardados');
      
      // Recargar perfil
      await this.loadUserProfile(user.uid);
      
      return true;
    } catch (error) {
      console.error('❌ Error guardando objetivos fitness:', error);
      return false;
    }
  }

  async updateFitnessLevel(fitnessLevel: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      console.log('💾 Guardando nivel fitness:', fitnessLevel);

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      
      await docRef.update({
        fitnessLevel: fitnessLevel,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Nivel fitness guardado');
      
      // Recargar perfil
      await this.loadUserProfile(user.uid);
      
      return true;
    } catch (error) {
      console.error('❌ Error guardando nivel fitness:', error);
      return false;
    }
  }

  async updateTrainingPreferences(preferences: any): Promise<boolean> {
    try {
      const user = await this.auth.user$.pipe(take(1)).toPromise();
      if (!user?.uid) throw new Error('Usuario no autenticado');

      console.log('💾 Guardando preferencias:', preferences);

      const docRef = firebase.firestore().collection(this.COLLECTION).doc(user.uid);
      
      await docRef.update({
        trainingPreferences: {
          ...preferences,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Preferencias guardadas');
      
      // Recargar perfil
      await this.loadUserProfile(user.uid);
      
      return true;
    } catch (error) {
      console.error('❌ Error guardando preferencias:', error);
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