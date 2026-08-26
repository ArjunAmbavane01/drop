import type { DirectSignalPayload } from "./types";

type PeerConnectionOptions = {
  initiator: boolean;
  iceServers: RTCIceServer[];
  sendSignal: (payload: DirectSignalPayload) => void;
  onConnected: () => void;
  onMessage: (data: string | ArrayBuffer) => void;
  onClosed: (reason?: string) => void;
};

export class DirectPeerConnection {
  private readonly connection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private remoteCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private closed = false;
  private readonly options: PeerConnectionOptions;

  constructor(options: PeerConnectionOptions) {
    this.options = options;
    this.connection = new RTCPeerConnection({ iceServers: options.iceServers });
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        options.sendSignal({ kind: "candidate", candidate: event.candidate.toJSON() });
      }
    };
    this.connection.onconnectionstatechange = () => {
      if (this.connection.connectionState === "connected") options.onConnected();
      if (["failed", "disconnected", "closed"].includes(this.connection.connectionState)) {
        this.close(this.connection.connectionState);
      }
    };
    this.connection.ondatachannel = (event) => this.attachDataChannel(event.channel);

    if (options.initiator) {
      this.attachDataChannel(this.connection.createDataChannel("direct-transfer", {
        ordered: true,
      }));
    }
  }

  private attachDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => this.options.onConnected();
    channel.onmessage = (event) => {
      if (typeof event.data === "string") this.options.onMessage(event.data);
      else if (event.data instanceof ArrayBuffer) this.options.onMessage(event.data);
      else if (event.data instanceof Blob) void event.data.arrayBuffer().then((data) => this.options.onMessage(data));
    };
    channel.onclose = () => this.close("data channel closed");
    channel.onerror = () => this.close("data channel error");
  }

  async startOffer() {
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    this.options.sendSignal({ kind: "offer", description: offer });
  }

  async handleSignal(signal: DirectSignalPayload) {
    if (signal.kind === "offer") {
      await this.connection.setRemoteDescription(signal.description);
      this.remoteDescriptionSet = true;
      await this.flushRemoteCandidates();
      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);
      this.options.sendSignal({ kind: "answer", description: answer });
      return;
    }

    if (signal.kind === "answer") {
      await this.connection.setRemoteDescription(signal.description);
      this.remoteDescriptionSet = true;
      await this.flushRemoteCandidates();
      return;
    }

    if (this.remoteDescriptionSet) {
      await this.connection.addIceCandidate(signal.candidate);
    } else {
      this.remoteCandidates.push(signal.candidate);
    }
  }

  private async flushRemoteCandidates() {
    const candidates = this.remoteCandidates.splice(0);
    for (const candidate of candidates) await this.connection.addIceCandidate(candidate);
  }

  send(data: string | ArrayBuffer) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("The direct connection is not ready.");
    }
    if (typeof data === "string") this.dataChannel.send(data);
    else this.dataChannel.send(data);
  }

  get bufferedAmount() {
    return this.dataChannel?.bufferedAmount ?? 0;
  }

  setBufferedAmountLowThreshold(value: number) {
    if (this.dataChannel) this.dataChannel.bufferedAmountLowThreshold = value;
  }

  waitForBufferedAmountLow() {
    if (!this.dataChannel || this.dataChannel.bufferedAmount <= this.dataChannel.bufferedAmountLowThreshold) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const channel = this.dataChannel;
      if (!channel) return resolve();
      channel.onbufferedamountlow = () => {
        channel.onbufferedamountlow = null;
        resolve();
      };
    });
  }

  close(reason = "closed") {
    if (this.closed) return;
    this.closed = true;
    this.dataChannel?.close();
    this.connection.close();
    this.options.onClosed(reason);
  }
}