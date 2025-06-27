// src/app/app.module.ts
// ✅ AGREGAR LOS PROVIDERS NECESARIOS

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { environment } from '../environments/environment';

// ✅ IMPORTAR LOS SERVICIOS DE POSE
import { PoseDetectionEngine } from './core/pose-engine/pose-detection.engine';
import { BiomechanicsAnalyzer } from './core/pose-engine/biomechanics.analyzer';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireStorageModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // ✅ AGREGAR LOS PROVIDERS
    PoseDetectionEngine,
    BiomechanicsAnalyzer
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}