import { useState, useEffect } from 'react';
import { Mic, MicOff, Radio, AlertCircle, Users } from 'lucide-react';
import { liveAudioService } from '../services/liveAudioService';
import { supabase } from '../lib/supabase';

export function LiveAudioTab() {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [broadcasterName, setBroadcasterName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  useEffect(() => {
    loadUserProfile();
    checkMicrophonePermission();
    checkExistingSession();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setBroadcasterName(data.full_name);
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermission(result.state);

      result.onchange = () => {
        setMicPermission(result.state);
      };
    } catch (err) {
      console.log('Permission API not supported, will request on demand');
    }
  };

  const checkExistingSession = async () => {
    const session = await liveAudioService.getActiveSession();
    if (session) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && session.broadcaster_id === user.id) {
        setIsBroadcasting(true);
        setSessionId(session.id);
      }
    }
  };

  const handleStartBroadcast = async () => {
    if (!broadcasterName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newSessionId = await liveAudioService.startBroadcast(broadcasterName);

      if (newSessionId) {
        setIsBroadcasting(true);
        setSessionId(newSessionId);
        setError(null);
      } else {
        setError('Failed to start broadcast. Please check microphone permissions.');
      }
    } catch (err) {
      console.error('Failed to start broadcast:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError('Failed to start broadcast: ' + err.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopBroadcast = async () => {
    setIsLoading(true);

    try {
      await liveAudioService.stopBroadcast();
      setIsBroadcasting(false);
      setSessionId(null);
    } catch (err) {
      console.error('Failed to stop broadcast:', err);
      setError('Failed to stop broadcast');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Live Audio Announcements</h4>
            <p className="text-sm text-blue-800">
              Broadcast live audio announcements to all operators viewing LED displays.
              Your voice will be heard in real-time across all connected displays.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      )}

      {micPermission === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">Microphone Access Required</h4>
              <p className="text-sm text-amber-800">
                Please enable microphone access in your browser settings to use this feature.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        {!isBroadcasting ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Your Name (for display on LED screens)
              </label>
              <input
                type="text"
                value={broadcasterName}
                onChange={(e) => setBroadcasterName(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="Enter your name"
              />
            </div>

            <button
              onClick={handleStartBroadcast}
              disabled={isLoading || !broadcasterName.trim() || micPermission === 'denied'}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              <Mic className="w-6 h-6" />
              {isLoading ? 'Starting...' : 'Start Live Broadcast'}
            </button>

            <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                When you start broadcasting, all operators on LED displays will hear an alert sound
                and then hear your voice in real-time.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-600 rounded-lg p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative">
                  <Radio className="w-12 h-12 text-red-600" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full"></div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-red-900 mb-2">
                LIVE - Broadcasting Now
              </h3>
              <p className="text-red-700 font-medium">
                All operators are listening
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3 text-slate-700">
                <Users className="w-5 h-5" />
                <div>
                  <div className="font-medium">Broadcasting as: {broadcasterName}</div>
                  <div className="text-sm text-slate-600">
                    Session ID: {sessionId?.slice(0, 8)}...
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleStopBroadcast}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              <MicOff className="w-6 h-6" />
              {isLoading ? 'Stopping...' : 'Stop Broadcast'}
            </button>

            <div className="flex items-start gap-2 text-sm text-slate-600 bg-blue-50 p-3 rounded border border-blue-200">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
              <p>
                Speak clearly into your microphone. Your audio is being broadcast to all LED displays in real-time.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <h4 className="font-semibold text-slate-900 mb-3">Tips for Effective Broadcasts</h4>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Speak clearly and at a moderate pace</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Keep announcements brief and to the point</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Use a quiet environment to minimize background noise</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Test your microphone before making important announcements</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
