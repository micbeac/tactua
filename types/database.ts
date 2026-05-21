export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      competitions: {
        Row: {
          api_football_league_id: number | null
          code: string | null
          country: string | null
          current_season: string | null
          id: number
          last_updated_at: string
          name: string
        }
        Insert: {
          api_football_league_id?: number | null
          code?: string | null
          country?: string | null
          current_season?: string | null
          id: number
          last_updated_at?: string
          name: string
        }
        Update: {
          api_football_league_id?: number | null
          code?: string | null
          country?: string | null
          current_season?: string | null
          id?: number
          last_updated_at?: string
          name?: string
        }
        Relationships: []
      }
      match_analyses: {
        Row: {
          ai_model: string
          content_json: Json
          generated_at: string
          id: number
          match_id: number
          type: string
        }
        Insert: {
          ai_model: string
          content_json: Json
          generated_at?: string
          id?: number
          match_id: number
          type: string
        }
        Update: {
          ai_model?: string
          content_json?: Json
          generated_at?: string
          id?: number
          match_id?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_analyses_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          id: number
          is_confirmed: boolean
          is_starter: boolean
          match_id: number
          player_id: number
          position: string | null
          shirt_number: number | null
          team_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_confirmed?: boolean
          is_starter?: boolean
          match_id: number
          player_id: number
          position?: string | null
          shirt_number?: number | null
          team_id: number
        }
        Update: {
          created_at?: string
          id?: number
          is_confirmed?: boolean
          is_starter?: boolean
          match_id?: number
          player_id?: number
          position?: string | null
          shirt_number?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_player_stats: {
        Row: {
          assists: number | null
          goals: number | null
          key_passes: number | null
          match_id: number
          minutes_played: number | null
          passes: number | null
          player_id: number
          rating: number | null
          red_card: boolean | null
          shots: number | null
          yellow_card: boolean | null
        }
        Insert: {
          assists?: number | null
          goals?: number | null
          key_passes?: number | null
          match_id: number
          minutes_played?: number | null
          passes?: number | null
          player_id: number
          rating?: number | null
          red_card?: boolean | null
          shots?: number | null
          yellow_card?: boolean | null
        }
        Update: {
          assists?: number | null
          goals?: number | null
          key_passes?: number | null
          match_id?: number
          minutes_played?: number | null
          passes?: number | null
          player_id?: number
          rating?: number | null
          red_card?: boolean | null
          shots?: number | null
          yellow_card?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_team_stats: {
        Row: {
          corners: number | null
          fouls: number | null
          match_id: number
          offsides: number | null
          possession: number | null
          red_cards: number | null
          shots: number | null
          shots_on_target: number | null
          team_id: number
          yellow_cards: number | null
        }
        Insert: {
          corners?: number | null
          fouls?: number | null
          match_id: number
          offsides?: number | null
          possession?: number | null
          red_cards?: number | null
          shots?: number | null
          shots_on_target?: number | null
          team_id: number
          yellow_cards?: number | null
        }
        Update: {
          corners?: number | null
          fouls?: number | null
          match_id?: number
          offsides?: number | null
          possession?: number | null
          red_cards?: number | null
          shots?: number | null
          shots_on_target?: number | null
          team_id?: number
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_team_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_team_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_football_fixture_id: number | null
          away_team_id: number | null
          competition_id: number
          half_time_away: number | null
          half_time_home: number | null
          home_team_id: number | null
          id: number
          kickoff_at: string
          last_updated_at: string
          matchday: number | null
          referee: string | null
          score_away: number | null
          score_home: number | null
          stage: string | null
          status: string
          venue: string | null
        }
        Insert: {
          api_football_fixture_id?: number | null
          away_team_id?: number | null
          competition_id: number
          half_time_away?: number | null
          half_time_home?: number | null
          home_team_id?: number | null
          id: number
          kickoff_at: string
          last_updated_at?: string
          matchday?: number | null
          referee?: string | null
          score_away?: number | null
          score_home?: number | null
          stage?: string | null
          status: string
          venue?: string | null
        }
        Update: {
          api_football_fixture_id?: number | null
          away_team_id?: number | null
          competition_id?: number
          half_time_away?: number | null
          half_time_home?: number | null
          home_team_id?: number | null
          id?: number
          kickoff_at?: string
          last_updated_at?: string
          matchday?: number | null
          referee?: string | null
          score_away?: number | null
          score_home?: number | null
          stage?: string | null
          status?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          email_status: string
          event_type: string
          id: number
          match_id: number
          sent_at: string
          user_id: string
        }
        Insert: {
          email_status?: string
          event_type: string
          id?: number
          match_id: number
          sent_at?: string
          user_id: string
        }
        Update: {
          email_status?: string
          event_type?: string
          id?: number
          match_id?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_stats: {
        Row: {
          appearances: number | null
          assists: number | null
          competition_id: number
          goals: number | null
          last_updated_at: string
          minutes: number | null
          player_id: number
          red_cards: number | null
          season: string
          yellow_cards: number | null
        }
        Insert: {
          appearances?: number | null
          assists?: number | null
          competition_id: number
          goals?: number | null
          last_updated_at?: string
          minutes?: number | null
          player_id: number
          red_cards?: number | null
          season: string
          yellow_cards?: number | null
        }
        Update: {
          appearances?: number | null
          assists?: number | null
          competition_id?: number
          goals?: number | null
          last_updated_at?: string
          minutes?: number | null
          player_id?: number
          red_cards?: number | null
          season?: string
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_season_stats_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          api_football_id: number | null
          birth_country: string | null
          birth_place: string | null
          current_team_id: number | null
          date_of_birth: string | null
          first_name: string | null
          height: number | null
          id: number
          last_name: string | null
          last_updated_at: string
          name: string
          nationality: string | null
          photo_url: string | null
          position: string | null
          shirt_number: number | null
          transfers_json: Json | null
          weight: number | null
        }
        Insert: {
          api_football_id?: number | null
          birth_country?: string | null
          birth_place?: string | null
          current_team_id?: number | null
          date_of_birth?: string | null
          first_name?: string | null
          height?: number | null
          id: number
          last_name?: string | null
          last_updated_at?: string
          name: string
          nationality?: string | null
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          transfers_json?: Json | null
          weight?: number | null
        }
        Update: {
          api_football_id?: number | null
          birth_country?: string | null
          birth_place?: string | null
          current_team_id?: number | null
          date_of_birth?: string | null
          first_name?: string | null
          height?: number | null
          id?: number
          last_name?: string | null
          last_updated_at?: string
          name?: string
          nationality?: string | null
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          transfers_json?: Json | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          daily_digest_enabled: boolean
          daily_digest_sent_at: string | null
          id: string
          plan: string
          updated_at: string
          username: string | null
          is_admin: boolean
          subscription_status: 'free' | 'trial' | 'paid' | 'admin_grant' | 'suspended'
          subscription_expires_at: string | null
          subscription_notes: string | null
          signup_ref_code: string | null
          last_seen_at: string | null
        }
        Insert: {
          created_at?: string
          daily_digest_enabled?: boolean
          daily_digest_sent_at?: string | null
          id: string
          plan?: string
          updated_at?: string
          username?: string | null
          is_admin?: boolean
          subscription_status?: 'free' | 'trial' | 'paid' | 'admin_grant' | 'suspended'
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          signup_ref_code?: string | null
          last_seen_at?: string | null
        }
        Update: {
          created_at?: string
          daily_digest_enabled?: boolean
          daily_digest_sent_at?: string | null
          id?: string
          plan?: string
          updated_at?: string
          username?: string | null
          is_admin?: boolean
          subscription_status?: 'free' | 'trial' | 'paid' | 'admin_grant' | 'suspended'
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          signup_ref_code?: string | null
          last_seen_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          id: number
          key: string
          subject: string
          body_md: string
          description: string | null
          variables: Json
          is_active: boolean
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          key: string
          subject: string
          body_md: string
          description?: string | null
          variables?: Json
          is_active?: boolean
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          key?: string
          subject?: string
          body_md?: string
          description?: string | null
          variables?: Json
          is_active?: boolean
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          id: number
          name: string
          slug: string
          email: string | null
          notes: string | null
          commission_pct: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
          email?: string | null
          notes?: string | null
          commission_pct?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
          email?: string | null
          notes?: string | null
          commission_pct?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          id: number
          code: string
          discount_type: 'percent' | 'fixed_eur'
          discount_value: number
          partner_id: number | null
          max_uses: number | null
          used_count: number
          expires_at: string | null
          is_active: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          code: string
          discount_type: 'percent' | 'fixed_eur'
          discount_value: number
          partner_id?: number | null
          max_uses?: number | null
          used_count?: number
          expires_at?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          code?: string
          discount_type?: 'percent' | 'fixed_eur'
          discount_value?: number
          partner_id?: number | null
          max_uses?: number | null
          used_count?: number
          expires_at?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          }
        ]
      }
      partner_referrals: {
        Row: {
          id: number
          partner_id: number
          user_id: string
          promo_code_id: number | null
          signed_up_at: string
          became_paying_at: string | null
          amount_paid_eur: number | null
          commission_due_eur: number | null
          notes: string | null
        }
        Insert: {
          id?: number
          partner_id: number
          user_id: string
          promo_code_id?: number | null
          signed_up_at?: string
          became_paying_at?: string | null
          amount_paid_eur?: number | null
          commission_due_eur?: number | null
          notes?: string | null
        }
        Update: {
          id?: number
          partner_id?: number
          user_id?: string
          promo_code_id?: number | null
          signed_up_at?: string
          became_paying_at?: string | null
          amount_paid_eur?: number | null
          commission_due_eur?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          }
        ]
      }
      user_match_analysis_events: {
        Row: {
          id: number
          user_id: string
          match_id: number
          analysis_type: 'pre_match' | 'post_match'
          action: 'generated' | 'refreshed' | 'viewed'
          at: string
        }
        Insert: {
          id?: number
          user_id: string
          match_id: number
          analysis_type: 'pre_match' | 'post_match'
          action: 'generated' | 'refreshed' | 'viewed'
          at?: string
        }
        Update: {
          id?: number
          user_id?: string
          match_id?: number
          analysis_type?: 'pre_match' | 'post_match'
          action?: 'generated' | 'refreshed' | 'viewed'
          at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_match_analysis_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          }
        ]
      }
      user_quiz_attempts: {
        Row: {
          id: number
          user_id: string
          quiz_day: string
          score: number
          total_questions: number
          correct_answers: number
          details_json: Json
          completed_at: string
        }
        Insert: {
          id?: number
          user_id: string
          quiz_day: string
          score: number
          total_questions: number
          correct_answers: number
          details_json?: Json
          completed_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          quiz_day?: string
          score?: number
          total_questions?: number
          correct_answers?: number
          details_json?: Json
          completed_at?: string
        }
        Relationships: []
      }
      team_narratives: {
        Row: {
          id: number
          published_at: string | null
          scraped_at: string
          snippet: string | null
          source: string
          team_id: number
          title: string
          url: string | null
          url_hash: string | null
        }
        Insert: {
          id?: number
          published_at?: string | null
          scraped_at?: string
          snippet?: string | null
          source: string
          team_id: number
          title: string
          url?: string | null
          url_hash?: string | null
        }
        Update: {
          id?: number
          published_at?: string | null
          scraped_at?: string
          snippet?: string | null
          source?: string
          team_id?: number
          title?: string
          url?: string | null
          url_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_narratives_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_season_stats: {
        Row: {
          competition_id: number
          draws: number | null
          form_last_5: string[] | null
          goal_difference: number | null
          goals_against: number | null
          goals_for: number | null
          last_updated_at: string
          losses: number | null
          played: number | null
          points: number | null
          position: number | null
          season: string
          team_id: number
          wins: number | null
        }
        Insert: {
          competition_id: number
          draws?: number | null
          form_last_5?: string[] | null
          goal_difference?: number | null
          goals_against?: number | null
          goals_for?: number | null
          last_updated_at?: string
          losses?: number | null
          played?: number | null
          points?: number | null
          position?: number | null
          season: string
          team_id: number
          wins?: number | null
        }
        Update: {
          competition_id?: number
          draws?: number | null
          form_last_5?: string[] | null
          goal_difference?: number | null
          goals_against?: number | null
          goals_for?: number | null
          last_updated_at?: string
          losses?: number | null
          played?: number | null
          points?: number | null
          position?: number | null
          season?: string
          team_id?: number
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_season_stats_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_season_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          api_football_id: number | null
          country: string | null
          founded: number | null
          id: number
          last_updated_at: string
          logo_url: string | null
          name: string
          short_name: string | null
          tla: string | null
          venue: string | null
        }
        Insert: {
          api_football_id?: number | null
          country?: string | null
          founded?: number | null
          id: number
          last_updated_at?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          tla?: string | null
          venue?: string | null
        }
        Update: {
          api_football_id?: number | null
          country?: string | null
          founded?: number | null
          id?: number
          last_updated_at?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          tla?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          entity_id: number
          entity_type: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: number
          entity_type: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: number
          entity_type?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
