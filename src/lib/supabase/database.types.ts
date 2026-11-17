
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "absence_types": {
                  Row: {
                    "active": boolean,"counts_as_work": boolean,"created_at": string,"deducts_vacation": boolean,"id": string,"key": string,"label": string,"org_id": string,"requires_approval": boolean,"requires_document": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"counts_as_work"?: boolean,"created_at"?: string,"deducts_vacation"?: boolean,"id"?: string,"key": string,"label": string,"org_id": string,"requires_approval"?: boolean,"requires_document"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"counts_as_work"?: boolean,"created_at"?: string,"deducts_vacation"?: boolean,"id"?: string,"key"?: string,"label"?: string,"org_id"?: string,"requires_approval"?: boolean,"requires_document"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "absence_types_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"absences": {
                  Row: {
                    "attachment_path": string | null,"created_at": string,"end_date": string,"half_day_end": boolean,"half_day_start": boolean,"id": string,"membership_id": string,"note": string | null,"org_id": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"start_date": string,"status": Database["public"]['Enums']["request_status"],"substitute_membership_id": string | null,"type_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_path"?: string | null,"created_at"?: string,"end_date": string,"half_day_end"?: boolean,"half_day_start"?: boolean,"id"?: string,"membership_id": string,"note"?: string | null,"org_id": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["request_status"],"substitute_membership_id"?: string | null,"type_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_path"?: string | null,"created_at"?: string,"end_date"?: string,"half_day_end"?: boolean,"half_day_start"?: boolean,"id"?: string,"membership_id"?: string,"note"?: string | null,"org_id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["request_status"],"substitute_membership_id"?: string | null,"type_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absences_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_substitute_membership_id_fkey"
      columns: ["substitute_membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_type_id_fkey"
      columns: ["type_id"]
isOneToOne: false
      referencedRelation: "absence_types"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_kind": string,"created_at": string,"entity": string,"entity_id": string,"hash": string,"id": number,"new_value": Json | null,"old_value": Json | null,"org_id": string,"prev_hash": string | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_kind": string,"created_at"?: string,"entity": string,"entity_id": string,"hash": string,"id"?: never,"new_value"?: Json | null,"old_value"?: Json | null,"org_id": string,"prev_hash"?: string | null,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_kind"?: string,"created_at"?: string,"entity"?: string,"entity_id"?: string,"hash"?: string,"id"?: never,"new_value"?: Json | null,"old_value"?: Json | null,"org_id"?: string,"prev_hash"?: string | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"compensations": {
                  Row: {
                    "created_at": string,"hourly_wage_cents": number | null,"id": string,"membership_id": string,"monthly_salary_cents": number | null,"org_id": string,"valid_from": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"hourly_wage_cents"?: number | null,"id"?: string,"membership_id": string,"monthly_salary_cents"?: number | null,"org_id": string,"valid_from": string
                  }
                  Update: {
                    "created_at"?: string,"hourly_wage_cents"?: number | null,"id"?: string,"membership_id"?: string,"monthly_salary_cents"?: number | null,"org_id"?: string,"valid_from"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compensations_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compensations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"compliance_violations": {
                  Row: {
                    "acknowledged_at": string | null,"acknowledged_by": string | null,"code": string,"details": NonNullable<Json>,"detected_at": string,"id": string,"law": string | null,"membership_id": string,"message": string,"org_id": string,"severity": Database["public"]['Enums']["violation_severity"],"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"code": string,"details"?: NonNullable<Json>,"detected_at"?: string,"id"?: string,"law"?: string | null,"membership_id": string,"message"?: string,"org_id": string,"severity": Database["public"]['Enums']["violation_severity"],"work_date": string
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"code"?: string,"details"?: NonNullable<Json>,"detected_at"?: string,"id"?: string,"law"?: string | null,"membership_id"?: string,"message"?: string,"org_id"?: string,"severity"?: Database["public"]['Enums']["violation_severity"],"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compliance_violations_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compliance_violations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"correction_requests": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"membership_id": string,"org_id": string,"proposed": NonNullable<Json>,"reason": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["request_status"],"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"membership_id": string,"org_id": string,"proposed": NonNullable<Json>,"reason": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"work_date": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"membership_id"?: string,"org_id"?: string,"proposed"?: NonNullable<Json>,"reason"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "correction_requests_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correction_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"data_requests": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"file_path": string | null,"id": string,"kind": string,"membership_id": string,"org_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"file_path"?: string | null,"id"?: string,"kind": string,"membership_id": string,"org_id": string,"status"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"file_path"?: string | null,"id"?: string,"kind"?: string,"membership_id"?: string,"org_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_requests_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "archived_at": string | null,"category": string,"created_at": string,"id": string,"membership_id": string,"mime_type": string | null,"org_id": string,"retain_until": string | null,"size_bytes": number | null,"storage_path": string,"title": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category": string,"created_at"?: string,"id"?: string,"membership_id": string,"mime_type"?: string | null,"org_id": string,"retain_until"?: string | null,"size_bytes"?: number | null,"storage_path": string,"title": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: string,"created_at"?: string,"id"?: string,"membership_id"?: string,"mime_type"?: string | null,"org_id"?: string,"retain_until"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"title"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"employment_contracts": {
                  Row: {
                    "created_at": string,"daily_targets": NonNullable<Json>,"id": string,"membership_id": string,"org_id": string,"school_days": (number)[],"trust_based_hours": boolean,"type": Database["public"]['Enums']["contract_type"],"updated_at": string,"vacation_days_per_year": number,"valid_from": string,"valid_to": string | null,"weekly_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"daily_targets"?: NonNullable<Json>,"id"?: string,"membership_id": string,"org_id": string,"school_days"?: (number)[],"trust_based_hours"?: boolean,"type": Database["public"]['Enums']["contract_type"],"updated_at"?: string,"vacation_days_per_year"?: number,"valid_from": string,"valid_to"?: string | null,"weekly_minutes": number
                  }
                  Update: {
                    "created_at"?: string,"daily_targets"?: NonNullable<Json>,"id"?: string,"membership_id"?: string,"org_id"?: string,"school_days"?: (number)[],"trust_based_hours"?: boolean,"type"?: Database["public"]['Enums']["contract_type"],"updated_at"?: string,"vacation_days_per_year"?: number,"valid_from"?: string,"valid_to"?: string | null,"weekly_minutes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "employment_contracts_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employment_contracts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"geo_consents": {
                  Row: {
                    "granted_at": string,"id": string,"membership_id": string,"org_id": string,"revoked_at": string | null,"text_version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"id"?: string,"membership_id": string,"org_id": string,"revoked_at"?: string | null,"text_version": string
                  }
                  Update: {
                    "granted_at"?: string,"id"?: string,"membership_id"?: string,"org_id"?: string,"revoked_at"?: string | null,"text_version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "geo_consents_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "geo_consents_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"membership_id": string,"org_id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"membership_id": string,"org_id": string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"membership_id"?: string,"org_id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"created_at": string,"geofence_lat": number | null,"geofence_lng": number | null,"geofence_radius_m": number | null,"id": string,"name": string,"org_id": string,"state": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"created_at"?: string,"geofence_lat"?: number | null,"geofence_lng"?: number | null,"geofence_radius_m"?: number | null,"id"?: string,"name": string,"org_id": string,"state": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"created_at"?: string,"geofence_lat"?: number | null,"geofence_lng"?: number | null,"geofence_radius_m"?: number | null,"id"?: string,"name"?: string,"org_id"?: string,"state"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"member_credentials": {
                  Row: {
                    "membership_id": string,"org_id": string,"personal_qr_secret": string,"pin_hash": string | null,"rfid_uid_hash": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "membership_id": string,"org_id": string,"personal_qr_secret"?: string,"pin_hash"?: string | null,"rfid_uid_hash"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "membership_id"?: string,"org_id"?: string,"personal_qr_secret"?: string,"pin_hash"?: string | null,"rfid_uid_hash"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_credentials_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: true
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_credentials_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "archived_at": string | null,"birth_date": string | null,"created_at": string,"display_name": string,"email": string | null,"employee_no": string | null,"id": string,"location_id": string | null,"maternity_protection": boolean,"org_id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["member_status"],"team_id": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"birth_date"?: string | null,"created_at"?: string,"display_name": string,"email"?: string | null,"employee_no"?: string | null,"id"?: string,"location_id"?: string | null,"maternity_protection"?: boolean,"org_id": string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"team_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"birth_date"?: string | null,"created_at"?: string,"display_name"?: string,"email"?: string | null,"employee_no"?: string | null,"id"?: string,"location_id"?: string | null,"maternity_protection"?: boolean,"org_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"team_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"month_closings": {
                  Row: {
                    "created_at": string,"employee_confirmed_at": string | null,"id": string,"locked_at": string | null,"locked_by": string | null,"membership_id": string,"month": string,"org_id": string,"pdf_path": string | null,"snapshot": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"employee_confirmed_at"?: string | null,"id"?: string,"locked_at"?: string | null,"locked_by"?: string | null,"membership_id": string,"month": string,"org_id": string,"pdf_path"?: string | null,"snapshot"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"employee_confirmed_at"?: string | null,"id"?: string,"locked_at"?: string | null,"locked_by"?: string | null,"membership_id"?: string,"month"?: string,"org_id"?: string,"pdf_path"?: string | null,"snapshot"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "month_closings_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "month_closings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"kind": string,"org_id": string | null,"payload": NonNullable<Json>,"pushed_at": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"org_id"?: string | null,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"org_id"?: string | null,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"default_state": string,"has_works_council": boolean,"id": string,"name": string,"onboarding_completed_at": string | null,"payroll_settings": NonNullable<Json>,"retention_months": number,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_state"?: string,"has_works_council"?: boolean,"id"?: string,"name": string,"onboarding_completed_at"?: string | null,"payroll_settings"?: NonNullable<Json>,"retention_months"?: number,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"default_state"?: string,"has_works_council"?: boolean,"id"?: string,"name"?: string,"onboarding_completed_at"?: string | null,"payroll_settings"?: NonNullable<Json>,"retention_months"?: number,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"full_name": string,"id": string,"locale": string,"theme": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"locale"?: string,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"locale"?: string,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "active": boolean,"cost_center": string | null,"created_at": string,"id": string,"name": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"cost_center"?: string | null,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"cost_center"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rule_sets": {
                  Row: {
                    "created_at": string,"id": string,"org_id": string,"scope": Database["public"]['Enums']["rule_scope"],"scope_id": string,"settings": NonNullable<Json>,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"org_id": string,"scope": Database["public"]['Enums']["rule_scope"],"scope_id": string,"settings"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"org_id"?: string,"scope"?: Database["public"]['Enums']["rule_scope"],"scope_id"?: string,"settings"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rule_sets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"shift_claims": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"membership_id": string,"org_id": string,"shift_id": string,"status": Database["public"]['Enums']["request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"membership_id": string,"org_id": string,"shift_id": string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"membership_id"?: string,"org_id"?: string,"shift_id"?: string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "shift_claims_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_claims_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_claims_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    }
                  ]
                },"shift_swap_requests": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"offered_shift_id": string | null,"org_id": string,"requester_id": string,"shift_id": string,"status": Database["public"]['Enums']["request_status"],"target_accepted_at": string | null,"target_membership_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"offered_shift_id"?: string | null,"org_id": string,"requester_id": string,"shift_id": string,"status"?: Database["public"]['Enums']["request_status"],"target_accepted_at"?: string | null,"target_membership_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"offered_shift_id"?: string | null,"org_id"?: string,"requester_id"?: string,"shift_id"?: string,"status"?: Database["public"]['Enums']["request_status"],"target_accepted_at"?: string | null,"target_membership_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shift_swap_requests_offered_shift_id_fkey"
      columns: ["offered_shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_swap_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_swap_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_swap_requests_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_swap_requests_target_membership_id_fkey"
      columns: ["target_membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"shift_templates": {
                  Row: {
                    "break_minutes": number,"created_at": string,"end_time": string,"id": string,"location_id": string | null,"name": string,"org_id": string,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "break_minutes"?: number,"created_at"?: string,"end_time": string,"id"?: string,"location_id"?: string | null,"name": string,"org_id": string,"start_time": string
                  }
                  Update: {
                    "break_minutes"?: number,"created_at"?: string,"end_time"?: string,"id"?: string,"location_id"?: string | null,"name"?: string,"org_id"?: string,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shift_templates_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_templates_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts": {
                  Row: {
                    "break_minutes": number,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"location_id": string,"membership_id": string | null,"note": string | null,"org_id": string,"position": string | null,"project_id": string | null,"starts_at": string,"status": string,"template_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "break_minutes"?: number,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"location_id": string,"membership_id"?: string | null,"note"?: string | null,"org_id": string,"position"?: string | null,"project_id"?: string | null,"starts_at": string,"status"?: string,"template_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "break_minutes"?: number,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"location_id"?: string,"membership_id"?: string | null,"note"?: string | null,"org_id"?: string,"position"?: string | null,"project_id"?: string | null,"starts_at"?: string,"status"?: string,"template_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "shift_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "created_at": string,"id": string,"lead_membership_id": string | null,"location_id": string | null,"name": string,"org_id": string,"parent_team_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"lead_membership_id"?: string | null,"location_id"?: string | null,"name": string,"org_id": string,"parent_team_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lead_membership_id"?: string | null,"location_id"?: string | null,"name"?: string,"org_id"?: string,"parent_team_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_lead_fk"
      columns: ["lead_membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"terminal_auth_failures": {
                  Row: {
                    "created_at": string,"id": number,"method": string,"terminal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"method": string,"terminal_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"method"?: string,"terminal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "terminal_auth_failures_terminal_id_fkey"
      columns: ["terminal_id"]
isOneToOne: false
      referencedRelation: "terminals"
      referencedColumns: ["id"]
    }
                  ]
                },"terminal_secrets": {
                  Row: {
                    "device_token_hash": string | null,"kiosk_pin_hash": string | null,"paired_at": string | null,"pairing_code_hash": string | null,"pairing_expires_at": string | null,"rotated_at": string,"signing_secret": string,"terminal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device_token_hash"?: string | null,"kiosk_pin_hash"?: string | null,"paired_at"?: string | null,"pairing_code_hash"?: string | null,"pairing_expires_at"?: string | null,"rotated_at"?: string,"signing_secret"?: string,"terminal_id": string
                  }
                  Update: {
                    "device_token_hash"?: string | null,"kiosk_pin_hash"?: string | null,"paired_at"?: string | null,"pairing_code_hash"?: string | null,"pairing_expires_at"?: string | null,"rotated_at"?: string,"signing_secret"?: string,"terminal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "terminal_secrets_terminal_id_fkey"
      columns: ["terminal_id"]
isOneToOne: true
      referencedRelation: "terminals"
      referencedColumns: ["id"]
    }
                  ]
                },"terminals": {
                  Row: {
                    "allowed_methods": (Database["public"]['Enums']["time_event_source"])[],"created_at": string,"id": string,"last_seen_at": string | null,"location_id": string,"name": string,"org_id": string,"revoked_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_methods"?: (Database["public"]['Enums']["time_event_source"])[],"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"location_id": string,"name": string,"org_id": string,"revoked_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "allowed_methods"?: (Database["public"]['Enums']["time_event_source"])[],"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"location_id"?: string,"name"?: string,"org_id"?: string,"revoked_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "terminals_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "terminals_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"time_account_adjustments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"effective_date": string,"id": string,"membership_id": string,"minutes": number,"note": string | null,"org_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"effective_date": string,"id"?: string,"membership_id": string,"minutes": number,"note"?: string | null,"org_id": string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"effective_date"?: string,"id"?: string,"membership_id"?: string,"minutes"?: number,"note"?: string | null,"org_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_account_adjustments_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_account_adjustments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"time_events": {
                  Row: {
                    "created_by": string | null,"geo_accuracy_m": number | null,"geo_lat": number | null,"geo_lng": number | null,"id": string,"kind": Database["public"]['Enums']["time_event_kind"],"membership_id": string,"note": string | null,"occurred_at": string,"org_id": string,"project_id": string | null,"received_at": string,"source": Database["public"]['Enums']["time_event_source"],"supersedes_id": string | null,"terminal_id": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null,"was_offline": boolean,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_by"?: string | null,"geo_accuracy_m"?: number | null,"geo_lat"?: number | null,"geo_lng"?: number | null,"id": string,"kind": Database["public"]['Enums']["time_event_kind"],"membership_id": string,"note"?: string | null,"occurred_at": string,"org_id": string,"project_id"?: string | null,"received_at"?: string,"source": Database["public"]['Enums']["time_event_source"],"supersedes_id"?: string | null,"terminal_id"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null,"was_offline"?: boolean,"work_date": string
                  }
                  Update: {
                    "created_by"?: string | null,"geo_accuracy_m"?: number | null,"geo_lat"?: number | null,"geo_lng"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["time_event_kind"],"membership_id"?: string,"note"?: string | null,"occurred_at"?: string,"org_id"?: string,"project_id"?: string | null,"received_at"?: string,"source"?: Database["public"]['Enums']["time_event_source"],"supersedes_id"?: string | null,"terminal_id"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null,"was_offline"?: boolean,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_events_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_events_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_events_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "time_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_events_terminal_id_fkey"
      columns: ["terminal_id"]
isOneToOne: false
      referencedRelation: "terminals"
      referencedColumns: ["id"]
    }
                  ]
                },"vacation_entitlements": {
                  Row: {
                    "carried_over": number,"carry_over_expires_on": string | null,"days": number,"id": string,"membership_id": string,"org_id": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carried_over"?: number,"carry_over_expires_on"?: string | null,"days": number,"id"?: string,"membership_id": string,"org_id": string,"year": number
                  }
                  Update: {
                    "carried_over"?: number,"carry_over_expires_on"?: string | null,"days"?: number,"id"?: string,"membership_id"?: string,"org_id"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vacation_entitlements_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vacation_entitlements_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"work_days": {
                  Row: {
                    "auto_break_minutes": number,"break_minutes": number,"evaluated_at": string | null,"first_in": string | null,"gross_minutes": number,"last_out": string | null,"membership_id": string,"net_minutes": number,"org_id": string,"recomputed_at": string,"status": string,"surcharges": NonNullable<Json>,"target_minutes": number,"valued_minutes": number,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_break_minutes"?: number,"break_minutes"?: number,"evaluated_at"?: string | null,"first_in"?: string | null,"gross_minutes"?: number,"last_out"?: string | null,"membership_id": string,"net_minutes"?: number,"org_id": string,"recomputed_at"?: string,"status"?: string,"surcharges"?: NonNullable<Json>,"target_minutes"?: number,"valued_minutes"?: number,"work_date": string
                  }
                  Update: {
                    "auto_break_minutes"?: number,"break_minutes"?: number,"evaluated_at"?: string | null,"first_in"?: string | null,"gross_minutes"?: number,"last_out"?: string | null,"membership_id"?: string,"net_minutes"?: number,"org_id"?: string,"recomputed_at"?: string,"status"?: string,"surcharges"?: NonNullable<Json>,"target_minutes"?: number,"valued_minutes"?: number,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_days_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_days_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"admin_correct_day":
{ Args: { "p_add": Json,"p_membership": string,"p_reason": string,"p_void": (string)[],"p_work_date": string }; Returns: number
                           },
"cancel_absence":
{ Args: { "p_absence": string }; Returns: undefined
                           },
"claim_open_shift":
{ Args: { "p_shift": string }; Returns: undefined
                           },
"confirm_month":
{ Args: { "p_membership_id": string,"p_month": string,"p_snapshot": Json }; Returns: undefined
                           },
"create_organization":
{ Args: { "p_display_name": string,"p_location_name": string,"p_name": string,"p_state": unknown }; Returns: string
                           },
"get_invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "display_name": string,"email": string,"is_valid": boolean,"org_name": string
            }[]
                           },
"invite_member":
{ Args: { "p_display_name": string,"p_email"?: string,"p_location_id"?: string,"p_org": string,"p_role"?: Database["public"]['Enums']["member_role"],"p_team_id"?: string }; Returns: {
              "expires_at": string,"membership_id": string,"token": string
            }[]
                           },
"list_colleagues":
{ Args: { "p_org": string }; Returns: {
              "display_name": string,"id": string,"location_id": string,"team_id": string
            }[]
                           },
"lock_months":
{ Args: { "p_items": Json,"p_month": string }; Returns: number
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"member_stamp_state":
{ Args: { "p_membership_id": string }; Returns: string
                           },
"publish_shifts":
{ Args: { "p_from": string,"p_location"?: string,"p_org": string,"p_to": string }; Returns: number
                           },
"reissue_invitation":
{ Args: { "p_membership": string }; Returns: {
              "expires_at": string,"token": string
            }[]
                           },
"request_absence":
{ Args: { "p_attachment"?: string,"p_end": string,"p_half_end"?: boolean,"p_half_start"?: boolean,"p_membership_id": string,"p_note"?: string,"p_start": string,"p_type_key": string }; Returns: {
              "attachment_path": string | null,
"created_at": string,
"end_date": string,
"half_day_end": boolean,
"half_day_start": boolean,
"id": string,
"membership_id": string,
"note": string | null,
"org_id": string,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"start_date": string,
"status": Database["public"]['Enums']["request_status"],
"substitute_membership_id": string | null,
"type_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "absences"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_shift_swap":
{ Args: { "p_shift": string,"p_target": string }; Returns: undefined
                           },
"respond_shift_swap":
{ Args: { "p_accept": boolean,"p_request": string }; Returns: undefined
                           },
"review_absence":
{ Args: { "p_absence": string,"p_approve": boolean,"p_note"?: string }; Returns: undefined
                           },
"review_correction":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_request": string }; Returns: undefined
                           },
"review_shift_claim":
{ Args: { "p_approve": boolean,"p_claim": string }; Returns: undefined
                           },
"review_shift_swap":
{ Args: { "p_approve": boolean,"p_request": string }; Returns: undefined
                           },
"save_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           },
"self_apply_correction":
{ Args: { "p_request": string }; Returns: undefined
                           },
"stamp":
{ Args: { "p_event_id": string,"p_geo_accuracy"?: number,"p_geo_lat"?: number,"p_geo_lng"?: number,"p_kind": Database["public"]['Enums']["time_event_kind"],"p_membership_id": string,"p_note"?: string,"p_occurred_at"?: string,"p_offline"?: boolean,"p_project_id"?: string,"p_source"?: Database["public"]['Enums']["time_event_source"] }; Returns: {
              "created_by": string | null,
"geo_accuracy_m": number | null,
"geo_lat": number | null,
"geo_lng": number | null,
"id": string,
"kind": Database["public"]['Enums']["time_event_kind"],
"membership_id": string,
"note": string | null,
"occurred_at": string,
"org_id": string,
"project_id": string | null,
"received_at": string,
"source": Database["public"]['Enums']["time_event_source"],
"supersedes_id": string | null,
"terminal_id": string | null,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null,
"was_offline": boolean,
"work_date": string
            }
                          SetofOptions: {
        from: "*"
        to: "time_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"terminal_stamp":
{ Args: { "p_event_id": string,"p_kind"?: Database["public"]['Enums']["time_event_kind"],"p_membership_id": string,"p_occurred_at"?: string,"p_offline"?: boolean,"p_source": Database["public"]['Enums']["time_event_source"],"p_terminal_id": string }; Returns: {
              "created_by": string | null,
"geo_accuracy_m": number | null,
"geo_lat": number | null,
"geo_lng": number | null,
"id": string,
"kind": Database["public"]['Enums']["time_event_kind"],
"membership_id": string,
"note": string | null,
"occurred_at": string,
"org_id": string,
"project_id": string | null,
"received_at": string,
"source": Database["public"]['Enums']["time_event_source"],
"supersedes_id": string | null,
"terminal_id": string | null,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null,
"was_offline": boolean,
"work_date": string
            }
                          SetofOptions: {
        from: "*"
        to: "time_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"unlock_month":
{ Args: { "p_membership_id": string,"p_month": string,"p_reason": string }; Returns: undefined
                           },
"verify_audit_chain":
{ Args: { "p_org": string }; Returns: number
                           }
          }
          Enums: {
            "contract_type": "minijob"|"part_time"|"full_time"|"apprentice"|"working_student","member_role": "owner"|"admin"|"team_lead"|"employee","member_status": "invited"|"active"|"archived","request_status": "pending"|"approved"|"rejected"|"cancelled","rule_scope": "org"|"location"|"membership","time_event_kind": "check_in"|"break_start"|"break_end"|"check_out","time_event_source": "app"|"terminal_qr"|"personal_qr"|"pin"|"rfid"|"nfc"|"admin"|"system_auto","violation_severity": "info"|"warning"|"violation"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "contract_type": ["minijob", "part_time", "full_time", "apprentice", "working_student"],"member_role": ["owner", "admin", "team_lead", "employee"],"member_status": ["invited", "active", "archived"],"request_status": ["pending", "approved", "rejected", "cancelled"],"rule_scope": ["org", "location", "membership"],"time_event_kind": ["check_in", "break_start", "break_end", "check_out"],"time_event_source": ["app", "terminal_qr", "personal_qr", "pin", "rfid", "nfc", "admin", "system_auto"],"violation_severity": ["info", "warning", "violation"]
          }
        }
} as const
