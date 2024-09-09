import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Chat } from './chat';
import { Subject } from 'rxjs';

export const WS_ENDPOINT = 'ws://localhost:8081';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private socket$: WebSocketSubject<Chat> | undefined;

  private messagesSubject = new Subject<Chat>();

  messages$ = this.messagesSubject.asObservable();

  constructor() {
    console.log('[WebSocket]: connecting');
  }

  connect(): void {
    this.socket$ = this.getNewWebSocket();
    this.socket$.subscribe((msg) => {
      console.log('[WebSocket]: received message', msg.type);
      this.messagesSubject.next(msg);
    });
  }

  private getNewWebSocket(): WebSocketSubject<Chat> {
    return webSocket({
      url: WS_ENDPOINT,
      openObserver: {
        next: () => {
          console.log('[WebSocket]: connection opened');
        },
        error: (error) => {
          console.error(error);
        }
      },
      closeObserver: {
        next: () => {
          console.log('[WebSocket]: connection closed');
          this.socket$ = undefined;
          this.connect();
        },
        error: (error) => {
          console.error(error);
        },
      }
    });
  }

  sendMessage(msg: Chat): void {
    console.log('[WebSocket]: sending message', msg);
    this.socket$?.next(msg);
  }
}
