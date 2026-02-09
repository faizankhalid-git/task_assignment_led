import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShipmentsTab } from './ShipmentsTab';
import { OperatorsTab } from './OperatorsTab';
import { SettingsTab } from './SettingsTab';
import { UsersTab, type Permission } from './UsersTab';
import { AnnouncementsTab } from './AnnouncementsTab';
import { NotificationsTab } from './NotificationsTab';
import { LiveAudioTab } from './LiveAudioTab';
import { BackupRestoreTab } from './BackupRestoreTab';
import { AuditLogTab } from './AuditLogTab';
import { Package, Users, Settings, LogOut, Monitor, Shield, UserCog, Bell, Volume2, Radio, Database, History } from 'lucide-react';

type Tab = 'shipments' | 'operators' | 'announcements' | 'live_audio' | 'notifications' | 'settings' | 'users' | 'backup' | 'audit';

type UserProfile = {
  role: 'super_admin' | 'admin' | 'operator';
  full_name: string;
  email: string;
  permissions: Permission[];
};

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('shipments');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role, full_name, email, permissions')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setUserProfile(data);
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const hasPermission = (permission: Permission) => {
    return userProfile?.permissions?.includes(permission) || false;
  };

  const availableTabs = [
    { id: 'shipments' as Tab, label: 'Shipments', icon: Package, permission: 'shipments' as Permission },
    { id: 'operators' as Tab, label: 'Operators', icon: Users, permission: 'operators' as Permission },
    { id: 'announcements' as Tab, label: 'Announcements', icon: Bell, permission: 'announcements' as Permission },
    { id: 'live_audio' as Tab, label: 'Live Audio', icon: Radio, permission: 'live_audio' as Permission },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Volume2, permission: 'notifications' as Permission },
    { id: 'audit' as Tab, label: 'Audit Log', icon: History, permission: 'shipments' as Permission },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings, permission: 'settings' as Permission },
    { id: 'users' as Tab, label: 'Users', icon: UserCog, permission: 'users' as Permission },
    { id: 'backup' as Tab, label: 'Backup & Restore', icon: Database, permission: 'settings' as Permission },
  ];

  const tabs = availableTabs.filter(tab => hasPermission(tab.permission));

  useEffect(() => {
    if (userProfile) {
      if (tabs.length === 0) {
        if (hasPermission('led_display')) {
          window.location.href = '/led';
        }
      } else {
        const currentTabAvailable = tabs.some(tab => tab.id === activeTab);
        if (!currentTabAvailable) {
          setActiveTab(tabs[0].id);
        }
      }
    }
  }, [userProfile, tabs.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Shipment Manager</h1>
                <p className="text-sm text-slate-500">Admin Panel</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {userProfile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  {userProfile.role === 'super_admin' && (
                    <Shield className="w-4 h-4 text-purple-600" />
                  )}
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900">
                      {userProfile.full_name || userProfile.email}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">
                      {userProfile.role.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              )}
              {hasPermission('led_display') && (
                <a
                  href="/led"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  Open LED Display
                </a>
              )}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tabs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <div className="text-slate-400 mb-4">
              <Shield className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Access</h2>
            <p className="text-slate-600">You don't have permission to access any admin features.</p>
            {hasPermission('led_display') && (
              <p className="text-slate-500 mt-4">Redirecting to LED Display...</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="border-b border-slate-200">
              <nav className="flex gap-1 p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'shipments' && hasPermission('shipments') && <ShipmentsTab />}
              {activeTab === 'operators' && hasPermission('operators') && <OperatorsTab />}
              {activeTab === 'announcements' && hasPermission('announcements') && <AnnouncementsTab />}
              {activeTab === 'live_audio' && hasPermission('live_audio') && <LiveAudioTab />}
              {activeTab === 'notifications' && hasPermission('notifications') && <NotificationsTab />}
              {activeTab === 'audit' && hasPermission('shipments') && <AuditLogTab />}
              {activeTab === 'settings' && hasPermission('settings') && <SettingsTab />}
              {activeTab === 'users' && hasPermission('users') && <UsersTab />}
              {activeTab === 'backup' && hasPermission('settings') && <BackupRestoreTab />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
