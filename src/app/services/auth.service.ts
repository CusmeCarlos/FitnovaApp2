import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { User } from '../interfaces/user.interface';
import { Profile } from '../interfaces/profile.interface';

@Injectable({ providedIn: 'root' })
export class AuthService {
  user$: Observable<User | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private router: Router
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

  async register(email: string, password: string, displayName: string): Promise<void> {
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
    console.log('✍️ Escribiendo compat users/' + uid, u);
    await db.doc(`users/${uid}`).set(u, { merge: true });
    console.log('✅ users escrito');

    console.log('✍️ Escribiendo compat profiles/' + uid, p);
    await db.doc(`profiles/${uid}`).set(p, { merge: true });
    console.log('✅ profiles escrito');

    await this.router.navigate(['/tabs/profile']);
  }

  async login(email: string, password: string): Promise<void> {
    await this.afAuth.signInWithEmailAndPassword(email, password);
    await this.router.navigate(['/tabs']);
  }

  async googleLogin(): Promise<void> {
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await this.afAuth.signInWithPopup(provider);
  
    if (cred.user) {
      // Guardar en Firestore si es nuevo
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
        await db.doc(`users/${uid}`).set(u);
      }
      await this.router.navigate(['/tabs']);
    }
  }


  async logout(): Promise<void> {
    await this.afAuth.signOut();
    await this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<void> {
    await this.afAuth.sendPasswordResetEmail(email);
  }
}
