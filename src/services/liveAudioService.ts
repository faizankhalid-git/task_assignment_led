import { supabase } from '../lib/supabase';
import { audioService } from './audioNotifications';

interface AudioSession {
  id: string;
  broadcaster_id: string;
  broadcaster_name: string;
  is_active: boolean;
  started_at: string;
}

interface AudioChunk {
  id: string;
  session_id: string;
  chunk_data: string;
  sequence: number;
  created_at: string;
}

export class LiveAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private currentSessionId: string | null = null;
  private chunkSequence: number = 0;
  private isRecording: boolean = false;
  private playbackQueue: AudioChunk[] = [];
  private isPlaying: boolean = false;
  private streamSource: MediaStreamAudioSourceNode | null = null;

  async startBroadcast(broadcasterName: string): Promise<string | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.rpc('cleanup_old_audio_chunks');

      const { data: session, error } = await supabase
        .from('live_audio_sessions')
        .insert({
          broadcaster_id: user.id,
          broadcaster_name: broadcasterName,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      if (!session) throw new Error('Failed to create session');

      this.currentSessionId = session.id;
      this.chunkSequence = 0;
      this.isRecording = true;

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.currentSessionId && this.isRecording) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];

            try {
              await supabase
                .from('audio_announcement_chunks')
                .insert({
                  session_id: this.currentSessionId,
                  chunk_data: base64Data,
                  sequence: this.chunkSequence++
                });
            } catch (error) {
              console.error('Failed to send audio chunk:', error);
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      this.mediaRecorder.start(500);

      return session.id;
    } catch (error) {
      console.error('Failed to start broadcast:', error);
      return null;
    }
  }

  async stopBroadcast(): Promise<void> {
    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    if (this.currentSessionId) {
      await supabase
        .from('live_audio_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', this.currentSessionId);
    }

    this.currentSessionId = null;
    this.mediaRecorder = null;
    this.chunkSequence = 0;
  }

  async getActiveSession(): Promise<AudioSession | null> {
    const { data, error } = await supabase
      .from('live_audio_sessions')
      .select('*')
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as AudioSession;
  }

  setupRealtimeListener(onSessionStart: (session: AudioSession) => void, onSessionEnd: () => void): () => void {
    const sessionChannel = supabase
      .channel('audio-sessions-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_audio_sessions' },
        async (payload) => {
          const session = payload.new as AudioSession;
          if (session.is_active) {
            await audioService.playSound('alert-warning', 90);
            onSessionStart(session);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_audio_sessions' },
        (payload) => {
          const session = payload.new as AudioSession;
          if (!session.is_active) {
            onSessionEnd();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }

  async startPlayback(sessionId: string): Promise<void> {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playbackQueue = [];

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const chunksChannel = supabase
      .channel(`audio-chunks-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audio_announcement_chunks',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          const chunk = payload.new as AudioChunk;
          await this.playChunk(chunk);
        }
      )
      .subscribe();

    const { data: existingChunks } = await supabase
      .from('audio_announcement_chunks')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence', { ascending: true });

    if (existingChunks) {
      for (const chunk of existingChunks) {
        await this.playChunk(chunk as AudioChunk);
      }
    }

    const checkInterval = setInterval(async () => {
      const session = await this.getActiveSession();
      if (!session || session.id !== sessionId) {
        this.stopPlayback();
        clearInterval(checkInterval);
        supabase.removeChannel(chunksChannel);
      }
    }, 2000);
  }

  private async playChunk(chunk: AudioChunk): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const binaryString = atob(chunk.chunk_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBlob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
      const arrayBuffer = await audioBlob.arrayBuffer();

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
    }
  }

  stopPlayback(): void {
    this.isPlaying = false;
    this.playbackQueue = [];

    if (this.streamSource) {
      this.streamSource.disconnect();
      this.streamSource = null;
    }
  }

  isBroadcasting(): boolean {
    return this.isRecording;
  }

  isListening(): boolean {
    return this.isPlaying;
  }
}

export const liveAudioService = new LiveAudioService();
