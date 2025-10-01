// src/app/pages/membership-required/membership-required.page.ts
// ⚠️ PÁGINA DE MEMBRESÍA REQUERIDA - VERSIÓN SIMPLIFICADA

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MembershipService } from '../../services/membership.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-membership-required',
  templateUrl: './membership-required.page.html',
  styleUrls: ['./membership-required.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class MembershipRequiredPage implements OnInit {
  userEmail: string = '';

  constructor(
    private auth: AuthService,
    private membershipService: MembershipService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUserInfo();
    this.startMembershipCheck();
  }

  private async loadUserInfo() {
    this.auth.user$.subscribe(user => {
      if (user) {
        this.userEmail = user.email || '';
      }
    });
  }

  /**
   * Verifica automáticamente cada 10 segundos si se activó la membresía
   */
  private startMembershipCheck() {
    const checkInterval = setInterval(async () => {
      const user = await this.auth.user$.pipe().toPromise();
      if (user) {
        this.membershipService.hasActiveMembership(user.uid).subscribe(hasActive => {
          if (hasActive) {
            console.log('✅ Membresía activada detectada, redirigiendo...');
            clearInterval(checkInterval);
            this.router.navigate(['/tabs/tab1']);
          }
        });
      }
    }, 10000); // Cada 10 segundos
  }

  async logout() {
    await this.auth.logout();
  }
}