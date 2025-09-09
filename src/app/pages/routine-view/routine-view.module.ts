// src/app/pages/routine-view/routine-view.module.ts - CREAR ARCHIVO NUEVO
// ✅ MÓDULO PARA LA PÁGINA ROUTINE-VIEW

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { RoutineViewPageRoutingModule } from './routine-view-routing.module';
import { RoutineViewPage } from './routine-view.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RoutineViewPageRoutingModule,
    // ✅ La página es standalone, se importa a sí misma
    RoutineViewPage
  ],
  declarations: [
    // ✅ No declarar nada aquí porque RoutineViewPage es standalone
  ]
})
export class RoutineViewPageModule {}