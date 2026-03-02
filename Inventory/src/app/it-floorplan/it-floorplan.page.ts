// it-floorplan.page.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { Preferences } from '@capacitor/preferences';

type Cubicle = {
  id: number;
  label: string;
  x: number;   // inside list-container (relative)
  y: number;
  w: number;
  h: number;
  color: string;
  locked: boolean; // kept for compatibility, but NOT used to block editing anymore
};

@Component({
  selector: 'app-it-floorplan',
  templateUrl: './it-floorplan.page.html',
  styleUrls: ['./it-floorplan.page.scss'],
  standalone: false
})
export class ItFloorplanPage implements OnInit, OnDestroy {

  @ViewChild('containerRef', { static: false }) containerRef!: ElementRef<HTMLElement>;

  selectedColor = '#4caf50';

  toolboxOpen = false;
  isEditMode = false;

  // ✅ Paint / Fill mode
  paintMode = false;
  selectedCubicleId: number | null = null;

  toolboxX = 30;
  toolboxY = 250;

  cubicleCount = 1;
  cubicles: Cubicle[] = [];

  // ===== GRID =====
  private readonly gridSize = 20;

  // ===== TOOLBOX DRAG =====
  private toolboxDragging = false;
  private toolboxDragOffsetX = 0;
  private toolboxDragOffsetY = 0;
  private toolboxMove = (e: PointerEvent) => this.onToolboxDragMove(e);
  private toolboxUp = () => this.onToolboxDragEnd();

  private readonly panelW = 160;
  private readonly panelH = 220;

  // ===== CUBICLE DRAG =====
  private cubDragging = false;
  private dragCubicleId: number | null = null;
  private cubDragOffsetX = 0;
  private cubDragOffsetY = 0;
  private cubStartSnapshot: { x: number; y: number } | null = null;

  private cubMove = (e: PointerEvent) => this.onCubicleDragMove(e);
  private cubUp = () => this.onCubicleDragEnd();

  // ===== RESIZE =====
  private resizing = false;
  private resizeCubicleId: number | null = null;
  private resizeStart:
    | { w: number; h: number; x: number; y: number; pointerX: number; pointerY: number }
    | null = null;

  private resizeMove = (e: PointerEvent) => this.onResizeMove(e);
  private resizeUp = () => this.onResizeEnd();

  // ===== STORAGE KEYS =====
  private readonly KEY_TOOLBOX_POS = 'floorplan_toolbox_pos';
  private readonly KEY_LAYOUT = 'floorplan_layout_v1';

  async ngOnInit() {
    await this.loadLayout();
    await this.loadToolboxPos();
  }

  ngOnDestroy() {
    window.removeEventListener('pointermove', this.toolboxMove);
    window.removeEventListener('pointerup', this.toolboxUp);

    window.removeEventListener('pointermove', this.cubMove);
    window.removeEventListener('pointerup', this.cubUp);

    window.removeEventListener('pointermove', this.resizeMove);
    window.removeEventListener('pointerup', this.resizeUp);
  }

  /* =========================
     TOOLBOX OPEN / SAVE
  ========================== */

  toggleToolbox(editBtn?: HTMLElement) {
    this.toolboxOpen = !this.toolboxOpen;

    // ✅ edit mode follows toolbox open state
    this.isEditMode = this.toolboxOpen;

    if (this.toolboxOpen) {
      this.positionToolboxAboveEdit(editBtn);
    } else {
      // turning off edit mode also turns off paint mode
      this.paintMode = false;
      this.selectedCubicleId = null;
    }
  }

  closeToolbox() {
    this.toolboxOpen = false;
    this.isEditMode = false;
    this.paintMode = false;
    this.selectedCubicleId = null;
  }

  async saveEditSettings() {
    // ✅ Save layout, then close edit mode
    await this.saveLayout();

    this.toolboxOpen = false;
    this.isEditMode = false;
    this.paintMode = false;
    this.selectedCubicleId = null;
  }

  selectColor(color: string) {
    this.selectedColor = color;
  }

  /* =========================
     PAINT / FILL MODE
  ========================== */

  togglePaintMode() {
    if (!this.isEditMode) return;

    this.paintMode = !this.paintMode;

    if (!this.paintMode) {
      this.selectedCubicleId = null;
    }
  }

  private async paintCubicle(c: Cubicle) {
    c.color = this.selectedColor;
    this.selectedCubicleId = c.id;
    await this.saveLayout();
  }

  /* =========================
     TOOLBOX DRAG
  ========================== */

  onToolboxDragStart(e: PointerEvent) {
    this.toolboxDragging = true;
    this.toolboxDragOffsetX = e.clientX - this.toolboxX;
    this.toolboxDragOffsetY = e.clientY - this.toolboxY;

    window.addEventListener('pointermove', this.toolboxMove);
    window.addEventListener('pointerup', this.toolboxUp);
  }

  private onToolboxDragMove(e: PointerEvent) {
    if (!this.toolboxDragging) return;

    const bounds = this.getSafeBoundsForToolbox();

    let x = e.clientX - this.toolboxDragOffsetX;
    let y = e.clientY - this.toolboxDragOffsetY;

    x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    y = Math.max(bounds.minY, Math.min(bounds.maxY, y));

    this.toolboxX = x;
    this.toolboxY = y;
  }

