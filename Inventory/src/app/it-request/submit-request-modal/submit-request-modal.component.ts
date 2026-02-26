import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-submit-request-modal',
  templateUrl: './submit-request-modal.component.html',
  styleUrls: ['./submit-request-modal.component.scss'],
  standalone: false
})
export class SubmitRequestModalComponent {
  cubicleNumber: string = '';
  peripheral: string = '';
  reason: string = '';

  peripherals = [
    { text: 'Monitor', value: 'monitor' },
    { text: 'Headset', value: 'headset' },
    { text: 'Webcam', value: 'webcam' },
    { text: 'Mouse', value: 'mouse' },
    { text: 'Keyboard', value: 'keyboard' },
    { text: 'CPU', value: 'cpu' }
  ];

  constructor(private modalController: ModalController) {}

  dismiss() {
    this.modalController.dismiss();
  }

  submit() {
    if (!this.cubicleNumber.trim()) {
      alert('Please enter a Cubicle Number');
      return;
    }
    if (!this.peripheral) {
      alert('Please select a Peripheral');
      return;
    }

    this.modalController.dismiss({
      cubicleNumber: this.cubicleNumber.trim(),
      peripheral: this.peripheral,
      reason: this.reason.trim()
    });
  }
}
