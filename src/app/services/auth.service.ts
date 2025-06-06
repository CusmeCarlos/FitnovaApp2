import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { User } from '../interfaces/user.interface';
import { Profile } from '../interfaces/profile.interface';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  user$: Observable<User | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private errorHandler: ErrorHandlerService
  ) {
    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) return of(null);
        const db = firebase.firestore();
        return new Observable<User | null>(subscriber => {
          db.doc(`users/${user.uid}`).onSnapshot(doc => {
            subscriber.next(doc.exists ? (doc.data() as User) : null);
          });
        });
      })
    );

    // Debug
    this.user$.subscribe(user => {
      console.log('🔥 user$ actualizado:', user);
    });
  }

  // Método auxiliar para obtener el usuario actual
  private getCurrentUser(): Promise<firebase.User | null> {
    return new Promise((resolve) => {
      this.afAuth.onAuthStateChanged(user => resolve(user));
    });
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    try {
      console.log('🚀 register() iniciado para', email);
      const cred = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (!cred.user) throw new Error('No se creó el usuario');
      
      await cred.user.updateProfile({ displayName });
      const uid = cred.user.uid;

      const u: User = {
        uid,
        email: cred.user.email || '',
        displayName,
        photoURL: cred.user.photoURL || '',
        role: 'user',
        emailVerified: cred.user.emailVerified,
        createdAt: new Date()
      };
      
      const p: Profile = {
        uid,
        personalInfo: {},
        medicalHistory: {},
        fitnessLevel: 'beginner',
        goals: [],
        profileComplete: false
      };

      const db = firebase.firestore();
      console.log('✍️ Escribiendo datos en Firestore...');
      
      // Usar Promise.all para operaciones paralelas
      await Promise.all([
        db.doc(`users/${uid}`).set(u, { merge: true }),
        db.doc(`profiles/${uid}`).set(p, { merge: true })
      ]);
      
      console.log('✅ Datos escritos exitosamente');
      await this.errorHandler.showSuccess('¡Cuenta creada exitosamente!');
      await this.router.navigate(['/tabs/profile']);
      
    } catch (error) {
      console.error('🛑 Error en register:', error);
      await this.errorHandler.handleFirebaseError(error);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<void> {
    try {
      await this.afAuth.signInWithEmailAndPassword(email, password);
      await this.errorHandler.showSuccess('¡Bienvenido a FitNova!');
      await this.router.navigate(['/tabs']);
    } catch (error) {
      console.error('🛑 Error en login:', error);
      await this.errorHandler.handleFirebaseError(error);
      throw error;
    }
  }

  async googleLogin(): Promise<void> {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await this.afAuth.signInWithPopup(provider);
    
      if (cred.user) {
        const db = firebase.firestore();
        const uid = cred.user.uid;
        const userDoc = await db.doc(`users/${uid}`).get();
        
        if (!userDoc.exists) {
          const u: User = {
            uid,
            email: cred.user.email || '',
            displayName: cred.user.displayName || '',
            photoURL: cred.user.photoURL || '',
            role: 'user',
            emailVerified: cred.user.emailVerified,
            createdAt: new Date()
          };
          
          const p: Profile = {
            uid,
            personalInfo: {},
            medicalHistory: {},
            fitnessLevel: 'beginner',
            goals: [],
            profileComplete: false
          };
          
          await Promise.all([
            db.doc(`users/${uid}`).set(u),
            db.doc(`profiles/${uid}`).set(p)
          ]);
        }
        
        await this.errorHandler.showSuccess('¡Bienvenido a FitNova!');
        await this.router.navigate(['/tabs']);
      }
    } catch (error) {
      console.error('🛑 Error en googleLogin:', error);
      await this.errorHandler.handleFirebaseError(error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.afAuth.signOut();
      await this.errorHandler.showSuccess('Sesión cerrada correctamente');
      await this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('🛑 Error en logout:', error);
      await this.errorHandler.handleGeneralError(error, 'Error al cerrar sesión');
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await this.afAuth.sendPasswordResetEmail(email);
      await this.errorHandler.showSuccess('Correo de recuperación enviado. Revisa tu bandeja de entrada.');
    } catch (error) {
      console.error('🛑 Error en resetPassword:', error);
      await this.errorHandler.handleFirebaseError(error);
      throw error;
    }
  }
}