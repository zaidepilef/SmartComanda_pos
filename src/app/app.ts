import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PosHeader } from './components/pos-header/pos-header';
import { ToastComponent } from './components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PosHeader, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}