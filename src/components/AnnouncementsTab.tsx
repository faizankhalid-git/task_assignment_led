import { useState, useEffect } from 'react';
import { supabase, Announcement } from '../lib/supabase';
import { Plus, Trash2, Bell, Clock, Calendar, AlertCircle, Edit2, X, Palette } from 'lucide-react';

export function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    display_duration: 0,
    start_time: new Date().toISOString().slice(0, 16),
    end_time: '',
    background_color: '#1e293b',
    text_color: '#ffffff',
  });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error loading announcements:', error);
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('No authenticated user found');
        alert('You must be logged in to create announcements');
        return;
      }

      const announcementData = {
        ...formData,
        end_time: formData.end_time || null,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingId);

        if (error) {
          console.error('Error updating announcement:', error);
          alert('Failed to update announcement: ' + error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert([announcementData]);

        if (error) {
          console.error('Error creating announcement:', error);
          alert('Failed to create announcement: ' + error.message);
          return;
        }
      }

      resetForm();
      loadAnnouncements();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      priority: 'medium',
      display_duration: 0,
      start_time: new Date().toISOString().slice(0, 16),
      end_time: '',
      background_color: '#1e293b',
      text_color: '#ffffff',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editAnnouncement = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      display_duration: announcement.display_duration,
      start_time: new Date(announcement.start_time).toISOString().slice(0, 16),
      end_time: announcement.end_time ? new Date(announcement.end_time).toISOString().slice(0, 16) : '',
      background_color: announcement.background_color,
      text_color: announcement.text_color,
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    loadAnnouncements();
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase
      .from('announcements')
      .update({ is_active: !currentActive })
      .eq('id', id);

    loadAnnouncements();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return 'ℹ️';
      case 'low': return '📝';
      default: return 'ℹ️';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isCurrentlyDisplaying = (announcement: Announcement) => {
    const now = new Date();
    const start = new Date(announcement.start_time);
    const end = announcement.end_time ? new Date(announcement.end_time) : null;

    return announcement.is_active &&
           start <= now &&
           (!end || end > now);
  };

  if (loading) {
    return <div className="text-slate-600">Loading announcements...</div>;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Announcements</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Announcement'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? 'Edit Announcement' : 'Create New Announcement'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="e.g., System Maintenance Notice"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  required
                  placeholder="Announcement message..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Priority Level *
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Duration (seconds)
                </label>
                <input
                  type="number"
                  value={formData.display_duration}
                  onChange={(e) => setFormData({ ...formData, display_duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  placeholder="0 = until manually deleted"
                />
                <p className="text-xs text-slate-500 mt-1">0 means display until manually deleted</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Background Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="h-10 w-20 rounded-lg border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                    placeholder="#1e293b"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Text Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="h-10 w-20 rounded-lg border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {editingId ? 'Update Announcement' : 'Create Announcement'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Bell className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500">No announcements yet</p>
            <p className="text-sm text-slate-400 mt-1">Create your first announcement to display on the LED screen</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white rounded-lg shadow-md border-l-4 overflow-hidden ${
                isCurrentlyDisplaying(announcement) ? 'border-green-500' : 'border-slate-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getPriorityIcon(announcement.priority)}</span>
                      <h3 className="text-lg font-semibold text-slate-900">{announcement.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(announcement.priority)}`}>
                        {announcement.priority.toUpperCase()}
                      </span>
                      {isCurrentlyDisplaying(announcement) && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          LIVE
                        </span>
                      )}
                    </div>

                    <p className="text-slate-700 mb-3">{announcement.message}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Start: {formatDateTime(announcement.start_time)}</span>
                      </div>
                      {announcement.end_time && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>End: {formatDateTime(announcement.end_time)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {announcement.display_duration === 0
                            ? 'Until deleted'
                            : `${announcement.display_duration}s`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Palette className="w-4 h-4" />
                        <div className="flex gap-1">
                          <div
                            className="w-6 h-6 rounded border border-slate-300"
                            style={{ backgroundColor: announcement.background_color }}
                            title={`Background: ${announcement.background_color}`}
                          />
                          <div
                            className="w-6 h-6 rounded border border-slate-300"
                            style={{ backgroundColor: announcement.text_color }}
                            title={`Text: ${announcement.text_color}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleActive(announcement.id, announcement.is_active)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        announcement.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {announcement.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => editAnnouncement(announcement)}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1 text-sm"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(announcement.id)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-1 text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
