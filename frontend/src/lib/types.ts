export type StateKey = 'punjab' | 'up'

export interface Me {
  id: number
  username: string
  full_name: string | null
  role: 'admin' | 'punjab' | 'up' | 'viewer'
  must_change_password: boolean
  states: StateKey[]
  upload_states: StateKey[]
}

export interface Day { date: string; total: number; complete: number; partial: number }

export interface Overview {
  total: number
  complete: number
  partial: number
  completion_rate: number
  acs_surveyed: number
  districts: number
  total_acs: number
  phases: { name: string; target: number; done: number; acs: number }[]
  latest_day: Day | null
  previous_day: Day | null
  avg_daily_complete_7d: number
  spark: { date: string; complete: number }[]
}

export interface LastUpload { at: string; by: string; filename: string; rows: number }

export interface Meta {
  key: StateKey
  name: string
  short: string
  total_acs: number
  incumbent: string
  phases: { name: string; target: number }[]
  districts: string[]
  acs: { ac: string; district: string | null }[]
  filter_options: Record<string, string[]>
  date_min: string | null
  date_max: string | null
  has_call_centers: boolean
  vote_columns: { key: string; label: string }[]
  crosstab_dimensions: { key: string; label: string }[]
  last_upload: LastUpload | null
}

export interface AcRow {
  ac: string
  district: string | null
  total: number
  complete: number
  partial: number
  first_date: string | null
  last_date: string | null
  pace_7d: number
  next_phase: string | null
  remaining: number
  eta_days: number | null
  phases: { name: string; target: number; count: number; pct: number; done: boolean }[]
}

export interface DistrictRow { district: string; total: number; complete: number; partial: number; acs: number; completion_rate: number }
export interface Heatmap { dates: string[]; rows: { district: string; values: number[]; total: number }[] }
export interface CallCenter { center: string; total: number; complete: number; partial: number; completion_rate: number; active_days: number; complete_per_day: number }

export interface Item { label: string; count: number; pct: number }
export interface QuestionBlock { key: string; title: string; question: string; kind: 'rating' | 'choice' | 'party' | 'ranked' | 'issue'; base: number; items: Item[] }
export interface Questions { respondents: number; sections: Record<'leadership' | 'mla' | 'voting' | 'issues' | 'demographics', QuestionBlock[]> }

export interface Swing {
  base: number
  nodes: string[]
  flows: { from: string; to: string; count: number; pct: number }[]
  shares: { party: string; from_pct: number; to_pct: number; change: number; retention_pct: number | null }[]
}

export interface Crosstab { columns: string[]; rows: { label: string; base: number; cells: { col: string; count: number; pct: number }[] }[] }

export interface Strategy {
  incumbent: string
  base: number
  net_satisfaction: number | null
  satisfied_pct: number | null
  dissatisfied_pct: number | null
  incumbent_share: Swing['shares'][number] | null
  retention: { base: number; retained_pct: number | null; undecided_pct: number | null; leakage_pct: number | null; leakage: { to: string; count: number; pct: number }[] }
  risk: { threshold_pct: number; acs_rated: number; items: { ac: string; district: string | null; base: number; dissatisfied_pct: number }[] }
  drivers: { issue: string; count: number; pct: number }[]
  divides: { dimension: string; groups: { group: string; pct: number | null; base: number }[] }[]
}

export interface PortfolioItem { key: StateKey; name: string; short: string; overview: Overview; last_upload: LastUpload | null }

export interface UploadPreview {
  filename: string
  ok: boolean
  total_rows: number
  missing_required: string[]
  unknown_columns: string[]
  bad_dates: number
  bad_date_examples: string[]
  duplicates: number
  date_min: string | null
  date_max: string | null
  statuses: Record<string, number>
  acs: number
  districts: number
  warnings: string[]
}

export interface UploadLog {
  id: number
  state: StateKey
  filename: string
  rows_imported: number
  date_min: string | null
  date_max: string | null
  uploaded_by: string
  uploaded_at: string
  restored_from: number | null
  can_restore: boolean
}

export interface UserRow {
  id: number
  username: string
  full_name: string | null
  role: Me['role']
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
  created_at: string | null
}

export interface AuditRow { id: number; at: string; username: string | null; action: string; detail: string | null; ip: string | null }
