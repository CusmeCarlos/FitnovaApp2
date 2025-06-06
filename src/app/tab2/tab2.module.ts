// src/app/tab2/tab2.module.ts

import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tab2Page } from './tab2.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { Tab2PageRoutingModule } from './tab2-routing.module';

// Importar el componente de cámara
import { PoseCameraComponent } from '../features/training/components/pose-camera/pose-camera.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    Tab2PageRoutingModule,
    // Importar el componente standalone
    PoseCameraComponent
  ],
  declarations: [Tab2Page]
})
export class Tab2PageModule {}