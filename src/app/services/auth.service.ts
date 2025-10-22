import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators'; // AGREGAR take
import { User } from '../interfaces/user.interface';
import { ToastController } from '@ionic/angular'; // CAMBIO: Inyectar directo

@Injectable({ providedIn: 'root' })
export class AuthService {
  user$: Observable<User | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private toastController: ToastController // CAMBIO: Sin ErrorHandlerService
  ) {
    // CONFIGURAR OBSERVABLE DEL USUARIO
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
    this.setupAppStateListeners();

    // Debug para desarrollo
    this.user$.subscribe(user => {
      console.log('🔥 AuthService - Usuario actualizado:', user ? user.uid : 'No autenticado');
    });
  }

  async login(email: string, password: string): Promise<void> {
    try {
      console.log('🔐 Iniciando login para:', email);

      const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);

      if (userCredential.user) {
        // 🔥 1. Sincronizar estado de email verificado
        await this.syncEmailVerificationStatus(userCredential.user.uid);

        // 🔥 2. Actualizar última actividad inmediatamente
        await this.updateLastActiveAt(userCredential.user.uid);

        // 🔥 3. Iniciar timer de actividad automática
        this.startActivityTimer();

        await this.showSuccessToast('¡Bienvenido a FitNova!');
        this.router.navigate(['/tabs']);
      }
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      throw error;
    }
  }

  // 🔄 SINCRONIZAR ESTADO DE EMAIL VERIFICADO
  private async syncEmailVerificationStatus(uid: string): Promise<void> {
    try {
      console.log('🔍 Sincronizando estado de email verificado para:', uid);
      const checkEmailVerification = firebase.functions().httpsCallable('checkEmailVerification');
      const result = await checkEmailVerification({ uid });
      console.log('✅ Email verification sync result:', result.data);
    } catch (error) {
      console.warn('⚠️ No se pudo sincronizar emailVerified:', error);
      // No lanzar error porque esto no debe bloquear el login
    }
  }

  private async updateLastActiveAt(uid: string): Promise<void> {
    try {
      const db = firebase.firestore();
      const now = firebase.firestore.FieldValue.serverTimestamp();
      
      console.log('🕒 Actualizando lastActiveAt para:', uid);
      
      // Batch para actualizar ambas colecciones atomicamente
      const batch = db.batch();
      
      // Actualizar en la colección users
      const userRef = db.collection('users').doc(uid);
      batch.update(userRef, {
        lastActiveAt: now,
        updatedAt: now
      });
      
      // Actualizar en userStats (crear si no existe)
      const userStatsRef = db.collection('userStats').doc(uid);
      batch.set(userStatsRef, {
        lastActiveAt: now,
        updatedAt: now
      }, { merge: true }); // merge: true para no sobrescribir otros campos
      
      // Ejecutar batch
      await batch.commit();
      
      console.log('✅ lastActiveAt actualizado correctamente con batch');
    } catch (error) {
      console.error('❌ Error actualizando lastActiveAt:', error);
      // No lanzar error para no interrumpir login/logout
    }
  }

// 🔥 TAMBIÉN AGREGAR ESTE MÉTODO PARA TABS
async updateUserActivity(): Promise<void> {
  try {
    const user = await this.afAuth.currentUser;
    if (user) {
      await this.updateLastActiveAt(user.uid);
    } else {
      console.log('⚠️ No hay usuario autenticado para actualizar actividad');
    }
  } catch (error) {
    console.error('❌ Error actualizando actividad:', error);
  }
}

private activityTimer?: any;

startActivityTimer(): void {
  // Limpiar timer anterior si existe
  if (this.activityTimer) {
    clearInterval(this.activityTimer);
  }

  // Actualizar actividad cada 5 minutos mientras la app está abierta
  this.activityTimer = setInterval(async () => {
    const user = await this.afAuth.currentUser;
    if (user) {
      console.log('⏰ Timer: Actualizando actividad automáticamente');
      await this.updateLastActiveAt(user.uid);
    }
  }, 5 * 60 * 1000); // 5 minutos
}

