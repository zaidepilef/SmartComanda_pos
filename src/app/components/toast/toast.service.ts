import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'ok' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);

  #nextId = 1;

  show(text: string, type: ToastMessage['type'] = 'info'): void {
    const id = this.#nextId++;

    this.messages.update((current) => [...current, { id, text, type }]);

    setTimeout(() => this.remove(id), 4000);
  }

  ok(text: string): void {
    this.show(text, 'ok');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  remove(id: number): void {
    this.messages.update((current) => current.filter((message) => message.id !== id));
  }
}