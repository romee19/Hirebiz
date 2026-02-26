import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-it-home',
  templateUrl: './it-home.page.html',
  styleUrls: ['./it-home.page.scss'],
  standalone: false
})
export class ItHomePage implements OnInit {
  totalItems = 45;
  availableItems = 38;
  defectiveItems = 7;

  // Activity feed data — varied and realistic
  activities = [
    { initials: 'JD', user: 'John D.', action: 'requested 2 monitors for cubicle 4', time: '2 min ago', color: 'avatar-blue', tag: 'New', tagClass: 'tag-blue' },
    { initials: 'SM', user: 'Sarah M.', action: 'returned a defective keyboard', time: '15 min ago', color: 'avatar-red', tag: 'In Progress', tagClass: 'tag-amber' },
    { initials: 'AK', user: 'Alex K.', action: 'approved headset request #42', time: '1 hr ago', color: 'avatar-green', tag: 'Completed', tagClass: 'tag-green' },
    { initials: 'RL', user: 'Rachel L.', action: 'requested webcam for meeting room B', time: '2 hrs ago', color: 'avatar-purple', tag: 'New', tagClass: 'tag-blue' },
    { initials: 'TW', user: 'Tom W.', action: 'flagged mouse #18 as defective', time: '3 hrs ago', color: 'avatar-amber', tag: 'Rejected', tagClass: 'tag-red' },
    { initials: 'MN', user: 'Maria N.', action: 'completed WiFi dongle setup for floor 3', time: '5 hrs ago', color: 'avatar-green', tag: 'Completed', tagClass: 'tag-green' }
  ];

  
  requestCounts = { new: 9, inProgress: 6, completed: 12 };

  
  inventoryItems = [
    { name: 'Monitor', available: 12, defect: 3, statusClass: 'dot-green' },
    { name: 'Keyboard', available: 8, defect: 2, statusClass: 'dot-green' },
    { name: 'Headset', available: 5, defect: 4, statusClass: 'dot-amber' },
    { name: 'Webcam', available: 3, defect: 1, statusClass: 'dot-amber' },
    { name: 'Mouse', available: 15, defect: 2, statusClass: 'dot-green' },
    { name: 'WiFi Dongle', available: 2, defect: 5, statusClass: 'dot-red' }
  ];

  
  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Monitor', 'Keyboard', 'Headset', 'Webcam', 'Mouse', 'WiFi'],
    datasets: [
      {
        label: 'Available',
        data: [12, 8, 5, 3, 15, 2],
        backgroundColor: 'rgba(102, 126, 234, 0.85)',
        borderRadius: 6,
        barThickness: 18
      },
      {
        label: 'Defective',
        data: [3, 2, 4, 1, 2, 5],
        backgroundColor: 'rgba(235, 68, 90, 0.7)',
        borderRadius: 6,
        barThickness: 18
      }
    ]
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, family: "'Inter', sans-serif" },
          color: '#666'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(30, 30, 60, 0.9)',
        titleFont: { size: 12, family: "'Inter', sans-serif" },
        bodyFont: { size: 11, family: "'Inter', sans-serif" },
        padding: 10,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#999',
          font: { size: 11 },
          stepSize: 5
        },
        grid: { color: 'rgba(0,0,0,0.04)' },
        border: { display: false }
      },
      x: {
        ticks: {
          color: '#666',
          font: { size: 11 }
        },
        grid: { display: false },
        border: { display: false }
      }
    }
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadInventoryStats();
    this.loadActivities();
  }

  loadInventoryStats() {
    try {
      this.totalItems = 45;
      this.availableItems = 38;
      this.defectiveItems = 7;
    } catch (error) {
      console.error('Error loading inventory stats', error);
    }
  }

  /**
   * Load activities from the requests table
   */
  loadActivities() {
    this.http.get<any>('http://localhost:3000/api/it-requests').subscribe(
      (response) => {
        if (response.success && response.requests) {
          this.activities = response.requests.map((req: any) => {
            const initials = this.getInitials(req.username);
            const statusConfig = this.getStatusConfig(req.status);
            const timeAgo = this.getTimeAgo(req.created_at);

            return {
              initials,
              user: req.username,
              action: req.request_text,
              time: timeAgo,
              color: this.getAvatarColor(initials),
              tag: statusConfig.tag,
              tagClass: statusConfig.tagClass
            };
          });
          console.log('✅ Loaded activities from database:', this.activities);
        }
      },
      (error) => {
        console.error('❌ Error loading activities:', error);
        console.log('Using fallback hardcoded activities');
      }
    );
  }

  /**
   * Get status display config
   */
  getStatusConfig(status: string): { tag: string; tagClass: string } {
    const statusMap: { [key: string]: { tag: string; tagClass: string } } = {
      'new': { tag: 'New', tagClass: 'tag-blue' },
      'inprogress': { tag: 'In Progress', tagClass: 'tag-amber' },
      'completed': { tag: 'Completed', tagClass: 'tag-green' },
      'rejected': { tag: 'Rejected', tagClass: 'tag-red' }
    };
    return statusMap[status] || { tag: 'Pending', tagClass: 'tag-blue' };
  }

  /**
   * Get initials from username
   */
  getInitials(username: string): string {
    if (!username) return 'UN';
    const parts = username.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().substring(0, 2);
  }

  /**
   * Get avatar color based on initials hash
   */
  getAvatarColor(initials: string): string {
    const colors = ['avatar-blue', 'avatar-red', 'avatar-green', 'avatar-purple', 'avatar-amber'];
    let hash = 0;
    for (let i = 0; i < initials.length; i++) {
      hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Format timestamp to "X ago" format
   */
  getTimeAgo(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return created.toLocaleDateString();
  }

  handleClick() {
    this.router.navigate(['/app/it-inventory']);
  }

  navigateToRequests(status: string) {
    this.router.navigate(['/app/it-request'], { queryParams: { status } });
  }
}