stopActivityTimer(): void {
  if (this.activityTimer) {
    clearInterval(this.activityTimer);
    this.activityTimer = null;
  }
}
async logout(): Promise<void> {
  try {
    console.log('🚪 Iniciando logout...');
    
    // 🔥 1. Actualizar lastActiveAt ANTES de cerrar sesión
    const user = await this.afAuth.currentUser;
    if (user) {
      await this.updateLastActiveAt(user.uid);
      console.log('✅ Última actividad actualizada antes del logout');
    }
    
    // 🔥 2. Detener timer de actividad
    this.stopActivityTimer();
    
    // 3. Limpiar datos locales
    localStorage.clear();
    
    // 4. Cerrar sesión en Firebase
    await this.afAuth.signOut();
    
    await this.showSuccessToast('Sesión cerrada correctamente');
    console.log('✅ Logout completado');
    
    // 5. Navegar al login
    this.router.navigate(['/login']);
    
  } catch (error: any) {
    console.error('❌ Error en logout:', error);
    await this.showErrorToast('Error al cerrar sesión');
    throw error;
  }
}

// 🔥 TAMBIÉN AGREGAR LISTENER PARA DETECTAR CUANDO SE CIERRA LA APP
async setupAppStateListeners(): Promise<void> {
  // Detectar cuando la app va al background
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      // App va al background - actualizar actividad
      console.log('📱 App va al background - actualizando actividad');
      await this.updateUserActivity();
    }
  });
    // Detectar cuando se cierra la app (beforeunload)
    window.addEventListener('beforeunload', async () => {
      console.log('📱 App cerrándose - actualizando actividad');
      await this.updateUserActivity();
    });
  }

  // CREAR USUARIO (Solo para entrenadores - según documento)
  async createUser(userData: {
    email: string;
    password: string;
    displayName: string;
    role: string;
  }): Promise<void> {
    try {
      console.log('👤 Creando usuario:', userData.email);
      
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(
        userData.email, 
        userData.password
      );

      if (userCredential.user) {
        // Actualizar perfil
        await userCredential.user.updateProfile({
          displayName: userData.displayName
        });

        // Crear documento en Firestore
        const db = firebase.firestore();
        await db.doc(`users/${userCredential.user.uid}`).set({
          uid: userCredential.user.uid,
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          isActive: true
        });

        await this.showSuccessToast('Usuario creado exitosamente');
        console.log('✅ Usuario creado exitosamente');
      }
    } catch (error: any) {
      console.error('❌ Error creando usuario:', error);
      await this.showErrorToast(this.getErrorMessage(error));
      throw error;
    }
  }

  // MÉTODOS AUXILIARES SIN ErrorHandlerService
  private async showSuccessToast(message: string): Promise<void> {
    try {
      const toast = await this.toastController.create({
        message,
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Error mostrando toast de éxito:', error);
    }
  }

  private async showErrorToast(message: string): Promise<void> {
    try {
      const toast = await this.toastController.create({
        message,
        duration: 4000,
        position: 'bottom',
        color: 'danger',
        buttons: [
          {
            text: 'Cerrar',
            role: 'cancel'
          }
        ]
      });
      await toast.present();
    } catch (error) {
      console.error('Error mostrando toast de error:', error);
    }
  }

  // OBTENER UID DEL USUARIO ACTUAL (Para compatibilidad con otros servicios)
  async getCurrentUserId(): Promise<string | null> {
    try {
      const user = await this.afAuth.currentUser;
      return user?.uid || null;
    } catch (error) {
      console.error('Error obteniendo UID del usuario:', error);
      return null;
    }
  }

  // OBTENER USUARIO ACTUAL COMPLETO
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await this.user$.pipe(take(1)).toPromise();
      return user || null;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

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

  private getErrorMessage(error: any): string {
    if (error?.code) {
      switch (error.code) {
        case 'auth/user-not-found':
          return 'No existe una cuenta con este correo electrónico';
        case 'auth/wrong-password':
          return 'Contraseña incorrecta';
        case 'auth/email-already-in-use':
          return 'Ya existe una cuenta con este correo electrónico';
        case 'auth/weak-password':
          return 'La contraseña debe tener al menos 6 caracteres';
        case 'auth/invalid-email':
          return 'El formato del correo electrónico no es válido';
        case 'auth/too-many-requests':
          return 'Demasiados intentos fallidos. Intente más tarde';
        case 'auth/network-request-failed':
          return 'Error de conexión. Verifica tu conexión a internet';
        case 'auth/operation-not-allowed':
          return 'Método de autenticación no habilitado';
        case 'auth/user-disabled':
          return 'Esta cuenta ha sido deshabilitada';
        case 'auth/requires-recent-login':
          return 'Por seguridad, debes iniciar sesión nuevamente';
        default:
          return error.message || 'Error de autenticación';
      }
    }
    return error?.message || 'Ocurrió un error inesperado';
  }
}