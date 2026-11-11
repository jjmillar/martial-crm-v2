// Thin layer over the generated types (S4). Regenerate with:
//   npx supabase gen types --lang typescript --linked --schema public > src/lib/database.generated.ts
// Add new table aliases here, never edit database.generated.ts by hand.
import type { Enums, Tables, TablesInsert, TablesUpdate } from './database.generated'

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.generated'

export type SchoolRole = Enums<'school_role'>
export type Gender = Enums<'gender'>

export type School = Tables<'schools'>
export type Profile = Tables<'profiles'>
export type SchoolMember = Tables<'school_members'>
export type EmailLog = Tables<'email_log'>
export type Specialty = Tables<'specialties'>
export type Tag = Tables<'tags'>
export type Student = Tables<'students'>
export type StudentInsert = TablesInsert<'students'>
export type StudentUpdate = TablesUpdate<'students'>

