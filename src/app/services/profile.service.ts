import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { Profile } from '../interfaces/profile.interface';
import { AuthService } from './auth.service';
import { take, switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  constructor(
    private afs: AngularFirestore,
    private authService: AuthService
  ) { }

  // Obtener perfil del usuario actual
  getUserProfile(): Observable<Profile | null> {
    return this.authService.user$.pipe(
      switchMap(user => {
        if (user) {
          return this.afs.doc<Profile>(`profiles/${user.uid}`).valueChanges().pipe(
            map((profile: Profile | undefined) => profile || null)
          );
        } else {
          return of(null);
        }
      })
    );
  }

  // Obtener perfil por ID (para entrenadores/administradores)
  getProfileById(userId: string): Observable<Profile | null> {
    return this.afs.doc<Profile>(`profiles/${userId}`).valueChanges()
      .pipe(map(profile => profile || null));
  }

  // Crear o actualizar perfil
  async updateProfile(profileData: Partial<Omit<Profile, 'uid'>>): Promise<void> {
    const user = await this.authService.user$.pipe(take(1)).toPromise();
    if (!user) throw new Error('No authenticated user found');
    const profileRef = this.afs.doc<Partial<Profile>>(`profiles/${user.uid}`);
    
    // Si se completan todos los campos requeridos, marcar como completo
    if (
      profileData.personalInfo &&
      profileData.medicalHistory &&
      profileData.fitnessLevel
    ) {
      profileData.profileComplete = true;
    }

    const updatedProfile = { ...profileData, uid: user.uid } as Profile;
    return profileRef.set(updatedProfile, { merge: true });
  }

  // Crear un perfil inicial al registrarse
  async createInitialProfile(userId: string): Promise<void> {
    const profileRef: AngularFirestoreDocument<Profile> = this.afs.doc(`profiles/${userId}`);
    
    const initialProfile: Profile = {
      uid: userId,
      personalInfo: {},
      medicalHistory: {},
      fitnessLevel: 'beginner',
      profileComplete: false
    };

    return profileRef.set(initialProfile);
  }
}