export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SchoolRole = 'admin' | 'user'

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          address: string | null
          city: string | null
          phone: string | null
          email: string | null
          description: string | null
          default_calendar_view: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          address?: string | null
          city?: string | null
          phone?: string | null
          email?: string | null
          description?: string | null
          default_calendar_view?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          address?: string | null
          city?: string | null
          phone?: string | null
          email?: string | null
          description?: string | null
          default_calendar_view?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          id: string
          school_id: string | null
          template: string
          to_email: string
          subject: string
          status: 'sent' | 'failed'
          provider_id: string | null
          error: string | null
          created_by: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      platform_admins: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_members: {
        Row: {
          id: string
          school_id: string
          user_id: string
          role: SchoolRole
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          user_id: string
          role?: SchoolRole
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          user_id?: string
          role?: SchoolRole
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_school: {
        Args: {
          p_name: string
          p_slug: string
        }
        Returns: Database['public']['Tables']['schools']['Row']
      }
      is_ceo: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      school_role: SchoolRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type School = Database['public']['Tables']['schools']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type SchoolMember = Database['public']['Tables']['school_members']['Row']
