// src/app/services/auth.service.ts
// ✅ AUTHSERVICE LIMPIO FINAL - SOLO FUNCIONALIDADES DOCUMENTADAS

import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { User } from '../interfaces/user.interface';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  user$: Observable<User | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private errorHandler: ErrorHandlerService
  ) {
    // ✅ CONFIGURAR OBSERVABLE DEL USUARIO
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

    // Debug para desarrollo
    this.user$.subscribe(user => {
      console.log('🔥 AuthService - Usuario actualizado:', user ? user.uid : 'No autenticado');
    });
  }

  // ✅ LOGIN - Solo credenciales entrenador (según documento)
  async login(email: string, password: string): Promise<void> {
    try {
      console.log('🔐 Iniciando login para:', email);
      
      const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);
      
      if (userCredential.user) {
        await this.errorHandler.showSuccess('¡Bienvenido a FitNova!');
        await this.router.navigate(['/tabs']);
        console.log('✅ Login exitoso:', userCredential.user.uid);
      }
    } catch (error) {
      console.error('🛑 Error en login:', error);
      await this.errorHandler.handleFirebaseError(error);
      throw error;
    }
  }

  // ✅ LOGOUT - Cerrar sesión y limpiar estado
  async logout(): Promise<void> {
    try {
      console.log('🔐 Cerrando sesión...');
      
      await this.afAuth.signOut();
      await this.errorHandler.showSuccess('Sesión cerrada correctamente');
      await this.router.navigate(['/auth/login']);
      
      console.log('✅ Logout exitoso');
    } catch (error) {
      console.error('🛑 Error en logout:', error);
      await this.errorHandler.handleGeneralError(error, 'Error al cerrar sesión');
    }
  }

  // ✅ MÉTODO AUXILIAR - Obtener usuario actual de forma síncrona
  getCurrentUser(): Promise<firebase.User | null> {
    return new Promise((resolve) => {
      this.afAuth.onAuthStateChanged(user => resolve(user));
    });
  }

  // ✅ MÉTODO AUXILIAR - Verificar si usuario está autenticado
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  // ✅ MÉTODO AUXILIAR - Obtener UID del usuario actual
  async getCurrentUserId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user ? user.uid : null;
  }
}