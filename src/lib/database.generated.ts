export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      email_log: {
        Row: {
          created_at: string;
          created_by: string | null;
          error: string | null;
          id: string;
          provider_id: string | null;
          school_id: string | null;
          status: string;
          subject: string;
          template: string;
          to_email: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          id?: string;
          provider_id?: string | null;
          school_id?: string | null;
          status: string;
          subject: string;
          template: string;
          to_email: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          id?: string;
          provider_id?: string | null;
          school_id?: string | null;
          status?: string;
          subject?: string;
          template?: string;
          to_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_log_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_members: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["school_role"];
          school_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["school_role"];
          school_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          default_calendar_view: string;
          description: string | null;
          email: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          phone: string | null;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          default_calendar_view?: string;
          description?: string | null;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          default_calendar_view?: string;
          description?: string | null;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      specialties: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          school_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialties_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          active: boolean;
          address: string | null;
          avatar_url: string | null;
          belt: string | null;
          belt_degree: number | null;
          birth_date: string | null;
          created_at: string;
          email: string | null;
          emergency_contact: string | null;
          emergency_phone: string | null;
          enrollment_date: string;
          first_last_name: string;
          first_name: string;
          full_name: string | null;
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          medical_notes: string | null;
          middle_name: string | null;
          notes: string | null;
          phone: string | null;
          rut: string | null;
          school_id: string;
          second_last_name: string | null;
          updated_at: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          address?: string | null;
          avatar_url?: string | null;
          belt?: string | null;
          belt_degree?: number | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          enrollment_date?: string;
          first_last_name: string;
          first_name: string;
          full_name?: never;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          medical_notes?: string | null;
          middle_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          rut?: string | null;
          school_id: string;
          second_last_name?: string | null;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          avatar_url?: string | null;
          belt?: string | null;
          belt_degree?: number | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          enrollment_date?: string;
          first_last_name?: string;
          first_name?: string;
          full_name?: never;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          medical_notes?: string | null;
          middle_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          rut?: string | null;
          school_id?: string;
          second_last_name?: string | null;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          active: boolean;
          created_at: string;
          icon: string | null;
          id: string;
          label: string;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          icon?: string | null;
          id?: string;
          label: string;
          school_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          icon?: string | null;
          id?: string;
          label?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_specialties: {
        Row: {
          school_id: string;
          specialty_id: string;
          teacher_id: string;
        };
        ComputedFields: never;
        Insert: {
          school_id: string;
          specialty_id: string;
          teacher_id: string;
        };
        Update: {
          school_id?: string;
          specialty_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_specialties_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_specialties_specialty_id_school_id_fkey";
            columns: ["specialty_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "teacher_specialties_teacher_id_school_id_fkey";
            columns: ["teacher_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      teachers: {
        Row: {
          active: boolean;
          belt: string | null;
          belt_degree: number | null;
          bio: string | null;
          created_at: string;
          email: string | null;
          first_last_name: string;
          first_name: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          rut: string | null;
          school_id: string;
          second_last_name: string | null;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          belt?: string | null;
          belt_degree?: number | null;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          first_last_name: string;
          first_name: string;
          full_name?: never;
          id?: string;
          phone?: string | null;
          rut?: string | null;
          school_id: string;
          second_last_name?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          belt?: string | null;
          belt_degree?: number | null;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          first_last_name?: string;
          first_name?: string;
          full_name?: never;
          id?: string;
          phone?: string | null;
          rut?: string | null;
          school_id?: string;
          second_last_name?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_school: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          address: string | null;
          city: string | null;
          created_at: string;
          default_calendar_view: string;
          description: string | null;
          email: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          phone: string | null;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "schools";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      find_user_id_by_email: { Args: { p_email: string }; Returns: string };
      grant_ceo: { Args: { p_email: string }; Returns: undefined };
      has_school_role: {
        Args: {
          p_roles: Database["public"]["Enums"]["school_role"][];
          p_school_id: string;
        };
        Returns: boolean;
      };
      is_ceo: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_school_member: { Args: { p_school_id: string }; Returns: boolean };
      rut_is_valid: { Args: { p_rut: string }; Returns: boolean };
      set_teacher_specialties: {
        Args: { p_specialty_ids: string[]; p_teacher_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      gender: "masculino" | "femenino" | "otro";
      school_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      gender: ["masculino", "femenino", "otro"],
      school_role: ["admin", "user"],
    },
  },
} as const;