  private async onToolboxDragEnd() {
    if (!this.toolboxDragging) return;
    this.toolboxDragging = false;

    window.removeEventListener('pointermove', this.toolboxMove);
    window.removeEventListener('pointerup', this.toolboxUp);

    await Preferences.set({
      key: this.KEY_TOOLBOX_POS,
      value: JSON.stringify({ x: this.toolboxX, y: this.toolboxY })
    });
  }

  private positionToolboxAboveEdit(editBtn?: HTMLElement) {
    const margin = 12;
    const bounds = this.getSafeBoundsForToolbox();

    if (!editBtn) {
      this.toolboxX = bounds.maxX;
      this.toolboxY = bounds.maxY;
      return;
    }

    const rect = editBtn.getBoundingClientRect();

    let x = rect.right - this.panelW;
    let y = rect.top - this.panelH - margin;

    x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    y = Math.max(bounds.minY, Math.min(bounds.maxY, y));

    this.toolboxX = x;
    this.toolboxY = y;
  }

  /* =========================
     CUBICLES: ADD / DELETE
  ========================== */

  async addCubicle() {
    if (!this.isEditMode) return; // only add in edit mode

    const area = this.getContentArea();
    const w = this.snap(60);
    const h = this.snap(40);

    const nextNumber = this.cubicles.length + 1;

    const pos = this.findFreeSpot(area, w, h, this.snap(0), this.snap(0));
    if (!pos) return;

    const c: Cubicle = {
      id: Date.now(),
      label: `C${nextNumber}`,
      x: pos.x,
      y: pos.y,
      w,
      h,
      color: this.selectedColor,
      locked: false
    };

    this.cubicles.push(c);
    this.cubicleCount = this.cubicles.length + 1;

    await this.saveLayout();
  }

  private renumberCubicles() {
    const sorted = [...this.cubicles].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    sorted.forEach((c, i) => (c.label = `C${i + 1}`));
    this.cubicles = sorted;

    this.cubicleCount = this.cubicles.length === 0 ? 1 : this.cubicles.length + 1;
  }

  async deleteCubicle(id: number) {
    if (!this.isEditMode) return; // delete only in edit mode

    this.cubicles = this.cubicles.filter(c => c.id !== id);
    this.renumberCubicles();
    await this.saveLayout();
  }

  /* =========================
     CUBICLE POINTER HANDLER
     (Paint OR Drag)
  ========================== */

  onCubiclePointerDown(e: PointerEvent, c: Cubicle) {
    if (!this.isEditMode) return;

    // ✅ Paint mode: click fills the cubicle
    if (this.paintMode) {
      e.preventDefault();
      e.stopPropagation();
      this.paintCubicle(c);
      return;
    }

    // ✅ Normal mode: drag
    this.onCubicleDragStart(e, c);
  }

  /* =========================
     CUBICLE DRAG
  ========================== */

  private onCubicleDragStart(e: PointerEvent, c: Cubicle) {
    if (!this.isEditMode) return;
    if (this.resizing) return;

    this.cubDragging = true;
    this.dragCubicleId = c.id;

    this.cubDragOffsetX = e.clientX - this.containerLeft() - c.x;
    this.cubDragOffsetY = e.clientY - this.containerTop() - c.y;

    this.cubStartSnapshot = { x: c.x, y: c.y };

    window.addEventListener('pointermove', this.cubMove);
    window.addEventListener('pointerup', this.cubUp);
  }

  private onCubicleDragMove(e: PointerEvent) {
    if (!this.cubDragging || this.dragCubicleId == null) return;

    const idx = this.cubicles.findIndex(x => x.id === this.dragCubicleId);
    if (idx === -1) return;

    const c = this.cubicles[idx];
    const area = this.getContentArea();

    let x = e.clientX - this.containerLeft() - this.cubDragOffsetX;
    let y = e.clientY - this.containerTop() - this.cubDragOffsetY;

    x = this.snap(x);
    y = this.snap(y);

    x = Math.max(area.minX, Math.min(area.maxX - c.w, x));
    y = Math.max(area.minY, Math.min(area.maxY - c.h, y));

    const next = { ...c, x, y };

    if (this.overlapsAny(next, c.id)) return;

    this.cubicles[idx] = next;
  }

  private async onCubicleDragEnd() {
    if (!this.cubDragging) return;
    this.cubDragging = false;

    window.removeEventListener('pointermove', this.cubMove);
    window.removeEventListener('pointerup', this.cubUp);

    if (this.dragCubicleId != null && this.cubStartSnapshot) {
      const idx = this.cubicles.findIndex(x => x.id === this.dragCubicleId);
      if (idx !== -1) {
        const c = this.cubicles[idx];
        if (this.overlapsAny(c, c.id)) {
          this.cubicles[idx] = { ...c, ...this.cubStartSnapshot };
        }
      }
    }

    this.dragCubicleId = null;
    this.cubStartSnapshot = null;

    await this.saveLayout();
  }

