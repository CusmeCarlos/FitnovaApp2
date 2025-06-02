import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false  // Añade esta línea explícitamente
})
export class AppComponent {
  constructor(private auth: AuthService) {}

  logout() {
    this.auth.logout();
  }
}