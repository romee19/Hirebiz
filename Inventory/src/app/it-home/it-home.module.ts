import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ItHomePageRoutingModule } from './it-home-routing.module';

import { ItHomePage } from './it-home.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ItHomePageRoutingModule
  ],
  declarations: [ItHomePage]
})
export class ItHomePageModule {}
