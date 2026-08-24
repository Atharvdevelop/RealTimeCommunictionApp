# PulseMeet — Real-Time Video Conferencing & Collaborative Workspace

A modern, full-featured real-time video conferencing and collaborative workspace web application built with **React**, **TypeScript**, **Tailwind CSS**, and **Vite**.

---

## 🚀 Live Demo
> **[Optional Live Link]**: *Deploy to Vercel/Netlify and paste your live deployment link here.*

---

## ✨ Features

- **📹 High-Definition Video & Audio**: Real-time camera & microphone stream management using WebRTC media APIs with mic/camera toggle and dynamic device selection.
- **🖥️ Screen Sharing**: One-click screen sharing to present your desktop or window to meeting participants.
- **🎨 Interactive Collaborative Whiteboard**:
  - Pen, eraser, shapes (rectangles, circles, arrows), and text tools.
  - Multi-color palette and brush size selector.
  - Live cursor tracking and stroke synchronization.
  - Undo/Redo and snapshot export (PNG download).
- **💬 Real-Time In-Meeting Chat**: Instant messaging with emoji picker and timestamped chat logs.
- **📁 File Sharing**: Secure in-meeting file sharing and downloads.
- **🔒 Room Management & Security**:
  - Unique room code generation (`pulse-xxx-yyy`).
  - Optional passcode protection.
  - Host controls (mute all participants).
- **⚡ Zero-Config Local Mode**: Runs instantly out-of-the-box in local demo mode using browser `BroadcastChannel` and `localStorage`, or connects to a Supabase backend for cloud persistence.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide Icons
- **Real-Time Layer**: Supabase Realtime / WebRTC / HTML5 Media APIs & BroadcastChannel
- **Build Tool**: Vite

---

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/your-username/RealTimeCommunictionApp.git
cd RealTimeCommunictionApp
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note**: The app includes a built-in **Zero-Config Local Mode**. You do not need any database setup to run and test all features immediately! If you open two browser tabs/windows to the same room, you can test multi-user chat, presence, and whiteboard sync locally.

---

## ⚙️ Optional: Connect Cloud Database (Supabase)

If you wish to enable cloud persistence across remote devices:

1. Create a free project at [Supabase](https://supabase.com).
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Add your Supabase credentials in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. Run the SQL migrations from the `supabase/migrations/` directory in your Supabase SQL Editor.

---

## 📁 Project Structure

```text
├── src/
│   ├── components/       # UI Components (Lobby, PreJoin, MeetingRoom, Whiteboard, Chat, etc.)
│   ├── context/          # RoomContext state & Realtime event listeners
│   ├── hooks/            # useMedia hook for camera, microphone & screen capture
│   ├── lib/              # Supabase client, type definitions, and utility helpers
│   ├── App.tsx           # Main application router and state machine
│   └── main.tsx          # React application entry point
├── supabase/
│   └── migrations/       # Database SQL schema blueprints
├── .env.example          # Environment variable template
└── package.json          # Project dependencies & scripts
```

---

## 🛡️ Security & Privacy

- No hardcoded API keys, private passwords, or external trackers are present in the repository.
- Camera and microphone access strictly require user consent via standard browser permissions.
- Environment credentials (`.env`) are excluded from Git via `.gitignore`.
