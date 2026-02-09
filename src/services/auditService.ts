import { supabase } from '../lib/supabase';

export type AuditActionType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'completed'
  | 'deleted'
  | 'archived'
  | 'operator_assigned'
  | 'operator_removed';

export interface AuditLogEntry {
  id: string;
  shipment_id: string;
  action_type: AuditActionType;
  action_by: string | null;
  action_by_email?: string;
  action_timestamp: string;
  previous_data: any;
  new_data: any;
  changes_summary: string | null;
  shipment_title?: string;
  shipment_row_id?: number;
}

export class AuditService {
  async logShipmentChange(
    shipmentId: string,
    actionType: AuditActionType,
    actionBy: string | null,
    previousData: any = null,
    newData: any = null,
    changesSummary: string | null = null
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('shipment_audit_log')
        .insert({
          shipment_id: shipmentId,
          action_type: actionType,
          action_by: actionBy,
          previous_data: previousData,
          new_data: newData,
          changes_summary: changesSummary
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error logging audit entry:', error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.error('Failed to create audit log:', err);
      return null;
    }
  }

  async logShipmentCreation(
    shipmentId: string,
    userId: string | null,
    shipmentData: any
  ): Promise<void> {
    await this.logShipmentChange(
      shipmentId,
      'created',
      userId,
      null,
      shipmentData,
      `Shipment "${shipmentData.title}" created`
    );
  }

  async logShipmentUpdate(
    shipmentId: string,
    userId: string | null,
    previousData: any,
    newData: any,
    changes: string[]
  ): Promise<void> {
    const changesSummary = changes.length > 0
      ? `Updated: ${changes.join(', ')}`
      : 'Shipment updated';

    await this.logShipmentChange(
      shipmentId,
      'updated',
      userId,
      previousData,
      newData,
      changesSummary
    );
  }

  async logStatusChange(
    shipmentId: string,
    userId: string | null,
    previousStatus: string,
    newStatus: string,
    shipmentTitle: string
  ): Promise<void> {
    await this.logShipmentChange(
      shipmentId,
      'status_changed',
      userId,
      { status: previousStatus },
      { status: newStatus },
      `Status changed from "${previousStatus}" to "${newStatus}" for "${shipmentTitle}"`
    );
  }

  async logShipmentCompletion(
    shipmentId: string,
    userId: string | null,
    shipmentData: any
  ): Promise<void> {
    await this.logShipmentChange(
      shipmentId,
      'completed',
      userId,
      { status: shipmentData.previous_status },
      { status: 'completed', ...shipmentData },
      `Shipment "${shipmentData.title}" completed`
    );
  }

  async logOperatorAssignment(
    shipmentId: string,
    userId: string | null,
    operatorName: string,
    shipmentTitle: string
  ): Promise<void> {
    await this.logShipmentChange(
      shipmentId,
      'operator_assigned',
      userId,
      null,
      { operator: operatorName },
      `Operator "${operatorName}" assigned to "${shipmentTitle}"`
    );
  }

  async logOperatorRemoval(
    shipmentId: string,
    userId: string | null,
    operatorName: string,
    shipmentTitle: string
  ): Promise<void> {
    await this.logShipmentChange(
      shipmentId,
      'operator_removed',
      userId,
      { operator: operatorName },
      null,
      `Operator "${operatorName}" removed from "${shipmentTitle}"`
    );
  }

  async getShipmentHistory(shipmentId: string): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('shipment_audit_log_with_users')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('action_timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching audit history:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Failed to fetch audit history:', err);
      return [];
    }
  }

  async getRecentActivity(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('shipment_audit_log_with_users')
        .select('*')
        .order('action_timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent activity:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
      return [];
    }
  }

  async getUserActivity(userId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('shipment_audit_log_with_users')
        .select('*')
        .eq('action_by', userId)
        .order('action_timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user activity:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Failed to fetch user activity:', err);
      return [];
    }
  }

  generateChangesSummary(previousData: any, newData: any): string[] {
    const changes: string[] = [];

    if (previousData.title !== newData.title) {
      changes.push(`title from "${previousData.title}" to "${newData.title}"`);
    }

    if (previousData.start !== newData.start) {
      changes.push(`start time`);
    }

    if (previousData.car_reg_no !== newData.car_reg_no) {
      changes.push(`car registration`);
    }

    if (previousData.storage_location !== newData.storage_location) {
      changes.push(`storage location`);
    }

    if (previousData.notes !== newData.notes) {
      changes.push(`notes`);
    }

    if (JSON.stringify(previousData.assigned_operators) !== JSON.stringify(newData.assigned_operators)) {
      changes.push(`assigned operators`);
    }

    if (previousData.sscc_numbers !== newData.sscc_numbers) {
      changes.push(`packages`);
    }

    return changes;
  }
}

export const auditService = new AuditService();
