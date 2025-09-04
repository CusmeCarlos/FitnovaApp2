// src/app/tab1/tab1.module.ts
// ✅ CORREGIR IMPORTS PARA COMPONENTE STANDALONE

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { Tab1PageRoutingModule } from './tab1-routing.module';
import { Tab1Page } from './tab1.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Tab1PageRoutingModule
    // ✅ NO DECLARAR componentes standalone aquí
  ],
  declarations: [
    Tab1Page
    // ✅ REMOVER TrainingHistoryModalComponent porque es standalone
  ]
})
export class Tab1PageModule {}