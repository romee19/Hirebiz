// it-floorplan.page.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { IonPopover } from '@ionic/angular';

@Component({
  selector: 'app-it-floorplan',
  templateUrl: './it-floorplan.page.html',
  styleUrls: ['./it-floorplan.page.scss'],
  standalone: false
})
export class ItFloorplanPage implements OnInit {

  @ViewChild(IonPopover) popover!: IonPopover;

  selectedColor = '#4caf50';

  constructor() {}

  ngOnInit() {}

  selectColor(color: string) {
    this.selectedColor = color;
  }

  async saveEditSettings() {
    // ✅ Put your actual apply/save logic here
    // console.log('Saved:', this.selectedType, this.selectedColor);

    // Close popover after save
    if (this.popover) await this.popover.dismiss();
  }
}