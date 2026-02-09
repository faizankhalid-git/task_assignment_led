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

export class KPIService {
  async getAllOperatorPerformance(): Promise<OperatorPerformance[]> {
    const { data, error } = await supabase.rpc('get_operator_performance');

    if (error) {
      console.error('Error fetching operator performance:', error);
      throw error;
    }

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
