import { supabase } from '../lib/supabase';

export type IntensityLevel = 'low' | 'medium' | 'high';

export interface OperatorPerformance {
  operator_id: string;
  operator_name: string;
  operator_color: string;
  active: boolean;
  rank: number | null;
  total_completed_tasks: number;
  total_score: number;
  avg_score_per_task: number;
  delivery_tasks?: number;
  delivery_score?: number;
  avg_delivery_score?: number;
  non_delivery_tasks?: number;
  non_delivery_score?: number;
  avg_non_delivery_score?: number;
  high_intensity_count: number;
  medium_intensity_count: number;
  low_intensity_count: number;
  active_days: number;
  first_completion_date: string | null;
  last_completion_date: string | null;
  category_breakdown: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  category: string;
  is_delivery: boolean;
  task_count: number;
  category_score: number;
  avg_intensity_score: number;
  first_completion: string;
  last_completion: string;
}

export interface CategoryStatistics {
  task_category: string;
  total_tasks: number;
  total_score: number;
  unique_operators: number;
  avg_tasks_per_operator: number;
  avg_score_per_task: number;
}

export interface OperatorMissingCategories {
  operator_id: string;
  operator_name: string;
  missing_categories: string[];
  completed_categories: string[];
  missing_count: number;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  active: boolean;
  sort_order: number;
  usage_count: number;
  can_delete: boolean;
}

export interface ShipmentStats {
  total_shipments: number;
  total_operators: number;
  active_operators: number;
  completed_shipments: number;
  total_operator_tasks: number;
  total_points: number;
}

export class KPIService {
  async getAllOperatorPerformance(): Promise<OperatorPerformance[]> {
    console.log('🔄 KPI Service: Fetching all operator performance...');

    const { data, error } = await supabase.rpc('get_operator_performance');

    if (error) {
      console.error('❌ KPI Service: Error fetching operator performance:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('✅ KPI Service: Fetched', data?.length || 0, 'operators');
    return data || [];
  }

  async getOperatorPerformance(operatorId: string): Promise<OperatorPerformance | null> {
    const { data, error } = await supabase
      .rpc('get_operator_performance', { p_operator_id: operatorId });

    if (error) {
      console.error('Error fetching operator performance:', error);
      throw error;
    }

    return data?.[0] || null;
  }

  async getCategoryStatistics(): Promise<CategoryStatistics[]> {
    const { data, error } = await supabase.rpc('get_category_statistics');

    if (error) {
      console.error('Error fetching category statistics:', error);
      throw error;
    }

    return data || [];
  }

  async getOperatorsMissingCategories(): Promise<OperatorMissingCategories[]> {
    const { data, error } = await supabase.rpc('get_operators_missing_categories');

    if (error) {
      console.error('Error fetching missing categories:', error);
      throw error;
    }

    return data || [];
  }

  async refreshPerformanceMetrics(): Promise<void> {
    const { error } = await supabase.rpc('refresh_operator_performance');

    if (error) {
      console.error('Error refreshing performance metrics:', error);
      throw error;
    }
  }

  async getFilteredOperatorPerformance(
    startDate?: string,
    endDate?: string
  ): Promise<OperatorPerformance[]> {
    const { data, error } = await supabase.rpc('get_filtered_operator_performance', {
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching filtered performance:', error);
      throw error;
    }

    return data || [];
  }

  async getShipmentStats(startDate?: string, endDate?: string): Promise<ShipmentStats> {
    const { data, error } = await supabase.rpc('get_total_shipment_stats', {
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching shipment stats:', error);
      throw error;
    }

    return data || {
      total_shipments: 0,
      total_operators: 0,
      active_operators: 0,
      completed_shipments: 0,
      total_operator_tasks: 0,
      total_points: 0
    };
  }

  async getCategoryList(): Promise<TaskCategory[]> {
    const { data, error } = await supabase.rpc('get_category_list');

    if (error) {
      console.error('Error fetching category list:', error);
      throw error;
    }

    return data || [];
  }

  async addCategory(name: string, color?: string, active?: boolean): Promise<string> {
    const { data, error } = await supabase.rpc('add_task_category', {
      p_name: name,
      p_color: color || '#6B7280',
      p_active: active !== undefined ? active : true
    });

    if (error) {
      console.error('Error adding category:', error);
      throw error;
    }

    return data;
  }

  async updateCategory(
    id: string,
    updates: {
      name?: string;
      color?: string;
      active?: boolean;
      sort_order?: number;
    }
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_task_category', {
      p_id: id,
      p_name: updates.name || null,
      p_color: updates.color || null,
      p_active: updates.active !== undefined ? updates.active : null,
      p_sort_order: updates.sort_order !== undefined ? updates.sort_order : null
    });

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }

    return data;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_task_category', {
      p_id: id
    });

    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }

    return data;
  }

  getIntensityPoints(intensity: IntensityLevel): number {
    switch (intensity) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  getIntensityLabel(intensity: IntensityLevel): string {
    switch (intensity) {
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return '';
    }
  }

  getIntensityColor(intensity: IntensityLevel): string {
    switch (intensity) {
      case 'high':
        return 'text-red-700 bg-red-100 border-red-300';
      case 'medium':
        return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'low':
        return 'text-green-700 bg-green-100 border-green-300';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-300';
    }
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'INCOMING': 'bg-blue-500',
      'OUTGOING': 'bg-green-500',
      'OPI': 'bg-purple-500',
      'DELIVERY': 'bg-orange-500',
      'PICKUP': 'bg-cyan-500',
      'WAREHOUSE': 'bg-indigo-500',
      'SORTING': 'bg-pink-500',
      'OTHER': 'bg-slate-400'
    };
    return colors[category] || 'bg-slate-400';
  }

  getCategoryTextColor(category: string): string {
    const colors: Record<string, string> = {
      'INCOMING': 'text-blue-700',
      'OUTGOING': 'text-green-700',
      'OPI': 'text-purple-700',
      'DELIVERY': 'text-orange-700',
      'PICKUP': 'text-cyan-700',
      'WAREHOUSE': 'text-indigo-700',
      'SORTING': 'text-pink-700',
      'OTHER': 'text-slate-700'
    };
    return colors[category] || 'text-slate-700';
  }
}

export const kpiService = new KPIService();
