// src/app/services/membership.service.ts
// 💳 SERVICIO DE MEMBRESÍAS PARA APP MÓVIL

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface UserMembership {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending-payment';
  startDate: any;
  endDate: any;
  totalVisits: number;
  visitsThisMonth: number;
}

@Injectable({
  providedIn: 'root'
})
export class MembershipService {
  private db = firebase.firestore();

  constructor() {
    console.log('💳 MembershipService (móvil) inicializado');
  }

  /**
   * Verifica si el usuario tiene una membresía activa
   */
  hasActiveMembership(userId: string): Observable<boolean> {
    console.log('💳 Verificando membresía para usuario:', userId);

    return new Observable(observer => {
      this.db.collection('userMemberships')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get()
        .then(snapshot => {
          const hasActive = !snapshot.empty;
          console.log(hasActive ? '✅ Membresía activa encontrada' : '❌ Sin membresía activa');
          observer.next(hasActive);
          observer.complete();
        })
        .catch(error => {
          console.error('❌ Error verificando membresía:', error);
          observer.next(false); // En caso de error, denegar acceso
          observer.complete();
        });
    });
  }

  /**
   * Obtiene la membresía activa del usuario
   */
  getActiveMembership(userId: string): Observable<UserMembership | null> {
    return new Observable(observer => {
      this.db.collection('userMemberships')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            observer.next({
              id: doc.id,
              ...data
            } as UserMembership);
          } else {
            observer.next(null);
          }
          observer.complete();
        })
        .catch(error => {
          console.error('❌ Error obteniendo membresía:', error);
          observer.next(null);
          observer.complete();
        });
    });
  }

  /**
   * Obtiene días restantes de membresía
   */
  getRemainingDays(userId: string): Observable<number> {
    return this.getActiveMembership(userId).pipe(
      map(membership => {
        if (!membership || !membership.endDate) {
          return 0;
        }

        const now = new Date();
        const endDate = membership.endDate.toDate();
        const diff = endDate.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        return days > 0 ? days : 0;
      })
    );
  }

  /**
   * Registra una visita del usuario
   */
  async registerVisit(userId: string): Promise<void> {
    try {
      const snapshot = await this.db.collection('userMemberships')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();

        await doc.ref.update({
          totalVisits: (data['totalVisits'] || 0) + 1,
          visitsThisMonth: (data['visitsThisMonth'] || 0) + 1,
          lastVisit: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Visita registrada exitosamente');
      }
    } catch (error) {
      console.error('❌ Error registrando visita:', error);
    }
  }
}