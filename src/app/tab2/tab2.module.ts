// src/app/tab2/tab2.module.ts
// ✅ MÓDULO CORREGIDO CON IMPORTACIÓN DEL COMPONENTE DE CÁMARA

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { Tab2PageRoutingModule } from './tab2-routing.module';
import { Tab2Page } from './tab2.page';

// ✅ IMPORTAR EL COMPONENTE DE CÁMARA
import { PoseCameraComponent } from '../features/training/components/pose-camera/pose-camera.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Tab2PageRoutingModule,
    // ✅ AGREGAR EL COMPONENTE STANDALONE
    PoseCameraComponent
  ],
  declarations: [Tab2Page]
})
export class Tab2PageModule {}