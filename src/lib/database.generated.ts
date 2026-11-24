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
      account_requests: {
        Row: {
          address: string | null;
          birth_date: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          email: string;
          first_last_name: string;
          first_name: string;
          id: string;
          kind: Database["public"]["Enums"]["request_kind"];
          middle_name: string | null;
          phone: string | null;
          rut: string | null;
          school_id: string;
          second_last_name: string | null;
          status: Database["public"]["Enums"]["request_status"];
          student_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          birth_date?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          email: string;
          first_last_name: string;
          first_name: string;
          id?: string;
          kind: Database["public"]["Enums"]["request_kind"];
          middle_name?: string | null;
          phone?: string | null;
          rut?: string | null;
          school_id: string;
          second_last_name?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          student_id?: string | null;
          user_id: string;
        };
        Update: {
          address?: string | null;
          birth_date?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          email?: string;
          first_last_name?: string;
          first_name?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["request_kind"];
          middle_name?: string | null;
          phone?: string | null;
          rut?: string | null;
          school_id?: string;
          second_last_name?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          student_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_requests_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_requests_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      achievements: {
        Row: {
          art_id: string | null;
          badge_id: string | null;
          belt_id: string | null;
          category: string | null;
          created_at: string;
          created_by: string | null;
          date: string;
          decided_at: string | null;
          decided_by: string | null;
          degree: number | null;
          detail: string | null;
          id: string;
          kind: string;
          medal: string | null;
          reject_reason: string | null;
          school_id: string;
          status: string;
          student_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          art_id?: string | null;
          badge_id?: string | null;
          belt_id?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          degree?: number | null;
          detail?: string | null;
          id?: string;
          kind: string;
          medal?: string | null;
          reject_reason?: string | null;
          school_id: string;
          status?: string;
          student_id: string;
          title: string;
        };
        Update: {
          art_id?: string | null;
          badge_id?: string | null;
          belt_id?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          degree?: number | null;
          detail?: string | null;
          id?: string;
          kind?: string;
          medal?: string | null;
          reject_reason?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievements_art_id_school_id_fkey";
            columns: ["art_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_arts";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "achievements_badge_id_school_id_fkey";
            columns: ["badge_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_badges";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "achievements_belt_id_art_id_fkey";
            columns: ["belt_id", "art_id"];
            isOneToOne: false;
            referencedRelation: "school_belts";
            referencedColumns: ["id", "art_id"];
          },
          {
            foreignKeyName: "achievements_student_id_school_id_fkey";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      art_templates: {
        Row: {
          key: string;
          name: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          name: string;
          position?: number;
        };
        Update: {
          key?: string;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          class_id: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          marked_by: string | null;
          school_id: string;
          self_marked: boolean;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          marked_by?: string | null;
          school_id: string;
          self_marked?: boolean;
          student_id: string;
        };
        Update: {
          class_id?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          marked_by?: string | null;
          school_id?: string;
          self_marked?: boolean;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_school_id_fkey";
            columns: ["class_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "attendance_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_school_id_fkey";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: number;
          school_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: never;
          school_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          school_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      belt_templates: {
        Row: {
          art_key: string;
          color: string;
          degree_name: string;
          id: number;
          max_degree: number;
          name: string;
          position: number;
          rank_label: string | null;
          stripe: string | null;
          track: string;
        };
        ComputedFields: never;
        Insert: {
          art_key: string;
          color: string;
          degree_name?: string;
          id?: number;
          max_degree?: number;
          name: string;
          position: number;
          rank_label?: string | null;
          stripe?: string | null;
          track: string;
        };
        Update: {
          art_key?: string;
          color?: string;
          degree_name?: string;
          id?: number;
          max_degree?: number;
          name?: string;
          position?: number;
          rank_label?: string | null;
          stripe?: string | null;
          track?: string;
        };
        Relationships: [
          {
            foreignKeyName: "belt_templates_art_key_fkey";
            columns: ["art_key"];
            isOneToOne: false;
            referencedRelation: "art_templates";
            referencedColumns: ["key"];
          },
        ];
      };
      child_requests: {
        Row: {
          address: string;
          birth_date: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          email: string;
          first_last_name: string;
          first_name: string;
          guardian_id: string;
          id: string;
          middle_name: string | null;
          reject_reason: string | null;
          rut: string;
          school_id: string;
          second_last_name: string;
          status: Database["public"]["Enums"]["request_status"];
          student_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          birth_date: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          email: string;
          first_last_name: string;
          first_name: string;
          guardian_id: string;
          id?: string;
          middle_name?: string | null;
          reject_reason?: string | null;
          rut: string;
          school_id: string;
          second_last_name: string;
          status?: Database["public"]["Enums"]["request_status"];
          student_id?: string | null;
        };
        Update: {
          address?: string;
          birth_date?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          email?: string;
          first_last_name?: string;
          first_name?: string;
          guardian_id?: string;
          id?: string;
          middle_name?: string | null;
          reject_reason?: string | null;
          rut?: string;
          school_id?: string;
          second_last_name?: string;
          status?: Database["public"]["Enums"]["request_status"];
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "child_requests_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "child_requests_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      class_schedules: {
        Row: {
          class_id: string;
          end_time: string;
          id: string;
          school_id: string;
          start_time: string;
          teacher_id: string | null;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          end_time: string;
          id?: string;
          school_id: string;
          start_time: string;
          teacher_id?: string | null;
          weekday: number;
        };
        Update: {
          class_id?: string;
          end_time?: string;
          id?: string;
          school_id?: string;
          start_time?: string;
          teacher_id?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_school_id_fkey";
            columns: ["class_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "class_schedules_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      class_sessions: {
        Row: {
          class_id: string;
          color: string;
          created_at: string;
          customized: boolean;
          date: string;
          description: string | null;
          end_time: string;
          id: string;
          name: string;
          not_held: boolean;
          number: number | null;
          room: string | null;
          schedule_id: string | null;
          school_id: string;
          skill_ids: string[];
          start_time: string;
          teacher_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          color?: string;
          created_at?: string;
          customized?: boolean;
          date: string;
          description?: string | null;
          end_time: string;
          id?: string;
          name: string;
          not_held?: boolean;
          number?: number | null;
          room?: string | null;
          schedule_id?: string | null;
          school_id: string;
          skill_ids?: string[];
          start_time: string;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          color?: string;
          created_at?: string;
          customized?: boolean;
          date?: string;
          description?: string | null;
          end_time?: string;
          id?: string;
          name?: string;
          not_held?: boolean;
          number?: number | null;
          room?: string | null;
          schedule_id?: string | null;
          school_id?: string;
          skill_ids?: string[];
          start_time?: string;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_school_id_fkey";
            columns: ["class_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "class_sessions_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "class_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      class_tags: {
        Row: {
          class_id: string;
          school_id: string;
          tag_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          school_id: string;
          tag_id: string;
        };
        Update: {
          class_id?: string;
          school_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_tags_class_id_school_id_fkey";
            columns: ["class_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "class_tags_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_tags_tag_id_school_id_fkey";
            columns: ["tag_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      classes: {
        Row: {
          active: boolean;
          capacity: number | null;
          color: string;
          created_at: string;
          description: string | null;
          id: string;
          level: Database["public"]["Enums"]["class_level"];
          name: string;
          notes: string | null;
          room: string | null;
          school_id: string;
          specialty_id: string | null;
          teacher_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          capacity?: number | null;
          color?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          level?: Database["public"]["Enums"]["class_level"];
          name: string;
          notes?: string | null;
          room?: string | null;
          school_id: string;
          specialty_id?: string | null;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          capacity?: number | null;
          color?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          level?: Database["public"]["Enums"]["class_level"];
          name?: string;
          notes?: string | null;
          room?: string | null;
          school_id?: string;
          specialty_id?: string | null;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_specialty_id_school_id_fkey";
            columns: ["specialty_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "classes_teacher_id_school_id_fkey";
            columns: ["teacher_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      discount_codes: {
        Row: {
          active: boolean;
          amount: number | null;
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          max_uses: number | null;
          percent: number | null;
          plan_id: string | null;
          school_id: string;
          scope: Database["public"]["Enums"]["discount_scope"];
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amount?: number | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          max_uses?: number | null;
          percent?: number | null;
          plan_id?: string | null;
          school_id: string;
          scope?: Database["public"]["Enums"]["discount_scope"];
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          active?: boolean;
          amount?: number | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          max_uses?: number | null;
          percent?: number | null;
          plan_id?: string | null;
          school_id?: string;
          scope?: Database["public"]["Enums"]["discount_scope"];
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "discount_codes_plan_id_school_id_fkey";
            columns: ["plan_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "discount_codes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      discount_redemptions: {
        Row: {
          code_id: string;
          created_at: string;
          discount: number;
          enrollment_id: string | null;
          id: string;
          payment_id: string | null;
          redeemed_by: string | null;
          school_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          code_id: string;
          created_at?: string;
          discount?: number;
          enrollment_id?: string | null;
          id?: string;
          payment_id?: string | null;
          redeemed_by?: string | null;
          school_id: string;
          student_id: string;
        };
        Update: {
          code_id?: string;
          created_at?: string;
          discount?: number;
          enrollment_id?: string | null;
          id?: string;
          payment_id?: string | null;
          redeemed_by?: string | null;
          school_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_code_id_school_id_fkey";
            columns: ["code_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "discount_redemptions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_redemptions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_redemptions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_redemptions_student_id_school_id_fkey";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
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
      enrollments: {
        Row: {
          created_at: string;
          created_by: string | null;
          discount_code: string | null;
          discount_code_id: string | null;
          discount_fixed: number | null;
          discount_percent: number | null;
          ends_at: string | null;
          enrollment_fee: number;
          id: string;
          notes: string | null;
          plan_id: string;
          price: number;
          school_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          discount_code?: string | null;
          discount_code_id?: string | null;
          discount_fixed?: number | null;
          discount_percent?: number | null;
          ends_at?: string | null;
          enrollment_fee?: number;
          id?: string;
          notes?: string | null;
          plan_id: string;
          price: number;
          school_id: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          discount_code?: string | null;
          discount_code_id?: string | null;
          discount_fixed?: number | null;
          discount_percent?: number | null;
          ends_at?: string | null;
          enrollment_fee?: number;
          id?: string;
          notes?: string | null;
          plan_id?: string;
          price?: number;
          school_id?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_discount_code_id_fkey";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_plan_id_school_id_fkey";
            columns: ["plan_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "enrollments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_student_id_school_id_fkey";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      owners: {
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
      payment_submissions: {
        Row: {
          amount: number;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          payment_id: string;
          reference: string | null;
          reject_reason: string | null;
          school_id: string;
          status: Database["public"]["Enums"]["request_status"];
          student_id: string;
          submitted_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          payment_id: string;
          reference?: string | null;
          reject_reason?: string | null;
          school_id: string;
          status?: Database["public"]["Enums"]["request_status"];
          student_id: string;
          submitted_by?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          payment_id?: string;
          reference?: string | null;
          reject_reason?: string | null;
          school_id?: string;
          status?: Database["public"]["Enums"]["request_status"];
          student_id?: string;
          submitted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_submissions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_submissions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          concept: string;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          discount_amount: number;
          discount_code: string | null;
          discount_code_id: string | null;
          due_date: string | null;
          enrollment_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          method: Database["public"]["Enums"]["payment_method"];
          notes: string | null;
          paid_at: string | null;
          receipt_path: string | null;
          renews_enrollment: boolean;
          school_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          concept: string;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          discount_amount?: number;
          discount_code?: string | null;
          discount_code_id?: string | null;
          due_date?: string | null;
          enrollment_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          paid_at?: string | null;
          receipt_path?: string | null;
          renews_enrollment?: boolean;
          school_id: string;
          status?: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          concept?: string;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          discount_amount?: number;
          discount_code?: string | null;
          discount_code_id?: string | null;
          due_date?: string | null;
          enrollment_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          paid_at?: string | null;
          receipt_path?: string | null;
          renews_enrollment?: boolean;
          school_id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_discount_code_id_fkey";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_enrollment_id_school_id_fkey";
            columns: ["enrollment_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_student_id_school_id_fkey";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          billing_cycle: Database["public"]["Enums"]["billing_cycle"];
          class_count: number | null;
          created_at: string;
          description: string | null;
          duration_days: number | null;
          enrollment_fee: number;
          id: string;
          is_default: boolean;
          is_trial: boolean;
          name: string;
          price: number;
          school_id: string;
          sessions_per_week: number | null;
          specialty_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          class_count?: number | null;
          created_at?: string;
          description?: string | null;
          duration_days?: number | null;
          enrollment_fee?: number;
          id?: string;
          is_default?: boolean;
          is_trial?: boolean;
          name: string;
          price: number;
          school_id: string;
          sessions_per_week?: number | null;
          specialty_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          class_count?: number | null;
          created_at?: string;
          description?: string | null;
          duration_days?: number | null;
          enrollment_fee?: number;
          id?: string;
          is_default?: boolean;
          is_trial?: boolean;
          name?: string;
          price?: number;
          school_id?: string;
          sessions_per_week?: number | null;
          specialty_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plans_specialty_id_school_id_fkey";
            columns: ["specialty_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id", "school_id"];
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
      platform_operators: {
        Row: {
          created_at: string;
          user_id: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
          username: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      platform_plans: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          max_schools: number | null;
          max_students: number | null;
          name: string;
          period: string;
          price_clp: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          max_schools?: number | null;
          max_students?: number | null;
          name: string;
          period?: string;
          price_clp?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          max_schools?: number | null;
          max_students?: number | null;
          name?: string;
          period?: string;
          price_clp?: number;
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
      rate_limits: {
        Row: {
          bucket: string;
          hits: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          bucket: string;
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          bucket?: string;
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      school_arts: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          position: number;
          school_id: string;
          template_key: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          position?: number;
          school_id: string;
          template_key?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          school_id?: string;
          template_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_arts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_arts_template_key_fkey";
            columns: ["template_key"];
            isOneToOne: false;
            referencedRelation: "art_templates";
            referencedColumns: ["key"];
          },
        ];
      };
      school_badges: {
        Row: {
          active: boolean;
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          school_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_badges_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_belts: {
        Row: {
          art_id: string;
          color: string;
          created_at: string;
          degree_name: string;
          id: string;
          max_degree: number;
          name: string;
          position: number;
          rank_label: string | null;
          school_id: string;
          stripe: string | null;
          track: string;
        };
        ComputedFields: never;
        Insert: {
          art_id: string;
          color: string;
          created_at?: string;
          degree_name?: string;
          id?: string;
          max_degree?: number;
          name: string;
          position?: number;
          rank_label?: string | null;
          school_id: string;
          stripe?: string | null;
          track: string;
        };
        Update: {
          art_id?: string;
          color?: string;
          created_at?: string;
          degree_name?: string;
          id?: string;
          max_degree?: number;
          name?: string;
          position?: number;
          rank_label?: string | null;
          school_id?: string;
          stripe?: string | null;
          track?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_belts_art_id_school_id_fkey";
            columns: ["art_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_arts";
            referencedColumns: ["id", "school_id"];
          },
        ];
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
      school_photos: {
        Row: {
          caption: string | null;
          created_at: string;
          id: string;
          path: string;
          position: number;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          path: string;
          position?: number;
          school_id: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          path?: string;
          position?: number;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_photos_school_id_fkey";
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
          enrollment_fee: number;
          enrollment_fee_months: number;
          enrollment_fee_since: string | null;
          id: string;
          landing_about: string | null;
          landing_accent: string | null;
          landing_enabled: boolean;
          landing_instagram: string | null;
          landing_primary: string | null;
          landing_show_plans: boolean;
          landing_show_schedule: boolean;
          landing_tagline: string | null;
          landing_theme: string;
          landing_whatsapp: string | null;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          phone: string | null;
          slug: string;
          transfer_account_number: string | null;
          transfer_account_type: string | null;
          transfer_bank: string | null;
          transfer_email: string | null;
          transfer_holder: string | null;
          transfer_rut: string | null;
          trial_enabled: boolean;
          trial_min_hours: number;
          trial_note: string | null;
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
          enrollment_fee?: number;
          enrollment_fee_months?: number;
          enrollment_fee_since?: string | null;
          id?: string;
          landing_about?: string | null;
          landing_accent?: string | null;
          landing_enabled?: boolean;
          landing_instagram?: string | null;
          landing_primary?: string | null;
          landing_show_plans?: boolean;
          landing_show_schedule?: boolean;
          landing_tagline?: string | null;
          landing_theme?: string;
          landing_whatsapp?: string | null;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          phone?: string | null;
          slug: string;
          transfer_account_number?: string | null;
          transfer_account_type?: string | null;
          transfer_bank?: string | null;
          transfer_email?: string | null;
          transfer_holder?: string | null;
          transfer_rut?: string | null;
          trial_enabled?: boolean;
          trial_min_hours?: number;
          trial_note?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          default_calendar_view?: string;
          description?: string | null;
          email?: string | null;
          enrollment_fee?: number;
          enrollment_fee_months?: number;
          enrollment_fee_since?: string | null;
          id?: string;
          landing_about?: string | null;
          landing_accent?: string | null;
          landing_enabled?: boolean;
          landing_instagram?: string | null;
          landing_primary?: string | null;
          landing_show_plans?: boolean;
          landing_show_schedule?: boolean;
          landing_tagline?: string | null;
          landing_theme?: string;
          landing_whatsapp?: string | null;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          phone?: string | null;
          slug?: string;
          transfer_account_number?: string | null;
          transfer_account_type?: string | null;
          transfer_bank?: string | null;
          transfer_email?: string | null;
          transfer_holder?: string | null;
          transfer_rut?: string | null;
          trial_enabled?: boolean;
          trial_min_hours?: number;
          trial_note?: string | null;
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
      student_arts: {
        Row: {
          art_id: string;
          belt_id: string | null;
          created_at: string;
          degree: number;
          id: string;
          school_id: string;
          since: string | null;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          art_id: string;
          belt_id?: string | null;
          created_at?: string;
          degree?: number;
          id?: string;
          school_id: string;
          since?: string | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          art_id?: string;
          belt_id?: string | null;
          created_at?: string;
          degree?: number;
          id?: string;
          school_id?: string;
          since?: string | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_arts_art_id_school_id_fkey";
            columns: ["art_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_arts";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "student_arts_belt_id_art_id_fkey";
            columns: ["belt_id", "art_id"];
            isOneToOne: false;
            referencedRelation: "school_belts";
            referencedColumns: ["id", "art_id"];
          },
          {
            foreignKeyName: "student_arts_student_id_school_id_fkey";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      student_claims: {
        Row: {
          code_hash: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          school_id: string;
          student_id: string;
          used_at: string | null;
          used_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          code_hash: string;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          school_id: string;
          student_id: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          school_id?: string;
          student_id?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_claims_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_claims_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_guardians: {
        Row: {
          created_at: string;
          guardian_id: string;
          school_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          guardian_id: string;
          school_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          guardian_id?: string;
          school_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_guardians_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_profiles: {
        Row: {
          bio: string | null;
          created_at: string;
          handle: string;
          headline: string | null;
          published: boolean;
          school_id: string;
          show_achievements: boolean;
          show_belt: boolean;
          show_skills: boolean;
          show_stats: boolean;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bio?: string | null;
          created_at?: string;
          handle: string;
          headline?: string | null;
          published?: boolean;
          school_id: string;
          show_achievements?: boolean;
          show_belt?: boolean;
          show_skills?: boolean;
          show_stats?: boolean;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          handle?: string;
          headline?: string | null;
          published?: boolean;
          school_id?: string;
          show_achievements?: boolean;
          show_belt?: boolean;
          show_skills?: boolean;
          show_stats?: boolean;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_profiles_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
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
          user_id: string | null;
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
          user_id?: string | null;
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
          user_id?: string | null;
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
      subscription_events: {
        Row: {
          actor: string | null;
          at: string;
          details: NonNullable<Json>;
          id: number;
          owner_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          id?: never;
          owner_id: string;
        };
        Update: {
          actor?: string | null;
          at?: string;
          details?: NonNullable<Json>;
          id?: never;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_events_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          notes: string | null;
          owner_id: string;
          period_end: string | null;
          plan_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          notes?: string | null;
          owner_id: string;
          period_end?: string | null;
          plan_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          notes?: string | null;
          owner_id?: string;
          period_end?: string | null;
          plan_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "owners";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "platform_plans";
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
      tasks: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          notes: string | null;
          position: number;
          school_id: string;
          status: string;
          title: string;
          trial_booking_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          position?: number;
          school_id: string;
          status?: string;
          title: string;
          trial_booking_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          position?: number;
          school_id?: string;
          status?: string;
          title?: string;
          trial_booking_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_trial_booking_id_fkey";
            columns: ["trial_booking_id"];
            isOneToOne: false;
            referencedRelation: "trial_bookings";
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
          student_id: string | null;
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
          student_id?: string | null;
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
          student_id?: string | null;
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
          {
            foreignKeyName: "teachers_student_fk";
            columns: ["student_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      terms_acceptances: {
        Row: {
          accepted_at: string;
          context: string;
          guardian_consent: boolean;
          id: string;
          user_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          context: string;
          guardian_consent?: boolean;
          id?: string;
          user_id: string;
          version: string;
        };
        Update: {
          accepted_at?: string;
          context?: string;
          guardian_consent?: boolean;
          id?: string;
          user_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      trial_bookings: {
        Row: {
          class_id: string | null;
          class_name: string | null;
          created_at: string;
          date: string;
          email: string | null;
          end_time: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string;
          schedule_id: string | null;
          school_id: string;
          start_time: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          class_id?: string | null;
          class_name?: string | null;
          created_at?: string;
          date: string;
          email?: string | null;
          end_time: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone: string;
          schedule_id?: string | null;
          school_id: string;
          start_time: string;
          status?: string;
        };
        Update: {
          class_id?: string | null;
          class_name?: string | null;
          created_at?: string;
          date?: string;
          email?: string | null;
          end_time?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string;
          schedule_id?: string | null;
          school_id?: string;
          start_time?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trial_bookings_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_bookings_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "class_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_bookings_school_id_fkey";
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
      accept_terms: { Args: { p_version: string }; Returns: undefined };
      add_school_art: {
        Args: { p_school_id: string; p_template_key: string };
        Returns: string;
      };
      attach_payment_receipt: {
        Args: { p_path: string; p_payment_id: string };
        Returns: undefined;
      };
      audit: {
        Args: {
          p_action: string;
          p_details: Json;
          p_entity: string;
          p_id: string;
          p_school: string;
        };
        Returns: undefined;
      };
      book_trial: {
        Args: {
          p_date: string;
          p_email?: string;
          p_name: string;
          p_notes?: string;
          p_phone: string;
          p_schedule_id: string;
          p_slug: string;
        };
        Returns: string;
      };
      cancel_child_request: { Args: { p_id: string }; Returns: undefined };
      check_in: {
        Args: { p_class_id: string };
        Returns: {
          class_id: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          marked_by: string | null;
          school_id: string;
          self_marked: boolean;
          student_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      check_in_for: {
        Args: { p_class_id: string; p_date: string; p_student_id: string };
        Returns: {
          class_id: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          marked_by: string | null;
          school_id: string;
          self_marked: boolean;
          student_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      check_in_on: {
        Args: { p_class_id: string; p_date: string };
        Returns: {
          class_id: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          marked_by: string | null;
          school_id: string;
          self_marked: boolean;
          student_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      claim_hash: { Args: { p_code: string }; Returns: string };
      claim_student: { Args: { p_code: string }; Returns: string };
      claim_student_as: {
        Args: { p_code: string; p_email: string; p_user: string };
        Returns: string;
      };
      class_snapshot_skills: {
        Args: { p_class_id: string };
        Returns: string[];
      };
      class_started: {
        Args: { p_class_id: string; p_date: string };
        Returns: boolean;
      };
      contract_plan: {
        Args: { p_plan_id: string; p_student_id: string };
        Returns: Json;
      };
      create_school: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          address: string | null;
          city: string | null;
          created_at: string;
          default_calendar_view: string;
          description: string | null;
          email: string | null;
          enrollment_fee: number;
          enrollment_fee_months: number;
          enrollment_fee_since: string | null;
          id: string;
          landing_about: string | null;
          landing_accent: string | null;
          landing_enabled: boolean;
          landing_instagram: string | null;
          landing_primary: string | null;
          landing_show_plans: boolean;
          landing_show_schedule: boolean;
          landing_tagline: string | null;
          landing_theme: string;
          landing_whatsapp: string | null;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          phone: string | null;
          slug: string;
          transfer_account_number: string | null;
          transfer_account_type: string | null;
          transfer_bank: string | null;
          transfer_email: string | null;
          transfer_holder: string | null;
          transfer_rut: string | null;
          trial_enabled: boolean;
          trial_min_hours: number;
          trial_note: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "schools";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_student_claim: { Args: { p_student_id: string }; Returns: Json };
      current_terms_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      decide_account_request: {
        Args: {
          p_approve: boolean;
          p_id: string;
          p_role?: Database["public"]["Enums"]["school_role"];
          p_student_id?: string;
        };
        Returns: string;
      };
      decide_child_request: {
        Args: { p_approve: boolean; p_id: string; p_reason?: string };
        Returns: string;
      };
      decide_payment_submission: {
        Args: { p_approve: boolean; p_id: string; p_reason?: string };
        Returns: undefined;
      };
      degree_text: {
        Args: { p_degree: number; p_name: string };
        Returns: string;
      };
      discount_code_uses: {
        Args: { p_school_id: string };
        Returns: {
          code_id: string;
          saved: number;
          uses: number;
        }[];
      };
      discount_lookup: {
        Args: {
          p_code: string;
          p_no_plan: boolean;
          p_plan: string;
          p_school: string;
          p_student: string;
        };
        Returns: Record<string, unknown>;
      };
      discount_of: {
        Args: { p_amount: number; p_fixed: number; p_percent: number };
        Returns: number;
      };
      find_user_id_by_email: { Args: { p_email: string }; Returns: string };
      generate_enrollment_fees: {
        Args: { p_school_id?: string; p_today?: string };
        Returns: number;
      };
      grant_ceo: { Args: { p_email: string }; Returns: undefined };
      has_school_role: {
        Args: {
          p_roles: Database["public"]["Enums"]["school_role"][];
          p_school_id: string;
        };
        Returns: boolean;
      };
      is_ceo: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_platform_operator: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_school_member: { Args: { p_school_id: string }; Returns: boolean };
      is_school_owner: { Args: { p_school_id: string }; Returns: boolean };
      is_student_user: { Args: { p_school_id: string }; Returns: boolean };
      mfa_ok: { Args: Record<PropertyKey, never>; Returns: boolean };
      my_blocked_schools: {
        Args: Record<PropertyKey, never>;
        Returns: {
          name: string;
          school_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
        }[];
      };
      my_student_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      my_ward_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      platform_customers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          last_sign_in_at: string;
          notes: string;
          owner_id: string;
          period: string;
          period_end: string;
          plan_id: string;
          plan_name: string;
          price_clp: number;
          schools: Json;
          status: Database["public"]["Enums"]["subscription_status"];
          students: number;
          trial_ends: string;
          updated_at: string;
        }[];
      };
      platform_events: {
        Args: { p_limit?: number };
        Returns: {
          at: string;
          customer: string;
          details: Json;
          id: number;
          owner_id: string;
        }[];
      };
      platform_update_subscription: {
        Args: {
          p_notes: string;
          p_owner: string;
          p_period_end: string;
          p_plan: string;
          p_status: Database["public"]["Enums"]["subscription_status"];
          p_trial_ends: string;
        };
        Returns: undefined;
      };
      platform_whoami: { Args: Record<PropertyKey, never>; Returns: Json };
      rate_limit_hit: {
        Args: {
          p_bucket: string;
          p_key: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      redeem_discount: {
        Args: { p_code: string; p_payment_id: string };
        Returns: Json;
      };
      redeem_discount_enrollment: {
        Args: { p_code: string; p_enrollment_id: string };
        Returns: Json;
      };
      register_account_request: {
        Args: {
          p_address?: string;
          p_birth_date?: string;
          p_email: string;
          p_first_last_name: string;
          p_first_name: string;
          p_kind: Database["public"]["Enums"]["request_kind"];
          p_middle_name?: string;
          p_phone: string;
          p_rut: string;
          p_school_id: string;
          p_second_last_name?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      register_owner: { Args: { p_user_id: string }; Returns: undefined };
      remove_discount: { Args: { p_payment_id: string }; Returns: undefined };
      remove_enrollment_discount: {
        Args: { p_enrollment_id: string };
        Returns: undefined;
      };
      request_child: {
        Args: {
          p_address: string;
          p_birth_date: string;
          p_email: string;
          p_first_last_name: string;
          p_first_name: string;
          p_middle_name: string;
          p_rut: string;
          p_school_id: string;
          p_second_last_name: string;
        };
        Returns: string;
      };
      request_ip: { Args: Record<PropertyKey, never>; Returns: string };
      review_attendance: {
        Args: { p_approve: boolean; p_ids: string[] };
        Returns: number;
      };
      rut_is_valid: { Args: { p_rut: string }; Returns: boolean };
      rut_key: { Args: { p_rut: string }; Returns: string };
      save_class_session: {
        Args: {
          p_class_id: string;
          p_date: string;
          p_description: string;
          p_skill_ids: string[];
          p_start_time: string;
        };
        Returns: string;
      };
      save_my_public_profile:
        | {
            Args: {
              p_bio: string;
              p_handle: string;
              p_headline: string;
              p_published: boolean;
              p_show_belt: boolean;
              p_show_skills: boolean;
              p_show_stats: boolean;
              p_student_id: string;
            };
            Returns: {
              bio: string | null;
              created_at: string;
              handle: string;
              headline: string | null;
              published: boolean;
              school_id: string;
              show_achievements: boolean;
              show_belt: boolean;
              show_skills: boolean;
              show_stats: boolean;
              student_id: string;
              updated_at: string;
            };
            SetofOptions: {
              from: "*";
              to: "student_profiles";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              p_bio: string;
              p_handle: string;
              p_headline: string;
              p_published: boolean;
              p_show_achievements: boolean;
              p_show_belt: boolean;
              p_show_skills: boolean;
              p_show_stats: boolean;
              p_student_id: string;
            };
            Returns: {
              bio: string | null;
              created_at: string;
              handle: string;
              headline: string | null;
              published: boolean;
              school_id: string;
              show_achievements: boolean;
              show_belt: boolean;
              show_skills: boolean;
              show_stats: boolean;
              student_id: string;
              updated_at: string;
            };
            SetofOptions: {
              from: "*";
              to: "student_profiles";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      school_blocked: { Args: { p_school_id: string }; Returns: boolean };
      school_landing: { Args: { p_slug: string }; Returns: Json };
      school_owner: {
        Args: { p_school_id: string };
        Returns: {
          email: string;
          full_name: string;
          user_id: string;
        }[];
      };
      school_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          attendance_30d: number;
          classes_active: number;
          members: number;
          school_id: string;
          students_active: number;
          teachers_active: number;
        }[];
      };
      set_class_details: {
        Args: { p_blocks: Json; p_class_id: string; p_tag_ids: string[] };
        Returns: undefined;
      };
      set_session_not_held: {
        Args: { p_not_held: boolean; p_session_id: string };
        Returns: undefined;
      };
      set_teacher_specialties: {
        Args: { p_specialty_ids: string[]; p_teacher_id: string };
        Returns: undefined;
      };
      storage_school_id: { Args: { p_name: string }; Returns: string };
      student_achievements: { Args: { p_student_id: string }; Returns: Json };
      student_claim_info: { Args: { p_code: string }; Returns: Json };
      student_milestones: { Args: { p_student_id: string }; Returns: Json };
      student_progress: { Args: { p_student_id: string }; Returns: Json };
      student_public_profile: {
        Args: { p_handle: string; p_slug: string };
        Returns: Json;
      };
      submit_achievement: {
        Args: {
          p_art_id: string;
          p_category: string;
          p_date: string;
          p_detail: string;
          p_medal: string;
          p_student_id: string;
          p_title: string;
        };
        Returns: string;
      };
      submit_payment: {
        Args: {
          p_method: Database["public"]["Enums"]["payment_method"];
          p_payment_id: string;
          p_reference?: string;
        };
        Returns: string;
      };
      sync_all_class_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      sync_class_sessions: { Args: { p_school_id: string }; Returns: number };
      trial_availability: { Args: { p_school_id: string }; Returns: Json };
      undo_check_in: { Args: { p_class_id: string }; Returns: undefined };
      undo_check_in_for: {
        Args: { p_class_id: string; p_date: string; p_student_id: string };
        Returns: undefined;
      };
      undo_check_in_on: {
        Args: { p_class_id: string; p_date: string };
        Returns: undefined;
      };
      update_my_student: {
        Args: {
          p_address: string;
          p_birth_date: string;
          p_emergency_contact: string;
          p_emergency_phone: string;
          p_medical_notes: string;
          p_phone: string;
          p_student_id: string;
        };
        Returns: undefined;
      };
      withdraw_achievement: { Args: { p_id: string }; Returns: undefined };
      withdraw_plan_contract: {
        Args: { p_enrollment_id: string; p_student_id: string };
        Returns: Json;
      };
    };
    Enums: {
      billing_cycle: "mensual" | "trimestral" | "semestral" | "anual" | "unico";
      class_level:
        | "todos"
        | "principiante"
        | "intermedio"
        | "avanzado"
        | "ninos"
        | "competicion";
      discount_scope: "pago" | "plan";
      enrollment_status: "activa" | "pausada" | "cancelada" | "pendiente";
      gender: "masculino" | "femenino" | "otro";
      payment_kind: "plan" | "matricula" | "otro";
      payment_method: "transferencia" | "efectivo" | "tarjeta" | "otro";
      payment_status: "pendiente" | "pagado" | "fallido" | "reembolsado";
      request_kind: "alumno" | "miembro";
      request_status: "pendiente" | "aprobada" | "rechazada";
      school_role: "admin" | "user";
      subscription_status: "prueba" | "activa" | "suspendida" | "cancelada";
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
      billing_cycle: ["mensual", "trimestral", "semestral", "anual", "unico"],
      class_level: [
        "todos",
        "principiante",
        "intermedio",
        "avanzado",
        "ninos",
        "competicion",
      ],
      discount_scope: ["pago", "plan"],
      enrollment_status: ["activa", "pausada", "cancelada", "pendiente"],
      gender: ["masculino", "femenino", "otro"],
      payment_kind: ["plan", "matricula", "otro"],
      payment_method: ["transferencia", "efectivo", "tarjeta", "otro"],
      payment_status: ["pendiente", "pagado", "fallido", "reembolsado"],
      request_kind: ["alumno", "miembro"],
      request_status: ["pendiente", "aprobada", "rechazada"],
      school_role: ["admin", "user"],
      subscription_status: ["prueba", "activa", "suspendida", "cancelada"],
    },
  },
} as const;
