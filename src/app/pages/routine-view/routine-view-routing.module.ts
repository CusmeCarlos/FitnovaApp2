// src/app/pages/routine-view/routine-view-routing.module.ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RoutineViewPage } from './routine-view.page';

const routes: Routes = [
  {
    path: '',
    component: RoutineViewPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RoutineViewPageRoutingModule {}