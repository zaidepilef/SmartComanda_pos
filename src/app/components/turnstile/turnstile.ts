import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  afterNextRender,
  signal,
  viewChild,
} from '@angular/core';

import { environment } from '../../../environments/environment';

interface TurnstileCallbacks {
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileWindowApi {
  render: (
    container: HTMLElement,
    options: TurnstileCallbacks & { sitekey: string; theme: string }
  ) => string;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileWindowApi;
  }
}

@Component({
  selector: 'app-turnstile',
  template: `<div #container></div>`,
})
export class TurnstileComponent {
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly token = signal<string | null>(null);

  @Output() ready = new EventEmitter<TurnstileComponent>();

  #widgetId: string | null = null;
  #renderAttempt = 0;

  constructor() {
    afterNextRender(() => this.#render());
  }

  #render(): void {
    if (this.#renderAttempt > 30) {
      return;
    }

    const container = this.container()?.nativeElement;

    if (!container || !window.turnstile || !environment.turnstileSiteKey) {
      this.#renderAttempt += 1;
      setTimeout(() => this.#render(), 100);
      return;
    }

    this.#widgetId = window.turnstile.render(container, {
      sitekey: environment.turnstileSiteKey,
      theme: 'dark',
      callback: (token) => this.token.set(token),
      'expired-callback': () => this.token.set(null),
      'error-callback': () => this.token.set(null),
    });

    this.ready.emit(this);
  }

  reset(): void {
    this.token.set(null);

    if (this.#widgetId && window.turnstile) {
      window.turnstile.reset(this.#widgetId);
    }
  }
}