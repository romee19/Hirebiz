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

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
  }

  handleClick() {
    this.router.navigate(['/app/it-inventory']);
  }
}
