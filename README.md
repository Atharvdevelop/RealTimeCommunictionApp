# ⚡ PulseMeet — Real-Time Video Conferencing & Collaborative Workspace

<div align="center">

![PulseMeet Banner](https://img.shields.io/badge/PulseMeet-Real--Time%20Collaboration-10b981?style=for-the-badge&logo=webrtc&logoColor=white)

[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Live%20Deployment-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://real-time-communiction-app.vercel.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Mesh-333333?style=flat-square&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Code Quality](https://img.shields.io/badge/Code%20Quality-Verified-10b981?style=flat-square)](https://github.com/Atharvdevelop/RealTimeCommunictionApp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**A high-performance, full-featured video conferencing and collaborative workspace web application engineered with React, TypeScript, Tailwind CSS, and WebRTC.**

### 🌐 [**👉 Click Here to Launch Live Web Application (Vercel) 👈**](https://real-time-communiction-app.vercel.app/)

[🚀 Quick Start](#-quick-start-zero-configuration) • [✨ Features](#-complete-feature-matrix) • [🏗️ Architecture](#%EF%B8%8F-system-architecture) • [🔒 Security](#-security--network-architecture) • [⌨️ Shortcuts](#%EF%B8%8F-keyboard-shortcuts)

</div>

---

## 🛠️ Engineering Highlights & Technical Standards

- **Strict Type Safety & Clean Architecture**: End-to-end TypeScript implementation with 0 `any` types, centralized domain schemas in `src/lib/types.ts`, and strict compiler checks.
- **Modular Component Design**: Clean separation of concerns across presentation (`src/components/`), reactive lifecycle hooks (`src/hooks/`), global room state (`src/context/`), and data adapters (`src/lib/`).
- **WebRTC Peer-to-Peer Mesh**: Deterministic signaling lifecycle, automated ICE candidate negotiation, active stream track substitution, and STUN/NAT fallback handling.
- **Dual-Mode Signaling Transport**:
  - **Zero-Config Local Mode**: Employs browser `BroadcastChannel` and `localStorage` for offline peer communication and multi-tab instant testing.
  - **Cloud Mode**: Connects directly to Supabase Realtime channels for remote multi-device signaling and database persistence.
- **Client-Side Media Processing**: Hardware-accelerated Web Audio API `AnalyserNode` for active speaker detection, custom HTML5 Canvas collaborative whiteboard, and in-browser `MediaRecorder` video capture (.webm export).
- **A11y & UI Excellence**: WCAG 2.1 AA accessible semantic HTML, keyboard shortcuts, glassmorphism design system, and responsive layout scaling for mobile and widescreen displays.

---

## 🏗️ Architecture & Trade-offs

> **TL;DR** — This application uses a **P2P Full-Mesh** architecture, which is the optimal cost-free design for small group calls (2–4 participants). This section explains the deliberate engineering decisions and how the system would evolve at scale.

### Why P2P Mesh (not an SFU or MCU)?

| Architecture | How it Works | Best For | Used Here |
|---|---|---|---|
| **P2P Full-Mesh** | Every peer connects directly to every other peer | ≤4 participants, zero server cost | ✅ Yes |
| **SFU** (e.g. LiveKit, Mediasoup) | All peers send one stream to a central server which selects & forwards | 4–100+ participants | Roadmap |
| **MCU** (e.g. Jitsi) | Server decodes, mixes, and re-encodes all streams into one | Broadcast, webinar scale | Not needed |

In a **Full-Mesh**, every participant maintains a direct `RTCPeerConnection` to every other participant. Upload bandwidth scales at **O(N−1)** per client and connections scale at **O(N²)** total, making it impractical beyond 4–5 simultaneous participants due to client CPU and bandwidth saturation.

For a **zero-server-cost internship project**, this is the deliberate and correct choice. It keeps operational cost at $0, removes transcoding latency, and directly demonstrates the WebRTC lifecycle that third-party SDKs (Agora, Twilio, Daily.co) intentionally abstract away.

### Signaling Transport — Why Supabase Realtime?

WebRTC itself has **no signaling protocol** — it only defines what to exchange (SDP offers/answers, ICE candidates), not *how* to exchange them. Common choices are:

- **WebSocket server** (e.g. Socket.io on Node.js) — requires persistent compute, not serverless-compatible
- **Supabase Realtime** — cloud-native, zero-server-management, scales automatically

This app uses **Supabase Realtime broadcast channels** for signaling. This solves the key operational challenge of running stateful WebSocket connections on ephemeral serverless platforms like Vercel, while keeping the full stack deployable with a single `npm run build`.

### Key Engineering Challenges Solved

**1. Asynchronous SDP & ICE Candidate Synchronization**

If an ICE candidate arrives before `setRemoteDescription()` resolves, the browser throws an `InvalidStateError`. The signaling state machine in `useWebRTC.ts` solves this by queuing candidates in `pendingCandidatesRef` and draining the queue only after the remote description is applied.

**2. Deterministic Call Initiation (No Double-Offer Race)**

In a naive P2P setup, both peers simultaneously create offers — causing a "glare" state where both have `have-local-offer`. This is resolved deterministically: only the peer with the **alphabetically higher user ID** initiates the offer, guaranteeing exactly one `RTCPeerConnection` is created per pair.

**3. Automatic ICE Restart on Network Interruption**

When a peer switches networks (e.g. Wi-Fi to mobile data), the `iceConnectionState` transitions to `disconnected` or `failed`. `useWebRTC.ts` detects this and automatically triggers `pc.createOffer({ iceRestart: true })` after a 4-second debounce, re-negotiating ICE without requiring a manual page reload.

**4. Adaptive Bitrate Constraints**

As participant count grows, video quality is automatically adjusted via `RTCRtpSender.setParameters()` to reduce CPU and bandwidth load:
- 1:1 call → **1.5 Mbps** (1080p/720p)
- 3–4 peers → **600 kbps** (480p)
- 5+ peers → **250 kbps** (360p)

### If This Were a Production System...

The natural next architectural step for handling 5+ participants would be integrating an **SFU** (Selective Forwarding Unit). A LiveKit or Mediasoup SFU keeps each client's **upload bandwidth flat at O(1)** — the client sends one stream to the SFU, which selectively forwards it to recipients. The codebase is structured so `useWebRTC.ts` could be swapped for a LiveKit client adapter without changing any UI component.

---


PulseMeet uses a reactive, event-driven mesh architecture with an abstracted real-time transport layer.

```mermaid
graph TD
    A[Client UI: Lobby / PreJoin / MeetingRoom] --> B[RoomProvider Context State]
    B --> C[useMedia Hook: Audio/Video/Screen Capture]
    B --> D[useWebRTC Hook: P2P Peer Connections]
    B --> E[useRecorder Hook: Client-Side MediaRecorder]
    
    D -->|ICE Candidates & SDP Offers/Answers| F{Signaling Layer}
    F -->|Zero-Config Mode| G[BroadcastChannel & LocalStorage Mesh]
    F -->|Cloud Mode| H[Supabase Realtime Engine]

    B --> I[Interactive Modules]
    I --> J[Collaborative Canvas Whiteboard]
    I --> K[Encrypted In-Meeting Chat & File Sharing]
    I --> L[Floating Live Reactions & Hand Raising]
    I --> M[Network Health Diagnostics HUD]
```

---

## 🔄 WebRTC P2P Signaling Flow

```mermaid
sequenceDiagram
    autonumber
    actor PeerA as Peer A (Initiator)
    participant Channel as Realtime Signaling Layer
    actor PeerB as Peer B (Receiver)

    PeerA->>Channel: Join Room & Broadcast Presence
    PeerB->>Channel: Join Room & Broadcast Presence
    Note over PeerA,PeerB: Deterministic Initiator Resolution (Alphabetical ID)
    PeerA->>PeerA: Create RTCPeerConnection & Local MediaStream
    PeerA->>Channel: Send SDP Offer (webrtc:signal)
    Channel->>PeerB: Deliver SDP Offer
    PeerB->>PeerB: Set Remote Description & Create SDP Answer
    PeerB->>Channel: Send SDP Answer (webrtc:signal)
    Channel->>PeerA: Deliver SDP Answer
    PeerA->>Channel: Exchange ICE Candidates
    PeerB->>Channel: Exchange ICE Candidates
    Note over PeerA,PeerB: Direct Encrypted P2P Media Stream Connected (DTLS-SRTP)
```

---

## ✨ Complete Feature Matrix

### 📹 Real-Time Media & WebRTC
- **HD Video & Audio Streaming**: Adaptive resolution with dynamic device selector (camera, mic, audio output).
- **Active Speaker Detection**: Real-time Web Audio API `AnalyserNode` monitoring with glowing active speaker borders.
- **Screen Sharing**: 1-click desktop, window, or browser tab presentation with a dedicated right-side member sidebar layout.
- **Virtual Video Filters**: Normal, Soft Blur, Studio Black & White, Warm Glow, Cool Tint, and Classic Sepia.
- **Audio Diagnostics**: Live decibel meter visualizer with Hardware Echo Cancellation and Noise Suppression.

### 🎨 Collaborative Whiteboard
- **Complete Creative Toolkit**: Pen, Eraser, Rectangle, Circle, Arrow, and Text tools.
- **Rich Palette & Sizing**: 8 curated colors + adjustable stroke width slider (2px to 14px).
- **Multi-User Synchronous Drawing**: Sub-10ms stroke propagation and live remote cursor tracking.
- **History & Export**: Multi-level Undo/Redo stack and 1-click PNG snapshot export.

### 💬 In-Meeting Communication & Engagement
- **Live Floating Emoji Reactions**: Real-time animated emoji bursts (👏, ❤️, 🎉, 🔥, 🚀, 💡) that float upward across participant screens.
- **Hand Raising System (✋)**: Interactive hand raise toggle with active badges and priority sorting in participant drawers.
- **Encrypted Chat & File Sharing**: Instant messaging with quick emoji picker, @mentions, drag-and-drop file sharing, and download preview.
- **Audio / Video Recording**: In-browser client-side `MediaRecorder` meeting recording with duration HUD and automatic `.webm` export.

### 🛡️ Host Governance & Room Controls
- **Host Privileges**: Mute all participants, remove participants, transfer host controls, and lock room.
- **Passcode Protection**: Optional alphanumeric room passcodes for private sessions.
- **Direct QR Code Invite**: Procedurally generated SVG QR code modal for mobile camera scanning.
- **Network Health HUD**: Real-time Round Trip Time (RTT ping in ms), packet loss %, frame rate (FPS), and connection quality grade.

---

## 🔒 Security & Network Architecture

- **Media Encryption**: All WebRTC peer-to-peer audio/video tracks are encrypted in transit using standard **DTLS-SRTP** protocols.
- **Privacy First**: No webcam feeds or audio streams are routed through or stored on external application servers; media stays direct peer-to-peer.
- **Zero-Storage Transcripts**: Chat messages and presence states in demo mode persist strictly inside browser storage sessions or Supabase with explicit Row-Level Security (RLS) policies.
- **Host Moderation**: Cryptographically separated host controls for muting remote participants, transferring administrator privileges, and kicking disruptive users.

---

## 🚀 Quick Start (Zero-Configuration)

PulseMeet features an intelligent zero-config demo engine that functions immediately without requiring external API keys:

```bash
# 1. Clone the repository
git clone https://github.com/Atharvdevelop/RealTimeCommunictionApp.git
cd RealTimeCommunictionApp

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Open multiple tabs or windows to immediately test multi-user video feeds, chat, and whiteboard synchronization!

---

## ⌨️ Keyboard Shortcuts

| Shortcut Key | Action |
|:---:|---|
| <kbd>M</kbd> | Toggle Microphone (Mute / Unmute) |
| <kbd>V</kbd> | Toggle Camera (Start / Stop Video) |
| <kbd>H</kbd> | Raise / Lower Hand ✋ |
| <kbd>C</kbd> | Open / Close In-Meeting Chat Drawer |
| <kbd>P</kbd> | Open / Close Participants Panel |
| <kbd>W</kbd> | Open / Close Collaborative Whiteboard |
| <kbd>F</kbd> | **Focus Mode** — fullscreen screen share (when active) |
| <kbd>?</kbd> | Open Keyboard Shortcuts Cheatsheet |
| <kbd>Esc</kbd> | Close active drawer, modal, or exit Focus Mode |


---

## 🧪 Code Quality & Verification Suite

```bash
# Run TypeScript strict type verification
npm run typecheck

# Run ESLint validation (0 errors, 0 warnings)
npm run lint

# Build production bundle
npm run build
```

---

## 📁 Project Structure

```text
RealTimeCommunictionApp/
├── public/
│   ├── favicon.svg             # Glowing SVG application icon
│   └── og-preview.png          # OpenGraph social share card
├── src/
│   ├── components/             # Modular React UI components
│   │   ├── ChatDrawer.tsx      # In-meeting chat & file transfers
│   │   ├── ControlDock.tsx     # Floating media control bar
│   │   ├── ErrorBoundary.tsx   # Crash resilience fallback
│   │   ├── FloatingReactions.tsx # Animated floating emojis
│   │   ├── InviteModal.tsx     # QR code & direct link modal
│   │   ├── KeyboardShortcutsModal.tsx # Shortcuts cheatsheet
│   │   ├── Lobby.tsx           # Hero landing & mic tester
│   │   ├── MeetingRoom.tsx     # Core conference room orchestration
│   │   ├── NetworkStatsHUD.tsx # Live WebRTC ping & latency HUD
│   │   ├── ParticipantsDrawer.tsx # Participant management & host tools
│   │   ├── PreJoin.tsx         # Camera & mic hardware preview
│   │   ├── SettingsModal.tsx   # Virtual video filters & audio meter
│   │   ├── VideoTile.tsx       # Participant video & spotlight tile
│   │   └── Whiteboard.tsx      # Real-time collaborative canvas
│   ├── context/
│   │   ├── RoomContext.tsx     # Main application state provider
│   │   └── RoomContextInstance.ts # Context interfaces & definitions
│   ├── hooks/
│   │   ├── useAudioActivity.ts  # Real Web Audio RMS speaking detection
│   │   ├── useMedia.ts          # Camera, mic & screen stream hook
│   │   ├── usePeerStats.ts      # Real RTCPeerConnection.getStats() collector
│   │   ├── useRecorder.ts       # Client-side MediaRecorder capture
│   │   ├── useRoom.ts           # Central room context consumer hook
│   │   └── useWebRTC.ts         # P2P signaling, ICE restart & peer connections
│   ├── lib/
│   │   ├── supabase.ts          # Mock & production cloud database
│   │   ├── types.ts             # Centralized TypeScript definitions
│   │   ├── utils.ts             # Utility functions & formatters
│   │   └── webrtc-config.ts     # Dynamic TURN/STUN ICE server configuration
│   ├── App.tsx                 # Top-level state machine router
│   ├── index.css               # Design system, glassmorphism & filters
│   └── main.tsx                # React DOM root entry
├── index.html                  # SEO, OpenGraph, JSON-LD & Google Fonts
├── tailwind.config.js          # Tailwind theme & animation keyframes
├── tsconfig.app.json           # TypeScript strict compiler config
├── vite.config.ts              # Vite bundler configuration
└── package.json                # Project dependencies & scripts
```

---

## 📜 License

This project is licensed under the **MIT License** — feel free to customize and deploy for your personal or commercial applications.
