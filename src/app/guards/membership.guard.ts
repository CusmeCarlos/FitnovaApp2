// src/app/guards/membership.guard.ts
// 🔒 GUARD DE MEMBRESÍA - BLOQUEA ACCESO SIN MEMBRESÍA ACTIVA

import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Injectable({
  providedIn: 'root'
})
export class MembershipGuard {
  
  constructor(
    private auth: AuthService,
    private membershipService: MembershipService,
    private router: Router
  ) {
    console.log('🔒 MembershipGuard inicializado');
  }

  canActivate(): Observable<boolean | UrlTree> {
    console.log('🔒 MembershipGuard: Verificando acceso...');
    
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) {
          console.log('❌ MembershipGuard: Usuario no autenticado');
          return Promise.resolve(this.router.createUrlTree(['/auth/login']));
        }

        console.log('✅ MembershipGuard: Usuario autenticado, verificando membresía...');
        
        // Verificar membresía activa
        return this.membershipService.hasActiveMembership(user.uid).pipe(
          take(1),
          map(hasActive => {
            if (hasActive) {
              console.log('✅ MembershipGuard: Membresía activa verificada - ACCESO PERMITIDO');
              return true;
            } else {
              console.log('⚠️ MembershipGuard: Sin membresía activa - REDIRIGIENDO');
              return this.router.createUrlTree(['/membership-required']);
            }
          })
        );
      })
    );
  }
}