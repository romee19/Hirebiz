import { Component, OnInit } from '@angular/core';

interface RequestItem {
  id: string;
  title: string;
  ownerInitials: string;
  status: 'new'|'inprogress'|'completed'|'rejected';
  time: string;
  date: string;
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

  constructor() {
    const now = new Date();
    const time = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const date = now.toLocaleDateString();
  }

  ngOnInit() {}

  itemsByStatus(status: RequestItem['status']) {
    return this.requests.filter(r => r.status === status);
  }

  addRequest(status: RequestItem['status']) {
    const id = Date.now().toString();
    const now = new Date();
    this.requests.unshift({
      id,
      title: 'New request',
      ownerInitials: 'ME',
      status,
      time: now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      date: now.toLocaleDateString()
    });
  }

}

