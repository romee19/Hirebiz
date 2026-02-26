import { Component, OnInit, OnDestroy } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-it-floorplan',
  templateUrl: './it-floorplan.page.html',
  styleUrls: ['./it-floorplan.page.scss'],
  standalone: false
})
export class ItFloorplanPage implements OnInit, OnDestroy {

  selectedColor = '#4caf50';

  toolboxOpen = false;

  // default start position (bottom-left area)
  toolboxX = 30;
  toolboxY = 250;

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private onMove = (e: PointerEvent) => this.onDragMove(e);
  private onUp = () => this.onDragEnd();

  async ngOnInit() {
    // Optional: load saved position
    const { value } = await Preferences.get({ key: 'floorplan_toolbox_pos' });
    if (value) {
      try {
        const pos = JSON.parse(value);
        if (typeof pos.x === 'number') this.toolboxX = pos.x;
        if (typeof pos.y === 'number') this.toolboxY = pos.y;
      } catch {}
    }
  }

  ngOnDestroy() {
    // cleanup listeners if user navigates away while dragging
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  toggleToolbox() {
    this.toolboxOpen = !this.toolboxOpen;
  }

  closeToolbox() {
    this.toolboxOpen = false;
  }

  selectColor(color: string) {
    this.selectedColor = color;
  }

  async saveEditSettings() {
    // Put your apply/save logic here
    // console.log('Saved color:', this.selectedColor);

    this.closeToolbox();
  }

  onDragStart(e: PointerEvent) {
    // only left click / primary pointer
    this.dragging = true;

    // where inside the toolbox the pointer grabbed
    this.dragOffsetX = e.clientX - this.toolboxX;
    this.dragOffsetY = e.clientY - this.toolboxY;

    // capture pointer events globally
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  onDragMove(e: PointerEvent) {
    if (!this.dragging) return;

    // new position
    let newX = e.clientX - this.dragOffsetX;
    let newY = e.clientY - this.dragOffsetY;

    // keep within viewport
    const panelW = 200;
    const panelH = 210;

    const maxX = window.innerWidth - panelW - 10;
    const maxY = window.innerHeight - panelH - 10;

    newX = Math.max(10, Math.min(maxX, newX));
    newY = Math.max(10, Math.min(maxY, newY));

    this.toolboxX = newX;
    this.toolboxY = newY;
  }

  async onDragEnd() {
    if (!this.dragging) return;
    this.dragging = false;

    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);

    // Optional: save position
    await Preferences.set({
      key: 'floorplan_toolbox_pos',
      value: JSON.stringify({ x: this.toolboxX, y: this.toolboxY })
    });
  }
}