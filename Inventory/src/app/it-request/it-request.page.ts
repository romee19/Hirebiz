import { Component, OnInit } from '@angular/core';
import { ItRequestService } from '../services/it-request.service';
import { AlertController } from '@ionic/angular';

interface RequestItem {
  id?: number;
  title: string;
  ownerInitials: string;
  username?: string;
  status: 'new'|'inprogress'|'completed'|'rejected';
  time: string;
  date: string;
}

interface UserData {
  id: number;
  username: string;
  role: string;
}

@Component({
  selector: 'app-it-request',
  templateUrl: './it-request.page.html',
  styleUrls: ['./it-request.page.scss'],
  standalone: false
})
export class ItRequestPage implements OnInit {

  columns: { label: string; status: RequestItem['status'] }[] = [
    { label: 'New', status: 'new' },
    { label: 'In-Progress', status: 'inprogress' },
    { label: 'Completed', status: 'completed' },
    { label: 'Rejected', status: 'rejected' }
  ];

  requests: RequestItem[] = [];
  currentUser: UserData | null = null;

  constructor(
    private itRequestService: ItRequestService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadCurrentUser();
    this.loadRequests();
  }

  /**
   * Load the current logged-in user from localStorage
   */
  loadCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
  }

  /**
   * Load all IT requests from the backend
   */
  loadRequests() {
    this.itRequestService.getAllRequests().subscribe(
      (response: any) => {
        if (response.success && response.requests) {
          this.requests = response.requests.map((req: any) => ({
            id: req.id,
            title: req.request_text,
            ownerInitials: this.getInitials(req.username),
            username: req.username,
            status: this.mapStatus(req.status),
            time: new Date(req.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            date: new Date(req.created_at).toLocaleDateString()
          }));
        }
      },
      (error) => {
        console.error('Error loading requests:', error);
      }
    );
  }

  /**
   * Map database status values to UI status values
   */
  mapStatus(dbStatus: string): RequestItem['status'] {
    switch(dbStatus) {
      case 'new': return 'new';
      case 'inprogress': return 'inprogress';
      case 'completed': return 'completed';
      case 'rejected': return 'rejected';
      default: return 'new';
    }
  }

  /**
   * Get user initials from username
   */
  getInitials(username: string): string {
    if (!username) return 'UN';
    const parts = username.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().substring(0, 2);
  }

  itemsByStatus(status: RequestItem['status']) {
    return this.requests.filter(r => r.status === status);
  }

  /**
   * Show modal to create a new request
   */
  async addRequest(status: RequestItem['status']) {
    if (!this.currentUser) {
      await this.showAlert('Error', 'User not logged in. Please log in first.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Create New IT Request',
      message: 'Enter your request details:',
      inputs: [
        {
          name: 'requestText',
          type: 'textarea',
          placeholder: 'Describe your IT issue or request...',
          attributes: {
            rows: 5,
            required: true
          }
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Submit',
          handler: (data) => {
            if (data.requestText && data.requestText.trim()) {
              this.submitRequest(data.requestText.trim());
            } else {
              this.showAlert('Error', 'Please enter a request description.');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Submit the request to the backend
   */
  submitRequest(requestText: string) {
    if (!this.currentUser || !this.currentUser.username) {
      console.warn('Current user is null or missing username');
      this.showAlert('Error', 'User information not available. Please try logging in again.');
      return;
    }

    console.log('Submitting request - Current user:', this.currentUser);

    const userId = this.currentUser.id ?? 1; // Use default id if null or undefined

    this.itRequestService.createRequest(
      userId,
      this.currentUser.username,
      requestText
    ).subscribe(
      (response: any) => {
        console.log('Submit response:', response);
        if (response.success) {
          this.showAlert('Success', 'Request created successfully!');
          this.loadRequests(); // Reload requests to show the new one
        } else {
          const errorMsg = response.error?.message || 'Failed to create request. Check browser console for details.';
          this.showAlert('Error', errorMsg);
        }
      },
      (error) => {
        console.error('Error creating request:', error);
        let errorMessage = 'An error occurred while creating the request.';
        
        if (error.status === 0) {
          errorMessage = 'Cannot connect to server. Make sure backend is running on localhost:3000';
        } else if (error.status === 400) {
          errorMessage = 'Invalid request data. User ID or username may be missing.';
        } else if (error.status === 500) {
          errorMessage = 'Server error. Check server logs.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.showAlert('Error', errorMessage);
      }
    );
  }

  /**
   * Show an alert dialog
   */
  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}

