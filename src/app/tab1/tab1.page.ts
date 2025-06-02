import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/user.interface';
@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  user: User | null = null;

  constructor(private auth: AuthService) {
    this.auth.user$.subscribe(u => {
      this.user = u;
    });
  }
}
