import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class LayoutComponent  implements OnInit {
  userName: string = 'User';
  userRole: string = 'User';
  isUserMenuOpen: boolean = false;
  isDarkMode: boolean = false;

  constructor(private router: Router, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.loadUserName();
    this.loadUserRole();
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    // Ensure change detection runs after loading
    this.cdr.detectChanges();
  }

  loadUserName() {
    const user = localStorage.getItem('user');
    console.log('localStorage user:', user);
    if (user) {
      try {
        const userData = JSON.parse(user);
        console.log('Parsed userData:', userData);
        this.userName = userData.username || userData.name || 'User';
        console.log('Set userName to:', this.userName);
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.userName = 'User';
      }
    } else {
      console.log('No user data in localStorage');
      this.userName = 'User';
    }
  }

  loadUserRole() {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        this.userRole = userData.role || 'User';
        console.log('Set userRole to:', this.userRole);
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.userRole = 'User';
      }
    } else {
      this.userRole = 'User';
    }
  }

  toggleUserMenu() {
    // Reload user data each time menu opens to ensure it's up to date
    this.loadUserName();
    this.loadUserRole();
    this.cdr.detectChanges();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/home']);
    this.isUserMenuOpen = false;
  }

  openNotificationSettings() {
    console.log('Opening notification settings');
    // Add notification settings logic
    this.isUserMenuOpen = false;
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode.toString());
    // Add dark mode toggle logic
  }

  openLanguageSettings() {
    console.log('Opening language settings');
    // Add language settings logic
    this.isUserMenuOpen = false;
  }

  navigate(route: string) {
    this.router.navigate([route]);
  }

}
