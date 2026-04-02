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
import { DeviationsTab } from './DeviationsTab';
import { PackageSearch } from './PackageSearch';
import { PackageDetailsModal } from './PackageDetailsModal';
import {
  Package, Users, Settings, LogOut, Monitor, Shield, UserCog, Bell,
  Volume2, Radio, Database, History, TrendingUp, ChevronDown,
  BarChart3, MessageSquare, Cog, AlertTriangle, Search, type LucideIcon
} from 'lucide-react';

type Tab = 'shipments' | 'packages' | 'deviations' | 'operators' | 'announcements' | 'live_audio' | 'notifications' | 'audit' | 'kpi' | 'settings' | 'users' | 'backup';

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
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [quickSearchResults, setQuickSearchResults] = useState<any[]>([]);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [quickSearching, setQuickSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUserProfile();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowQuickSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const channel = supabase
        .channel('user-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            const updatedProfile = payload.new as any;
            setUserProfile({
              role: updatedProfile.role,
              full_name: updatedProfile.full_name,
              permissions: updatedProfile.permissions || [],
              email: userProfile?.email || ''
            });
          }
        )
        .subscribe();

      return channel;
    };

    let channel: any = null;
    setupRealtimeSubscription().then(ch => { channel = ch; });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (channel) channel.unsubscribe();
    };
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

  const handleQuickSearch = async (term: string) => {
    if (!term.trim()) {
      setQuickSearchResults([]);
      return;
    }

    setQuickSearching(true);
    try {
      const { data: packages, error } = await supabase
        .from('packages')
        .select(`
          *,
          shipment:shipments!packages_shipment_id_fkey(
            id,
            title,
            status
          )
        `)
        .ilike('sscc_number', `%${term.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (packages) {
        const packagesWithDeviations = await Promise.all(
          packages.map(async (pkg) => {
            if (pkg.has_deviation) {
              const { data: deviation } = await supabase
                .from('package_deviations')
                .select('id, deviation_type, description, status')
                .eq('package_id', pkg.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              return { ...pkg, deviation };
            }
            return pkg;
          })
        );

        setQuickSearchResults(packagesWithDeviations);
      }
    } catch (error) {
      console.error('Quick search error:', error);
      setQuickSearchResults([]);
    } finally {
      setQuickSearching(false);
    }
  };

  const handleQuickSearchChange = (value: string) => {
    setQuickSearchTerm(value);
    setShowQuickSearch(true);
    handleQuickSearch(value);
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
          id: 'packages',
          label: 'Package Search',
          icon: Search,
          permission: 'shipments',
          description: 'Search and view package details'
        },
        {
          id: 'deviations',
          label: 'Deviations',
          icon: AlertTriangle,
          permission: 'shipments',
          description: 'Track and resolve package discrepancies'
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

  const toggleDropdown = (groupId: string, directTab?: Tab, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleDropdown(group.id, group.directTab, e);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                        type="button"
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
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTabClick(item.id);
                                }}
                                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                                  activeTab === item.id
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                                type="button"
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

            <div className="flex items-center gap-3">
              {hasPermission('shipments') && (
                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={quickSearchTerm}
                      onChange={(e) => handleQuickSearchChange(e.target.value)}
                      onFocus={() => setShowQuickSearch(true)}
                      placeholder="Search packages..."
                      className="w-64 pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>

                  {showQuickSearch && quickSearchTerm && (
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
                      {quickSearching ? (
                        <div className="p-4 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                          <p className="text-xs text-slate-500 mt-2">Searching...</p>
                        </div>
                      ) : quickSearchResults.length === 0 ? (
                        <div className="p-4 text-center">
                          <PackageIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm text-slate-600">No packages found</p>
                          <p className="text-xs text-slate-500 mt-1">Try a different SSCC number</p>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                            <p className="text-xs font-medium text-slate-700">
                              Found {quickSearchResults.length} package{quickSearchResults.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {quickSearchResults.map((pkg) => (
                            <button
                              key={pkg.id}
                              onClick={() => {
                                setSelectedPackage(pkg);
                                setShowQuickSearch(false);
                                setQuickSearchTerm('');
                              }}
                              className="w-full px-3 py-2 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <PackageIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-slate-900 truncate">
                                      {pkg.sscc_number}
                                    </span>
                                    {pkg.has_deviation && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 flex-shrink-0">
                                        Issue
                                      </span>
                                    )}
                                  </div>
                                  {pkg.shipment && (
                                    <p className="text-xs text-slate-600 truncate">
                                      {pkg.shipment.title}
                                    </p>
                                  )}
                                  {pkg.storage_location && (
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                      {pkg.storage_location}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                                    pkg.status === 'stored'
                                      ? 'bg-green-100 text-green-700'
                                      : pkg.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {pkg.status}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
              {activeTab === 'packages' && hasPermission('shipments') && (
                <PackageSearch onSelectPackage={setSelectedPackage} />
              )}
              {activeTab === 'deviations' && hasPermission('shipments') && <DeviationsTab />}
              {activeTab === 'operators' && hasPermission('operators') && <OperatorsTab />}
              {activeTab === 'kpi' && hasPermission('kpi') && <KPIDashboard />}
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

      {selectedPackage && (
        <PackageDetailsModal
          packageData={selectedPackage}
          onClose={() => setSelectedPackage(null)}
        />
      )}
    </div>
  );
}
