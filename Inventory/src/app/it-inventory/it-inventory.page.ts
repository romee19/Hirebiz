import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AddItemModalPage } from '../add-item-modal/add-item-modal.page';

@Component({
  selector: 'app-it-inventory',
  templateUrl: './it-inventory.page.html',
  styleUrls: ['./it-inventory.page.scss'],
  standalone: false
})
export class ItInventoryPage {

  constructor(private modalCtrl: ModalController) {}

  async openAddItemModal() {
    const modal = await this.modalCtrl.create({
      component: AddItemModalPage,
      cssClass: 'import-file-modal'
    });

    await modal.present();
  }

}
