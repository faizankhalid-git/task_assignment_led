import { supabase } from '../lib/supabase';
import { audioService, SoundType } from './audioNotifications';

export interface NotificationSetting {
  id: string;
  setting_key: string;
  setting_value: {
    enabled: boolean;
    soundType: SoundType;
    volume: number;
    duration?: number;
    template?: string;
  };
  description: string;
  category: string;
}

export class NotificationService {
  private settings: Map<string, NotificationSetting> = new Map();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    await this.loadSettings();
    this.setupRealtimeListeners();
    this.initialized = true;
  }

  private async loadSettings() {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*');

    if (error) {
      console.error('Error loading notification settings:', error);
      return;
    }

    if (data) {
      data.forEach((setting) => {
        this.settings.set(setting.setting_key, setting as NotificationSetting);
      });

      const masterVolume = this.settings.get('master_volume');
      if (masterVolume) {
        audioService.setMasterVolume(masterVolume.setting_value.volume);
      }
    }
  }

  private setupRealtimeListeners() {
    supabase
      .channel('notification_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_settings' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const setting = payload.new as NotificationSetting;
            this.settings.set(setting.setting_key, setting);

            if (setting.setting_key === 'master_volume') {
              audioService.setMasterVolume(setting.setting_value.volume);
            }
          } else if (payload.eventType === 'DELETE') {
            const setting = payload.old as NotificationSetting;
            this.settings.delete(setting.setting_key);
          }
        }
      )
      .subscribe();
  }

  async playNotification(settingKey: string, customVolume?: number) {
    const setting = this.settings.get(settingKey);

    if (!setting || !setting.setting_value.enabled) {
      return;
    }

    const volume = customVolume ?? setting.setting_value.volume;
    await audioService.playSound(setting.setting_value.soundType, volume);
  }

  async notifyOperatorAssigned(operatorId: string, operatorName: string, triggeredBy?: string) {
    await this.playNotification('operator_assigned');

    await supabase
      .from('operator_assignment_history')
      .insert({
        operator_id: operatorId,
        action_type: 'assigned',
        action_details: { operator_name: operatorName },
        triggered_by: triggeredBy,
        notification_sent: true
      });
  }

  async notifyOperatorReassigned(operatorId: string, operatorName: string, details: any, triggeredBy?: string) {
    await this.playNotification('operator_reassigned');

    await supabase
      .from('operator_assignment_history')
      .insert({
        operator_id: operatorId,
        action_type: 'reassigned',
        action_details: { operator_name: operatorName, ...details },
        triggered_by: triggeredBy,
        notification_sent: true
      });
  }

  async notifyOperatorRemoved(operatorId: string, operatorName: string, triggeredBy?: string) {
    await this.playNotification('operator_removed');

    await supabase
      .from('operator_assignment_history')
      .insert({
        operator_id: operatorId,
        action_type: 'removed',
        action_details: { operator_name: operatorName },
        triggered_by: triggeredBy,
        notification_sent: true
      });
  }

  async notifyOperatorCreated(operatorId: string, operatorName: string) {
    const welcomeSetting = this.settings.get('welcome_message_enabled');

    if (welcomeSetting?.setting_value.enabled) {
      const template = welcomeSetting.setting_value.template || 'Welcome {name}! Today is {date}';
      const message = this.formatWelcomeMessage(template, operatorName);

      await supabase
        .from('led_welcome_messages')
        .insert({
          operator_id: operatorId,
          message_template: message,
          display_duration: welcomeSetting.setting_value.duration || 10,
          displayed: false
        });
    }

    await supabase
      .from('operator_assignment_history')
      .insert({
        operator_id: operatorId,
        action_type: 'created',
        action_details: { operator_name: operatorName },
        notification_sent: true
      });
  }

  private formatWelcomeMessage(template: string, operatorName: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return template
      .replace('{name}', operatorName)
      .replace('{date}', dateStr)
      .replace('{time}', timeStr);
  }

  async notifyAnnouncement(announcementType: 'general' | 'priority' | 'emergency') {
    const settingKey = `announcement_${announcementType}`;
    await this.playNotification(settingKey);
  }

  async updateSetting(settingKey: string, value: Partial<NotificationSetting['setting_value']>) {
    const currentSetting = this.settings.get(settingKey);
    if (!currentSetting) return;

    const updatedValue = {
      ...currentSetting.setting_value,
      ...value
    };

    const { error } = await supabase
      .from('notification_settings')
      .update({
        setting_value: updatedValue,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', settingKey);

    if (error) {
      console.error('Error updating notification setting:', error);
    }
  }

  getSetting(settingKey: string): NotificationSetting | undefined {
    return this.settings.get(settingKey);
  }

  getAllSettings(): NotificationSetting[] {
    return Array.from(this.settings.values());
  }

  getSettingsByCategory(category: string): NotificationSetting[] {
    return Array.from(this.settings.values()).filter(
      setting => setting.category === category
    );
  }
}

export const notificationService = new NotificationService();
