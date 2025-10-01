import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MembershipRequiredPage } from './membership-required.page';

const routes: Routes = [
  {
    path: '',
    component: MembershipRequiredPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MembershipRequiredPageRoutingModule {}
