import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';


import { ChatService } from './chat.service';

const mediaConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: true
};

const offerOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [MatButtonModule, MatGridListModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements AfterViewInit {
  private localStream: MediaStream | undefined | void;
  @ViewChild('localVideo') localVideo: ElementRef | undefined;

  private peerConnection: RTCPeerConnection | null | undefined;
  @ViewChild('remoteVideo') remoteVideo: ElementRef | undefined;

  constructor(private readonly chatService: ChatService) {
    console.log('[ChatComponent]: constructor');
  }

  videoTrackIndex = 1;
  ngAfterViewInit(): void {
    this.requestMediaDevices();
    this.addIncomingMessageHandler();
  }

  private async requestMediaDevices(): Promise<void> {
    this.localStream = await navigator.mediaDevices
      .getUserMedia(mediaConstraints)
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });

    this.pauseLocalVideo();
  }

  pauseLocalVideo(): void {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = false;
    });

    this.localVideo!.nativeElement.srcObject = undefined;
  }

  startLocalVideo(): void {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = true;
    });

    this.localVideo!.nativeElement.srcObject = this.localStream;
  }

  async changeWebcam(): Promise<void> {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.stop();
    });
    this.videoTrackIndex = this.videoTrackIndex === 0 ? 1 : 0;
    const videoTracks = await (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    navigator.mediaDevices.getUserMedia({video: {deviceId: videoTracks[this.videoTrackIndex]!.deviceId}}).then((stream) => {
      this.localVideo!.nativeElement.srcObject = stream;
      stream.getTracks().forEach((track) => {
        this.peerConnection?.getSenders().forEach((sender) => {
          if (sender.track?.kind === 'video') {
            sender.replaceTrack(track);
          }
        });
      });
    });
  }

  async call(): Promise<void> {
    this.createPeerConnection();

    this.localStream?.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    try {
      const offer: RTCSessionDescriptionInit = await this.peerConnection!.createOffer(offerOptions);
      await this.peerConnection!.setLocalDescription(offer);
      this.chatService.sendMessage({type: 'offer', data: offer});
    } catch (error) {
      console.error('Error creating offer.', error);
      this.handleGetUserMediaError(error as Error);
    }
  }

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: ['stun:stun.l.google.com:19302', 'stun:stun.kundenserver.de:3478']
        }
      ]
    });

    this.peerConnection.onicecandidate = (event) => {
      console.log('[PeerConnection]: icecandidate', event);
      this.handleIceCandidateEvent(event);
    };

    this.peerConnection.oniceconnectionstatechange = (event) => {
      console.log('[PeerConnection]: icegatheringstatechange', event);
      this.handleIceConnectionChangeStateEvent(event);
    };

    this.peerConnection.onsignalingstatechange = (event) => {
      console.log('[PeerConnection]: signalingstatechange', event);
      this.handleSignalingStateChangeEvent(event);
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[PeerConnection]: track', event);
      this.handleTrackEvent(event);
    };
  }

  private handleIceCandidateEvent(event: RTCPeerConnectionIceEvent): void {
    console.log('[PeerConnection]: icecandidate', event);
    if (event.candidate) {
      this.chatService.sendMessage({type: 'ice-candidate', data: event.candidate});
    }
  }

  private handleIceConnectionChangeStateEvent(event: Event): void {
    console.log('[PeerConnection]: icegatheringstatechange', event);
    switch (this.peerConnection?.iceConnectionState) {
      case 'new':
        console.log('[PeerConnection]: iceConnectionState new');
        break;
      case 'checking':
        console.log('[PeerConnection]: iceConnectionState checking');
        break;
      case 'connected':
        console.log('[PeerConnection]: iceConnectionState connected');
        break;
      case 'completed':
        console.log('[PeerConnection]: iceConnectionState completed');
        break;
      case 'failed':
        console.log('[PeerConnection]: iceConnectionState failed');
        break;
      case 'disconnected':
        console.log('[PeerConnection]: iceConnectionState disconnected');
        this.closeVideoCall();
        break;
      case 'closed':
        console.log('[PeerConnection]: iceConnectionState closed');
        break;
    }
  }

  private handleSignalingStateChangeEvent(event: Event): void {
    console.log('[PeerConnection]: signalingstatechange', event);
    switch (this.peerConnection?.signalingState) {
      case 'stable':
        console.log('[PeerConnection]: signalingState stable');
        break;
      case 'have-local-offer':
        console.log('[PeerConnection]: signalingState have-local-offer');
        break;
      case 'have-remote-offer':
        console.log('[PeerConnection]: signalingState have-remote-offer');
        break;
      case 'have-local-pranswer':
        console.log('[PeerConnection]: signalingState have-local-pranswer');
        break;
      case 'have-remote-pranswer':
        console.log('[PeerConnection]: signalingState have-remote-pranswer');
        break;
      case 'closed':
        console.log('[PeerConnection]: signalingState closed');
        this.closeVideoCall();
        break;
    }
  }

  private handleTrackEvent(event: RTCTrackEvent): void {
    console.log('[PeerConnection]: track', event);
    this.remoteVideo!.nativeElement.srcObject = event.streams[0];
  }

  private closeVideoCall(): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.ontrack = null;
    }
    this.peerConnection?.getTransceivers().forEach((transciever) => {
      transciever.stop();
    });
    this.peerConnection?.close();
    this.peerConnection = null;
  }

  private handleGetUserMediaError(error: Error): void {
    alert(`Error accessing media devices. , ${error.message}`);
    this.closeVideoCall();
  }

  private addIncomingMessageHandler(): void {
    this.chatService.connect();
    this.chatService.messages$.subscribe((message) => {
      console.log('[ChatComponent]: message received', message);
      switch (message.type) {
        case 'offer':
          this.handleOfferMessage(message.data);
          break;
        case 'answer':
          this.handleAnswerMessage(message.data);
          break;
        case 'hangup':
          this.handleHangupMessage(message);
          break;
        case 'ice-candidate':
          this.handleIceCandidateMessage(message.data);
          break;
        default:
          console.error('Unknown message', message.type);
      }
    }, (error) => {
      console.error('Error receiving message', error);
    });
  }

  private handleOfferMessage(offer: RTCSessionDescriptionInit): void {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    if (!this.localStream) {
      this.requestMediaDevices();
    }

    this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => {
      this.localVideo!.nativeElement.srcObject = this.localStream;

      this.localStream?.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    })
    .then(() => {
      return this.peerConnection?.createAnswer();
    })
    .then((answer) => {
      return this.peerConnection?.setLocalDescription(answer);
    })
    .then(() => {
      if (this.peerConnection?.localDescription) {
        this.chatService.sendMessage({type: 'answer', data: this.peerConnection.localDescription});
      } else {
        console.error('Local description is undefined.');
      }
    })
    .catch((error) => {
      console.error('Error creating answer.', error);
    });
  }

  private handleAnswerMessage(answer: RTCSessionDescriptionInit): void {
    this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
  }

  private handleHangupMessage(message: { type: string }): void {
    console.log('[ChatComponent]: hangup message received', message);
    this.closeVideoCall();
  }

  private handleIceCandidateMessage(candidate: RTCIceCandidate): void {
    console.log('[ChatComponent]: icecandidate message received', candidate);
    this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate))
    .catch((error: Error) => {
      console.error('Error name', error.name);
      console.error('Error adding ice candidate.', error);
    });
  }

  hangupCall(): void {
    this.chatService.sendMessage({type: 'hangup', data: ''});
    this.closeVideoCall();
  }
}
