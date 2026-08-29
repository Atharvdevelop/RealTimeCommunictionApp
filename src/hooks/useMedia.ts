import { useCallback, useRef, useState } from 'react';

export type DeviceOption = {
  deviceId: string;
  label: string;
};

export type MediaState = {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;
  audioInputs: DeviceOption[];
  videoInputs: DeviceOption[];
  selectedMicId: string | null;
  selectedCamId: string | null;
  error: string | null;
};

export function useMedia() {
  const [state, setState] = useState<MediaState>({
    localStream: null,
    screenStream: null,
    micOn: true,
    camOn: true,
    isScreenSharing: false,
    audioInputs: [],
    videoInputs: [],
    selectedMicId: null,
    selectedCamId: null,
    error: null,
  });

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const updateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 4)}` }));
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}` }));
      setState((s) => ({
        ...s,
        audioInputs,
        videoInputs,
        selectedMicId: s.selectedMicId ?? audioInputs[0]?.deviceId ?? null,
        selectedCamId: s.selectedCamId ?? videoInputs[0]?.deviceId ?? null,
      }));
      return { audioInputs, videoInputs };
    } catch {
      return { audioInputs: [], videoInputs: [] };
    }
  }, []);

  const initPreview = useCallback(
    async (micId?: string, camId?: string): Promise<MediaStream | null> => {
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const constraints: MediaStreamConstraints = {
          audio: micId ? { deviceId: { exact: micId } } : true,
          video: camId ? { deviceId: { exact: camId } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setState((s) => ({
          ...s,
          localStream: stream,
          micOn: true,
          camOn: true,
          error: null,
        }));
        await updateDevices();
        return stream;
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'Could not access camera/microphone',
        }));
        return null;
      }
    },
    [updateDevices]
  );

  const stopPreview = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setState((s) => ({
      ...s,
      localStream: null,
      screenStream: null,
      isScreenSharing: false,
    }));
  }, []);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setState((s) => ({ ...s, micOn: !s.micOn }));
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setState((s) => ({ ...s, camOn: !s.camOn }));
  }, []);

  const switchDevice = useCallback(async (kind: 'audio' | 'video', deviceId: string) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : true,
        video: kind === 'video' ? { deviceId: { exact: deviceId } } : true,
      });
      if (kind === 'audio') {
        stream.getAudioTracks().forEach((t) => t.stop());
        newStream.getAudioTracks().forEach((t) => {
          t.enabled = !state.micOn ? false : true;
          stream.addTrack(t);
        });
        stream.getAudioTracks().forEach((t, i) => {
          if (i > 0) {
            stream.removeTrack(t);
            t.stop();
          }
        });
        setState((s) => ({ ...s, selectedMicId: deviceId }));
      } else {
        stream.getVideoTracks().forEach((t) => t.stop());
        newStream.getVideoTracks().forEach((t) => {
          t.enabled = !state.camOn ? false : true;
          stream.addTrack(t);
        });
        stream.getVideoTracks().forEach((t, i) => {
          if (i > 0) {
            stream.removeTrack(t);
            t.stop();
          }
        });
        setState((s) => ({ ...s, selectedCamId: deviceId }));
      }
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Device switch failed' }));
    }
  }, [state.micOn, state.camOn]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setState((s) => ({ ...s, screenStream: null, isScreenSharing: false }));
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      setState((s) => ({ ...s, screenStream, isScreenSharing: true }));
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopScreenShare();
      });
      return screenStream;
    } catch {
      return null;
    }
  }, [stopScreenShare]);

  return {
    state,
    initPreview,
    stopPreview,
    toggleMic,
    toggleCam,
    switchDevice,
    startScreenShare,
    stopScreenShare,
    updateDevices,
    localStreamRef,
  };
}
