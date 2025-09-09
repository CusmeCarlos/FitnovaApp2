// src/app/app-routing.module.ts
// ✅ ROUTING CORREGIDO - ORDEN CORRECTO DE RUTAS

import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { ReverseAuthGuard } from './guards/reverse-auth.guard';

const routes: Routes = [
  // ✅ RUTAS DE AUTENTICACIÓN
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadChildren: () => import('./pages/auth/login/login.module')
                              .then(m => m.LoginPageModule),
        // ✅ Evita acceso si ya está autenticado
        canActivate: [ReverseAuthGuard]
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },
  
  // ✅ RUTAS PRINCIPALES DE LA APP (PROTEGIDAS)
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module')
                          .then(m => m.TabsPageModule),
    // ✅ Requiere autenticación para acceder
    canActivate: [AuthGuard]
  },

  // ✅ RUTA ROUTINE-VIEW - DEBE IR ANTES DEL WILDCARD
  {
    path: 'routine-view',
    loadChildren: () => import('./pages/routine-view/routine-view.module').then(m => m.RoutineViewPageModule),
    canActivate: [AuthGuard] // ✅ Agregar protección con autenticación
  },
  
  // ✅ REDIRECCIONES
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  
  // ✅ RUTA FALLBACK - ESTA DEBE IR AL FINAL
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { 
      preloadingStrategy: PreloadAllModules,
      // ✅ Configuraciones adicionales para producción
      enableTracing: false, // Solo para debug
      onSameUrlNavigation: 'reload'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}