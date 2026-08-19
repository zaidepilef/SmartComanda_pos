import { Component, EventEmitter, input, Output } from '@angular/core';

@Component({
  selector: 'app-pos-modal',
  imports: [],
  templateUrl: './pos-modal.html',
  styleUrls: ['./pos-modal.scss'],
})
export class PosModal {
  readonly open = input.required<boolean>();
  readonly title = input('');

  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }
}