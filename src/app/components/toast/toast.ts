import { Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrls: ['./toast.scss'],
})
export class ToastComponent {
  readonly #service = inject(ToastService);

  readonly messages = this.#service.messages;

  dismiss(id: number): void {
    this.#service.remove(id);
  }
}