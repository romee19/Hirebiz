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
  toolboxX = 30;
  toolboxY = 250;

  // Cubicle count and array to store cubicles
  cubicleCount = 1;
  cubicles: { id: number, label: string, x: number, y: number }[] = [];

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private onMove = (e: PointerEvent) => this.onDragMove(e);
  private onUp = () => this.onDragEnd();

  async ngOnInit() {
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
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  // Open toolbox above the edit button
  toggleToolbox(editBtn?: HTMLElement) {
    this.toolboxOpen = !this.toolboxOpen;

    if (this.toolboxOpen) {
      this.positionToolboxAboveEdit(editBtn);
    }
  }

  private positionToolboxAboveEdit(editBtn?: HTMLElement) {
    const panelW = 160;
    const panelH = 220;
    const margin = 12;

    const containerPaddingLeft = 28;  // .list-container left padding
    const containerPaddingTop = 28;   // .list-container top padding

    if (!editBtn) {
      this.toolboxX = window.innerWidth - panelW - containerPaddingLeft - 10;
      this.toolboxY = window.innerHeight - panelH - containerPaddingTop - 80;
      return;
    }

    const rect = editBtn.getBoundingClientRect();

    let x = rect.right - panelW;
    let y = rect.top - panelH - margin;

    const maxX = window.innerWidth - panelW - containerPaddingLeft - 10;
    const maxY = window.innerHeight - panelH - containerPaddingTop - 10;

    x = Math.max(containerPaddingLeft, Math.min(maxX, x));
    y = Math.max(containerPaddingTop, Math.min(maxY, y));

    this.toolboxX = x;
    this.toolboxY = y;
  }

  closeToolbox() {
    this.toolboxOpen = false;
  }

  selectColor(color: string) {
    this.selectedColor = color;
  }

  async saveEditSettings() {
    this.closeToolbox();
  }

  onDragStart(e: PointerEvent) {
    this.dragging = true;
    this.dragOffsetX = e.clientX - this.toolboxX;
    this.dragOffsetY = e.clientY - this.toolboxY;

    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  onDragMove(e: PointerEvent) {
    if (!this.dragging) return;

    const panelW = 160;
    const panelH = 220;

    let newX = e.clientX - this.dragOffsetX;
    let newY = e.clientY - this.dragOffsetY;

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

    await Preferences.set({
      key: 'floorplan_toolbox_pos',
      value: JSON.stringify({ x: this.toolboxX, y: this.toolboxY })
    });
  }

  // Add cubicle when the tool-pill button is clicked
  addCubicle() {
    const newCubicle = {
      id: this.cubicleCount,
      label: `C${this.cubicleCount}`,
      x: 100 + (this.cubicleCount * 80), // Position horizontally
      y: 100 + (this.cubicleCount * 60)  // Position vertically
    };

    this.cubicles.push(newCubicle);
    this.cubicleCount++;  // Increment cubicle count
  }
}