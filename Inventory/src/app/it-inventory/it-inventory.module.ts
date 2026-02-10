import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ItInventoryPageRoutingModule } from './it-inventory-routing.module';

import { ItInventoryPage } from './it-inventory.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ItInventoryPageRoutingModule
  ],
  declarations: [ItInventoryPage]
})
export class ItInventoryPageModule {}