  /* =========================
     RESIZE
  ========================== */

  onResizeStart(e: PointerEvent, c: Cubicle) {
    e.stopPropagation();
    if (!this.isEditMode) return;

    this.resizing = true;
    this.resizeCubicleId = c.id;

    this.resizeStart = {
      w: c.w,
      h: c.h,
      x: c.x,
      y: c.y,
      pointerX: e.clientX,
      pointerY: e.clientY
    };

    window.addEventListener('pointermove', this.resizeMove);
    window.addEventListener('pointerup', this.resizeUp);
  }

  private onResizeMove(e: PointerEvent) {
    if (!this.resizing || this.resizeCubicleId == null || !this.resizeStart) return;

    const idx = this.cubicles.findIndex(x => x.id === this.resizeCubicleId);
    if (idx === -1) return;

    const c = this.cubicles[idx];
    const area = this.getContentArea();

    const dx = e.clientX - this.resizeStart.pointerX;
    const dy = e.clientY - this.resizeStart.pointerY;

    let newW = this.snap(this.resizeStart.w + dx);
    let newH = this.snap(this.resizeStart.h + dy);

    newW = Math.max(this.gridSize * 2, newW);
    newH = Math.max(this.gridSize * 2, newH);

    newW = Math.min(newW, area.maxX - c.x);
    newH = Math.min(newH, area.maxY - c.y);

    const next = { ...c, w: newW, h: newH };

    if (this.overlapsAny(next, c.id)) return;

    this.cubicles[idx] = next;
  }

  private async onResizeEnd() {
    if (!this.resizing) return;
    this.resizing = false;

    window.removeEventListener('pointermove', this.resizeMove);
    window.removeEventListener('pointerup', this.resizeUp);

    this.resizeCubicleId = null;
    this.resizeStart = null;

    await this.saveLayout();
  }

  /* =========================
     OVERLAP + GRID + BOUNDS
  ========================== */

  private snap(v: number): number {
    return Math.round(v / this.gridSize) * this.gridSize;
  }

  private overlapsAny(c: Cubicle, ignoreId: number): boolean {
    const a = { x1: c.x, y1: c.y, x2: c.x + c.w, y2: c.y + c.h };

    return this.cubicles.some(o => {
      if (o.id === ignoreId) return false;

      const b = { x1: o.x, y1: o.y, x2: o.x + o.w, y2: o.y + o.h };

      return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
    });
  }

  private findFreeSpot(area: any, w: number, h: number, startX: number, startY: number) {
    for (let y = area.minY + startY; y <= area.maxY - h; y += this.gridSize) {
      for (let x = area.minX + startX; x <= area.maxX - w; x += this.gridSize) {
        const temp: Cubicle = {
          id: -1, label: '', x, y, w, h, color: this.selectedColor, locked: false
        };
        if (!this.overlapsAny(temp, -1)) return { x, y };
      }
    }
    return null;
  }

  private getSafeBoundsForToolbox() {
    const el = this.containerRef?.nativeElement;
    if (!el) {
      return {
        minX: 10,
        minY: 10,
        maxX: window.innerWidth - this.panelW - 10,
        maxY: window.innerHeight - this.panelH - 10
      };
    }

    const rect = el.getBoundingClientRect();
    return {
      minX: rect.left,
      minY: rect.top,
      maxX: rect.right - this.panelW,
      maxY: rect.bottom - this.panelH
    };
  }

  private getContentArea() {
    const el = this.containerRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    const padL = parseInt(style.paddingLeft) || 0;
    const padT = parseInt(style.paddingTop) || 0;
    const padR = parseInt(style.paddingRight) || 0;
    const padB = parseInt(style.paddingBottom) || 0;

    return {
      minX: padL,
      minY: padT,
      maxX: rect.width - padR,
      maxY: rect.height - padB
    };
  }

  private containerLeft(): number {
    return this.containerRef.nativeElement.getBoundingClientRect().left;
  }

  private containerTop(): number {
    return this.containerRef.nativeElement.getBoundingClientRect().top;
  }

  /* =========================
     SAVE / LOAD LAYOUT
  ========================== */

  private async saveLayout() {
    const payload = {
      cubicleCount: this.cubicleCount,
      cubicles: this.cubicles
    };

    await Preferences.set({
      key: this.KEY_LAYOUT,
      value: JSON.stringify(payload)
    });
  }

  private async loadLayout() {
    const { value } = await Preferences.get({ key: this.KEY_LAYOUT });
    if (!value) return;

    try {
      const parsed = JSON.parse(value);
      this.cubicleCount = parsed.cubicleCount ?? 1;
      this.cubicles = (parsed.cubicles ?? []) as Cubicle[];
    } catch {}
  }

  private async loadToolboxPos() {
    const { value } = await Preferences.get({ key: this.KEY_TOOLBOX_POS });
    if (!value) return;

    try {
      const pos = JSON.parse(value);
      if (typeof pos.x === 'number') this.toolboxX = pos.x;
      if (typeof pos.y === 'number') this.toolboxY = pos.y;
    } catch {}
  }
}