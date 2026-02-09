import { useState, useEffect, useRef } from 'react';
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
import { KPIDashboard } from './KPIDashboard';
import {
  Package, Users, Settings, LogOut, Monitor, Shield, UserCog, Bell,
  Volume2, Radio, Database, History, TrendingUp, ChevronDown,
  BarChart3, MessageSquare, Cog, LucideIcon
} from 'lucide-react';

type Tab = 'shipments' | 'operators' | 'announcements' | 'live_audio' | 'notifications' | 'audit' | 'kpi' | 'settings' | 'users' | 'backup';

type UserProfile = {
  role: 'super_admin' | 'admin' | 'operator';
  full_name: string;
  email: string;
  permissions: Permission[];
};

type MenuItem = {
  id: Tab;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  description?: string;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: MenuItem[];
  directTab?: Tab;
};

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('shipments');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUserProfile();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/';
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name, permissions')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setUserProfile({
        ...profile,
        email: user.email || ''
      });
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const hasPermission = (permission: Permission) => {
    return userProfile?.permissions?.includes(permission) || false;
  };

  const navGroups: NavGroup[] = [
    {
      id: 'operations',
      label: 'Operations',
      icon: BarChart3,
      items: [
        {
          id: 'shipments',
          label: 'Shipments',
          icon: Package,
          permission: 'shipments',
          description: 'Manage deliveries and shipments'
        },
        {
          id: 'operators',
          label: 'Operators',
          icon: Users,
          permission: 'operators',
          description: 'Manage warehouse operators'
        },
        {
          id: 'kpi',
          label: 'Performance KPIs',
          icon: TrendingUp,
          permission: 'kpi',
          description: 'View performance metrics (Super Admin only)'
        },
      ]
    },
    {
      id: 'communications',
      label: 'Communications',
      icon: MessageSquare,
      items: [
        {
          id: 'announcements',
          label: 'Announcements',
          icon: Bell,
          permission: 'announcements',
          description: 'Broadcast messages to operators'
        },
        {
          id: 'live_audio',
          label: 'Live Audio',
          icon: Radio,
          permission: 'live_audio',
          description: 'Real-time audio announcements'
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Volume2,
          permission: 'notifications',
          description: 'Configure notification settings'
        },
      ]
    },
    {
      id: 'system',
      label: 'System',
      icon: Cog,
      items: [
        {
          id: 'audit',
          label: 'Audit Log',
          icon: History,
          permission: 'shipments',
          description: 'View system activity logs'
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          permission: 'settings',
          description: 'Application configuration'
        },
        {
          id: 'backup',
          label: 'Backup & Restore',
          icon: Database,
          permission: 'settings',
          description: 'Data backup and recovery'
        },
      ]
    },
    {
      id: 'users',
      label: 'Users',
      icon: UserCog,
      directTab: 'users',
      items: [
        {
          id: 'users',
          label: 'User Management',
          icon: UserCog,
          permission: 'users',
          description: 'Manage users and permissions'
        },
      ]
    },
  ];

  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasPermission(item.permission))
  })).filter(group => group.items.length > 0);

  const allAvailableTabs = filteredNavGroups.flatMap(group => group.items);

  useEffect(() => {
    if (userProfile) {
      if (allAvailableTabs.length === 0) {
        if (hasPermission('led_display')) {
          window.location.href = '/led';
        }
      } else {
        const currentTabAvailable = allAvailableTabs.some(tab => tab.id === activeTab);
        if (!currentTabAvailable) {
          setActiveTab(allAvailableTabs[0].id);
        }
      }
    }
  }, [userProfile, allAvailableTabs.length]);

  const handleTabClick = (tabId: Tab) => {
    setActiveTab(tabId);
    setOpenDropdown(null);
  };

  const toggleDropdown = (groupId: string, directTab?: Tab) => {
    if (directTab) {
      handleTabClick(directTab);
    } else {
      setOpenDropdown(openDropdown === groupId ? null : groupId);
    }
  };

  const getActiveGroup = () => {
    return filteredNavGroups.find(group =>
      group.items.some(item => item.id === activeTab)
    );
  };

  const activeGroup = getActiveGroup();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2.5 rounded-lg shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">Shipment Manager</h1>
                  <p className="text-xs text-slate-500">Admin Dashboard</p>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 mx-2" />

              <nav className="flex items-center gap-1" ref={dropdownRef}>
                {filteredNavGroups.map((group) => {
                  const GroupIcon = group.icon;
                  const isActive = group.id === activeGroup?.id;
                  const isSingleItem = group.items.length === 1;

                  return (
                    <div key={group.id} className="relative">
                      <button
                        onClick={() => toggleDropdown(group.id, group.directTab)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <GroupIcon className="w-4 h-4" />
                        <span>{group.label}</span>
                        {!isSingleItem && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${
                              openDropdown === group.id ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </button>

                      {!isSingleItem && openDropdown === group.id && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleTabClick(item.id)}
                                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                                  activeTab === item.id
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <ItemIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{item.label}</div>
                                  {item.description && (
                                    <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {userProfile && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                  {userProfile.role === 'super_admin' && (
                    <Shield className="w-4 h-4 text-purple-600" />
                  )}
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900 leading-tight">
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
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2 text-sm font-medium transition-colors"
                  title="Open LED Display"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden lg:inline">LED Display</span>
                </a>
              )}
              <button
                onClick={handleSignOut}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2 text-sm font-medium transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {allAvailableTabs.length === 0 ? (
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
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6">
              {activeTab === 'shipments' && hasPermission('shipments') && <ShipmentsTab />}
              {activeTab === 'operators' && hasPermission('operators') && <OperatorsTab />}
              {activeTab === 'kpi' && hasPermission('shipments') && <KPIDashboard />}
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
      </main>
    </div>
  );
}
