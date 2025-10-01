// src/app/app-routing.module.ts
// ✅ ROUTING CON MEMBERSHIP GUARD APLICADO

import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { ReverseAuthGuard } from './guards/reverse-auth.guard';
import { MembershipGuard } from './guards/membership.guard';

const routes: Routes = [
  // ✅ RUTAS DE AUTENTICACIÓN
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadChildren: () => import('./pages/auth/login/login.module')
                              .then(m => m.LoginPageModule),
        canActivate: [ReverseAuthGuard]
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },
  
  // ✅ RUTAS PRINCIPALES - PROTEGIDAS POR AUTH + MEMBERSHIP
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module')
                          .then(m => m.TabsPageModule),
    canActivate: [AuthGuard, MembershipGuard] // ✅ AMBOS GUARDS
  },

  // ✅ PÁGINA DE MEMBRESÍA REQUERIDA
  {
    path: 'membership-required',
    loadComponent: () => import('./pages/membership-required/membership-required.page')
                            .then(m => m.MembershipRequiredPage),
    canActivate: [AuthGuard] // Solo requiere auth, no membresía
  },

  // ✅ ROUTINE VIEW - TAMBIÉN PROTEGIDA
  {
    path: 'routine-view',
    loadChildren: () => import('./pages/routine-view/routine-view.module')
                          .then(m => m.RoutineViewPageModule),
    canActivate: [AuthGuard, MembershipGuard] // ✅ AMBOS GUARDS
  },

  // ✅ REDIRECCIONES
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  
  // ✅ FALLBACK
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { 
      preloadingStrategy: PreloadAllModules,
      enableTracing: false,
      onSameUrlNavigation: 'reload'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}