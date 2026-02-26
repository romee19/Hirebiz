import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ItRequestPageRoutingModule } from './it-request-routing.module';

import { ItRequestPage } from './it-request.page';
import { SubmitRequestModalComponent } from './submit-request-modal/submit-request-modal.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ItRequestPageRoutingModule,
    HttpClientModule
  ],
  declarations: [ItRequestPage, SubmitRequestModalComponent]
})
export class ItRequestPageModule {}
