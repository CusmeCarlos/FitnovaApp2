// src/app/tab1/tab1.module.ts - REEMPLAZAR ARCHIVO COMPLETO
// ✅ AGREGAR TrainingHistoryModalComponent AL MÓDULO

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { Tab1PageRoutingModule } from './tab1-routing.module';
import { Tab1Page } from './tab1.page';

// ✅ IMPORTAR EL COMPONENTE MODAL
import { TrainingHistoryModalComponent } from './components/training-history-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Tab1PageRoutingModule,
    // ✅ AGREGAR EL COMPONENTE STANDALONE
    TrainingHistoryModalComponent
  ],
  declarations: [
    Tab1Page
    // ✅ NO declarar TrainingHistoryModalComponent aquí porque es standalone
  ]
})
export class Tab1PageModule {}