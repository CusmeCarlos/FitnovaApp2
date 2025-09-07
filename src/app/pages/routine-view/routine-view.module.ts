import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RoutineViewPageRoutingModule } from './routine-view-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RoutineViewPageRoutingModule
  ]
  // ✅ SIN DECLARATIONS - EL COMPONENTE ES STANDALONE
})
export class RoutineViewPageModule {}