import { supabase } from '../lib/supabase';

export type DeviationType = 'missing_from_booking' | 'damaged' | 'wrong_quantity' | 'incorrect_location' | 'other';
export type DeviationStatus = 'open' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
export type DeviationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface PackageDeviation {
  id: string;
  package_id: string | null;
  shipment_id: string;
  deviation_type: DeviationType;
  description: string;
  status: DeviationStatus;
  priority: DeviationPriority;
  reported_by: string | null;
  assigned_to: string | null;
  resolved_by: string | null;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface DeviationHistoryEntry {
  id: string;
  deviation_id: string;
  action_type: string;
  action_by: string | null;
  previous_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  comment: string;
  created_at: string;
}

export interface DeviationSummary {
  id: string;
  package_sscc: string;
  shipment_title: string;
  shipment_id: string;
  deviation_type: DeviationType;
  description: string;
  status: DeviationStatus;
  priority: DeviationPriority;
  reported_by_name: string | null;
  assigned_to_name: string | null;
  resolved_by_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  packages_in_shipment: number;
}

export interface DeviationDetails {
  deviation: PackageDeviation;
  package: {
    id: string;
    sscc_number: string;
    storage_location: string;
    status: string;
  } | null;
  shipment: {
    id: string;
    title: string;
    car_reg_no: string;
    assigned_operators: string[];
    created_at: string;
    completed_at: string | null;
  };
  all_packages_in_shipment: Array<{
    id: string;
    sscc_number: string;
    storage_location: string;
    status: string;
    has_deviation: boolean;
  }>;
  history: DeviationHistoryEntry[];
  reported_by_user: {
    full_name: string;
    email: string;
  } | null;
  assigned_to_user: {
    full_name: string;
    email: string;
  } | null;
  resolved_by_user: {
    full_name: string;
    email: string;
  } | null;
}

class DeviationService {
  async createDeviation(data: {
    package_id: string | null;
    shipment_id: string;
    deviation_type: DeviationType;
    description: string;
    priority?: DeviationPriority;
  }): Promise<{ success: boolean; deviation?: PackageDeviation; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data: deviation, error } = await supabase
        .from('package_deviations')
        .insert({
          package_id: data.package_id,
          shipment_id: data.shipment_id,
          deviation_type: data.deviation_type,
          description: data.description,
          priority: data.priority || 'medium',
          reported_by: user.id,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('deviation_history')
        .insert({
          deviation_id: deviation.id,
          action_type: 'created',
          action_by: user.id,
          new_value: { deviation_type: data.deviation_type, priority: data.priority || 'medium' },
          comment: 'Deviation reported'
        });

      if (data.package_id) {
        await supabase
          .from('packages')
          .update({
            has_deviation: true,
            deviation_notes: data.description.substring(0, 200)
          })
          .eq('id', data.package_id);
      }

      return { success: true, deviation };
    } catch (error) {
      console.error('Error creating deviation:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async getDeviations(filters?: {
    status?: DeviationStatus;
    priority?: DeviationPriority;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; deviations?: DeviationSummary[]; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_deviations_summary', {
        p_status: filters?.status || null,
        p_priority: filters?.priority || null,
        p_limit: filters?.limit || 100,
        p_offset: filters?.offset || 0
      });

      if (error) throw error;

      return { success: true, deviations: data };
    } catch (error) {
      console.error('Error fetching deviations:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async getDeviationDetails(deviationId: string): Promise<{ success: boolean; details?: DeviationDetails; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_deviation_details', {
        p_deviation_id: deviationId
      });

      if (error) throw error;

      return { success: true, details: data };
    } catch (error) {
      console.error('Error fetching deviation details:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async updateDeviationStatus(
    deviationId: string,
    status: DeviationStatus,
    resolutionNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const updateData: Record<string, unknown> = { status };

      if (status === 'resolved' && resolutionNotes) {
        updateData.resolution_notes = resolutionNotes;
        updateData.resolved_by = user.id;
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('package_deviations')
        .update(updateData)
        .eq('id', deviationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating deviation status:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async updateDeviationPriority(
    deviationId: string,
    priority: DeviationPriority
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('package_deviations')
        .update({ priority })
        .eq('id', deviationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating deviation priority:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async assignDeviation(
    deviationId: string,
    assignedToUserId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('package_deviations')
        .update({ assigned_to: assignedToUserId })
        .eq('id', deviationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error assigning deviation:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async addComment(
    deviationId: string,
    comment: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('deviation_history')
        .insert({
          deviation_id: deviationId,
          action_type: 'commented',
          action_by: user.id,
          comment
        });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error adding comment:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async getDeviationStats(): Promise<{
    success: boolean;
    stats?: {
      total: number;
      open: number;
      in_progress: number;
      resolved: number;
      escalated: number;
      by_priority: Record<DeviationPriority, number>;
      by_type: Record<DeviationType, number>;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('package_deviations')
        .select('status, priority, deviation_type');

      if (error) throw error;

      const stats = {
        total: data.length,
        open: data.filter(d => d.status === 'open').length,
        in_progress: data.filter(d => d.status === 'in_progress').length,
        resolved: data.filter(d => d.status === 'resolved').length,
        escalated: data.filter(d => d.status === 'escalated').length,
        by_priority: {
          low: data.filter(d => d.priority === 'low').length,
          medium: data.filter(d => d.priority === 'medium').length,
          high: data.filter(d => d.priority === 'high').length,
          urgent: data.filter(d => d.priority === 'urgent').length,
        } as Record<DeviationPriority, number>,
        by_type: {
          missing_from_booking: data.filter(d => d.deviation_type === 'missing_from_booking').length,
          damaged: data.filter(d => d.deviation_type === 'damaged').length,
          wrong_quantity: data.filter(d => d.deviation_type === 'wrong_quantity').length,
          incorrect_location: data.filter(d => d.deviation_type === 'incorrect_location').length,
          other: data.filter(d => d.deviation_type === 'other').length,
        } as Record<DeviationType, number>,
      };

      return { success: true, stats };
    } catch (error) {
      console.error('Error fetching deviation stats:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  subscribeToDeviations(callback: (deviation: PackageDeviation) => void) {
    const subscription = supabase
      .channel('deviations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'package_deviations'
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as PackageDeviation);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

export const deviationService = new DeviationService();
