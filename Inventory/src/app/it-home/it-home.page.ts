import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-it-home',
  templateUrl: './it-home.page.html',
  styleUrls: ['./it-home.page.scss'],
  standalone: false
})
export class ItHomePage implements OnInit {
  totalItems: number = 0;
  availableItems: number = 0;
  defectiveItems: number = 0;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadInventoryStats();
  }

  loadInventoryStats() {
    // Load inventory statistics from backend
    try {
      this.totalItems = 45;
      this.availableItems = 38;
      this.defectiveItems = 7;
    } catch (error) {
      console.error('Error loading inventory stats', error);
    }
  }

  handleClick() {
    this.router.navigate(['/app/it-inventory']);
  }
}
