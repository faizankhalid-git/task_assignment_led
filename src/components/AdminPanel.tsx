import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShipmentsTab } from './ShipmentsTab';
import { OperatorsTab } from './OperatorsTab';
import { SettingsTab } from './SettingsTab';
import { Package, Users, Settings, LogOut, Monitor } from 'lucide-react';

type Tab = 'shipments' | 'operators' | 'settings';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('shipments');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const tabs = [
    { id: 'shipments' as Tab, label: 'Shipments', icon: Package },
    { id: 'operators' as Tab, label: 'Operators', icon: Users },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

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
              <a
                href="/led"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                Open LED Display
              </a>
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
            {activeTab === 'shipments' && <ShipmentsTab />}
            {activeTab === 'operators' && <OperatorsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
