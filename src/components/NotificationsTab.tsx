import { useEffect, useState } from 'react';
import { Bell, Volume2, Play, AlertCircle } from 'lucide-react';
import { notificationService, NotificationSetting } from '../services/notificationService';
import { audioService, SoundType } from '../services/audioNotifications';

export function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    await notificationService.initialize();
    setSettings(notificationService.getAllSettings());
    setLoading(false);
  };

  const handleToggleEnabled = async (settingKey: string, enabled: boolean) => {
    setSaving(settingKey);

    const updatedSettings = settings.map(s =>
      s.setting_key === settingKey
        ? { ...s, setting_value: { ...s.setting_value, enabled } }
        : s
    );
    setSettings(updatedSettings);

    try {
      await notificationService.updateSetting(settingKey, { enabled });
      showMessage('success', 'Setting updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update setting');
      await loadSettings();
    }
    setSaving(null);
  };

  const handleVolumeChange = async (settingKey: string, volume: number) => {
    const updatedSettings = settings.map(s =>
      s.setting_key === settingKey
        ? { ...s, setting_value: { ...s.setting_value, volume } }
        : s
    );
    setSettings(updatedSettings);
  };

  const handleVolumeSave = async (settingKey: string, volume: number) => {
    setSaving(settingKey);
    try {
      await notificationService.updateSetting(settingKey, { volume });
      showMessage('success', 'Volume updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update volume');
    }
    setSaving(null);
  };

  const handleSoundTypeChange = async (settingKey: string, soundType: SoundType) => {
    setSaving(settingKey);

    const updatedSettings = settings.map(s =>
      s.setting_key === settingKey
        ? { ...s, setting_value: { ...s.setting_value, soundType } }
        : s
    );
    setSettings(updatedSettings);

    try {
      await notificationService.updateSetting(settingKey, { soundType });
      showMessage('success', 'Sound type updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update sound type');
      await loadSettings();
    }
    setSaving(null);
  };

  const handleTestSound = async (settingKey: string) => {
    const setting = settings.find(s => s.setting_key === settingKey);
    if (!setting) return;

    await audioService.playSound(
      setting.setting_value.soundType,
      setting.setting_value.volume
    );
  };

  const handleUpdateMasterVolume = async (volume: number) => {
    setSaving('master_volume');
    try {
      await notificationService.updateSetting('master_volume', { volume });
      audioService.setMasterVolume(volume);
      setSettings(notificationService.getAllSettings());
      showMessage('success', 'Master volume updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update master volume');
    }
    setSaving(null);
  };

  const handleUpdateWelcomeTemplate = async (template: string) => {
    setSaving('welcome_message_enabled');
    try {
      await notificationService.updateSetting('welcome_message_enabled', { template });
      setSettings(notificationService.getAllSettings());
      showMessage('success', 'Welcome message template updated');
    } catch (error) {
      showMessage('error', 'Failed to update template');
    }
    setSaving(null);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getCategorySettings = (category: string) => {
    return settings.filter(s => s.category === category);
  };

  const renderSettingCard = (setting: NotificationSetting) => {
    if (setting.setting_key === 'master_volume') {
      return (
        <div key={setting.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Volume2 className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-slate-800">Master Volume</h3>
                <p className="text-sm text-slate-600">Global volume control for all sounds</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={setting.setting_value.volume}
              onChange={(e) => handleVolumeChange(setting.setting_key, parseInt(e.target.value))}
              onMouseUp={(e) => handleVolumeSave(setting.setting_key, parseInt((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => handleVolumeSave(setting.setting_key, parseInt((e.target as HTMLInputElement).value))}
              className="flex-1"
            />
            <span className="text-sm font-medium text-slate-700 w-12 text-right">
              {setting.setting_value.volume}%
            </span>
          </div>
        </div>
      );
    }

    if (setting.setting_key === 'welcome_message_enabled') {
      return (
        <div key={setting.id} className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-slate-600" />
              <div>
                <h3 className="font-semibold text-slate-800">{setting.description}</h3>
                <p className="text-sm text-slate-500">Display welcome message on LED screen for new operators</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleEnabled(setting.setting_key, !setting.setting_value.enabled)}
              disabled={saving === setting.setting_key}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                setting.setting_value.enabled
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              } disabled:opacity-50`}
            >
              {setting.setting_value.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {setting.setting_value.enabled && (
            <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Message Template
                </label>
                <input
                  type="text"
                  value={setting.setting_value.template || ''}
                  onChange={(e) => {
                    const updated = settings.map(s =>
                      s.setting_key === setting.setting_key
                        ? { ...s, setting_value: { ...s.setting_value, template: e.target.value } }
                        : s
                    );
                    setSettings(updated);
                  }}
                  onBlur={(e) => handleUpdateWelcomeTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Welcome {name}! Today is {date}"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Available variables: {'{name}'}, {'{date}'}, {'{time}'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Duration (seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={setting.setting_value.duration || 10}
                  onChange={(e) => {
                    const duration = parseInt(e.target.value);
                    if (duration >= 1 && duration <= 60) {
                      notificationService.updateSetting(setting.setting_key, { duration });
                    }
                  }}
                  className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={setting.id} className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-slate-600" />
            <div>
              <h3 className="font-semibold text-slate-800">{setting.description}</h3>
            </div>
          </div>
          <button
            onClick={() => handleToggleEnabled(setting.setting_key, !setting.setting_value.enabled)}
            disabled={saving === setting.setting_key}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              setting.setting_value.enabled
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            } disabled:opacity-50`}
          >
            {setting.setting_value.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {setting.setting_value.enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sound Type
              </label>
              <select
                value={setting.setting_value.soundType}
                onChange={(e) => handleSoundTypeChange(setting.setting_key, e.target.value as SoundType)}
                disabled={saving === setting.setting_key}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                {audioService.getAllSoundTypes().map((type) => (
                  <option key={type} value={type}>
                    {audioService.getSoundDisplayName(type)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Volume</label>
                <span className="text-sm text-slate-600">{setting.setting_value.volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={setting.setting_value.volume}
                onChange={(e) => handleVolumeChange(setting.setting_key, parseInt(e.target.value))}
                onMouseUp={(e) => handleVolumeSave(setting.setting_key, parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleVolumeSave(setting.setting_key, parseInt((e.target as HTMLInputElement).value))}
                className="w-full"
              />
            </div>

            <button
              onClick={() => handleTestSound(setting.setting_key)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Play className="w-4 h-4" />
              Test Sound
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const operatorSettings = getCategorySettings('operator');
  const announcementSettings = getCategorySettings('announcement');
  const systemSettings = getCategorySettings('system');

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">About Notification Sounds</h4>
            <p className="text-sm text-blue-800">
              Configure audio alerts for various events. Each notification can have its own sound type and volume level.
              The master volume controls the overall loudness of all sounds.
            </p>
          </div>
        </div>
      </div>

      {systemSettings.map(setting => renderSettingCard(setting))}

      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Operator Notifications
        </h2>
        <div className="space-y-4">
          {operatorSettings.map(setting => renderSettingCard(setting))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Announcement Notifications
        </h2>
        <div className="space-y-4">
          {announcementSettings.map(setting => renderSettingCard(setting))}
        </div>
      </div>
    </div>
  );
}
