import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Shipment = {
  id: string;
  row_id: number;
  sscc_numbers: string;
  title: string;
  start: string | null;
  car_reg_no: string;
  storage_location: string;
  assigned_operators: string[];
  notes: string;
  status: 'pending' | 'in_progress' | 'completed';
  updated_at: string;
  archived: boolean;
  created_at: string;
};

export type Operator = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export type AppSetting = {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  created_at: string;
};
