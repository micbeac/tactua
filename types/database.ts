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
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      competitions: {
        Row: {
          code: string | null;
          country: string | null;
          current_season: string | null;
          id: number;
          last_updated_at: string;
          name: string;
        };
        Insert: {
          code?: string | null;
          country?: string | null;
          current_season?: string | null;
          id: number;
          last_updated_at?: string;
          name: string;
        };
        Update: {
          code?: string | null;
          country?: string | null;
          current_season?: string | null;
          id?: number;
          last_updated_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      match_analyses: {
        Row: {
          ai_model: string;
          content_json: Json;
          generated_at: string;
          id: number;
          match_id: number;
          type: string;
        };
        Insert: {
          ai_model: string;
          content_json: Json;
          generated_at?: string;
          id?: number;
          match_id: number;
          type: string;
        };
        Update: {
          ai_model?: string;
          content_json?: Json;
          generated_at?: string;
          id?: number;
          match_id?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'match_analyses_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
        ];
      };
      match_lineups: {
        Row: {
          created_at: string;
          id: number;
          is_confirmed: boolean;
          is_starter: boolean;
          match_id: number;
          player_id: number;
          position: string | null;
          shirt_number: number | null;
          team_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          is_confirmed?: boolean;
          is_starter?: boolean;
          match_id: number;
          player_id: number;
          position?: string | null;
          shirt_number?: number | null;
          team_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          is_confirmed?: boolean;
          is_starter?: boolean;
          match_id?: number;
          player_id?: number;
          position?: string | null;
          shirt_number?: number | null;
          team_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'match_lineups_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_lineups_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_lineups_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      match_player_stats: {
        Row: {
          assists: number | null;
          goals: number | null;
          key_passes: number | null;
          match_id: number;
          minutes_played: number | null;
          passes: number | null;
          player_id: number;
          rating: number | null;
          red_card: boolean | null;
          shots: number | null;
          yellow_card: boolean | null;
        };
        Insert: {
          assists?: number | null;
          goals?: number | null;
          key_passes?: number | null;
          match_id: number;
          minutes_played?: number | null;
          passes?: number | null;
          player_id: number;
          rating?: number | null;
          red_card?: boolean | null;
          shots?: number | null;
          yellow_card?: boolean | null;
        };
        Update: {
          assists?: number | null;
          goals?: number | null;
          key_passes?: number | null;
          match_id?: number;
          minutes_played?: number | null;
          passes?: number | null;
          player_id?: number;
          rating?: number | null;
          red_card?: boolean | null;
          shots?: number | null;
          yellow_card?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'match_player_stats_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_player_stats_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      match_team_stats: {
        Row: {
          corners: number | null;
          fouls: number | null;
          match_id: number;
          offsides: number | null;
          possession: number | null;
          red_cards: number | null;
          shots: number | null;
          shots_on_target: number | null;
          team_id: number;
          yellow_cards: number | null;
        };
        Insert: {
          corners?: number | null;
          fouls?: number | null;
          match_id: number;
          offsides?: number | null;
          possession?: number | null;
          red_cards?: number | null;
          shots?: number | null;
          shots_on_target?: number | null;
          team_id: number;
          yellow_cards?: number | null;
        };
        Update: {
          corners?: number | null;
          fouls?: number | null;
          match_id?: number;
          offsides?: number | null;
          possession?: number | null;
          red_cards?: number | null;
          shots?: number | null;
          shots_on_target?: number | null;
          team_id?: number;
          yellow_cards?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'match_team_stats_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_team_stats_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          away_team_id: number | null;
          competition_id: number;
          half_time_away: number | null;
          half_time_home: number | null;
          home_team_id: number | null;
          id: number;
          kickoff_at: string;
          last_updated_at: string;
          matchday: number | null;
          referee: string | null;
          score_away: number | null;
          score_home: number | null;
          stage: string | null;
          status: string;
          venue: string | null;
        };
        Insert: {
          away_team_id?: number | null;
          competition_id: number;
          half_time_away?: number | null;
          half_time_home?: number | null;
          home_team_id?: number | null;
          id: number;
          kickoff_at: string;
          last_updated_at?: string;
          matchday?: number | null;
          referee?: string | null;
          score_away?: number | null;
          score_home?: number | null;
          stage?: string | null;
          status: string;
          venue?: string | null;
        };
        Update: {
          away_team_id?: number | null;
          competition_id?: number;
          half_time_away?: number | null;
          half_time_home?: number | null;
          home_team_id?: number | null;
          id?: number;
          kickoff_at?: string;
          last_updated_at?: string;
          matchday?: number | null;
          referee?: string | null;
          score_away?: number | null;
          score_home?: number | null;
          stage?: string | null;
          status?: string;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_away_team_id_fkey';
            columns: ['away_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_competition_id_fkey';
            columns: ['competition_id'];
            isOneToOne: false;
            referencedRelation: 'competitions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_home_team_id_fkey';
            columns: ['home_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_log: {
        Row: {
          email_status: string;
          event_type: string;
          id: number;
          match_id: number;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          email_status?: string;
          event_type: string;
          id?: number;
          match_id: number;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          email_status?: string;
          event_type?: string;
          id?: number;
          match_id?: number;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_log_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      player_season_stats: {
        Row: {
          appearances: number | null;
          assists: number | null;
          competition_id: number;
          goals: number | null;
          last_updated_at: string;
          minutes: number | null;
          player_id: number;
          red_cards: number | null;
          season: string;
          yellow_cards: number | null;
        };
        Insert: {
          appearances?: number | null;
          assists?: number | null;
          competition_id: number;
          goals?: number | null;
          last_updated_at?: string;
          minutes?: number | null;
          player_id: number;
          red_cards?: number | null;
          season: string;
          yellow_cards?: number | null;
        };
        Update: {
          appearances?: number | null;
          assists?: number | null;
          competition_id?: number;
          goals?: number | null;
          last_updated_at?: string;
          minutes?: number | null;
          player_id?: number;
          red_cards?: number | null;
          season?: string;
          yellow_cards?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'player_season_stats_competition_id_fkey';
            columns: ['competition_id'];
            isOneToOne: false;
            referencedRelation: 'competitions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'player_season_stats_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      players: {
        Row: {
          current_team_id: number | null;
          date_of_birth: string | null;
          first_name: string | null;
          id: number;
          last_name: string | null;
          last_updated_at: string;
          name: string;
          nationality: string | null;
          photo_url: string | null;
          position: string | null;
          shirt_number: number | null;
        };
        Insert: {
          current_team_id?: number | null;
          date_of_birth?: string | null;
          first_name?: string | null;
          id: number;
          last_name?: string | null;
          last_updated_at?: string;
          name: string;
          nationality?: string | null;
          photo_url?: string | null;
          position?: string | null;
          shirt_number?: number | null;
        };
        Update: {
          current_team_id?: number | null;
          date_of_birth?: string | null;
          first_name?: string | null;
          id?: number;
          last_name?: string | null;
          last_updated_at?: string;
          name?: string;
          nationality?: string | null;
          photo_url?: string | null;
          position?: string | null;
          shirt_number?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'players_current_team_id_fkey';
            columns: ['current_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          plan: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          id: string;
          plan?: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          plan?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      team_season_stats: {
        Row: {
          competition_id: number;
          draws: number | null;
          form_last_5: string[] | null;
          goal_difference: number | null;
          goals_against: number | null;
          goals_for: number | null;
          last_updated_at: string;
          losses: number | null;
          played: number | null;
          points: number | null;
          position: number | null;
          season: string;
          team_id: number;
          wins: number | null;
        };
        Insert: {
          competition_id: number;
          draws?: number | null;
          form_last_5?: string[] | null;
          goal_difference?: number | null;
          goals_against?: number | null;
          goals_for?: number | null;
          last_updated_at?: string;
          losses?: number | null;
          played?: number | null;
          points?: number | null;
          position?: number | null;
          season: string;
          team_id: number;
          wins?: number | null;
        };
        Update: {
          competition_id?: number;
          draws?: number | null;
          form_last_5?: string[] | null;
          goal_difference?: number | null;
          goals_against?: number | null;
          goals_for?: number | null;
          last_updated_at?: string;
          losses?: number | null;
          played?: number | null;
          points?: number | null;
          position?: number | null;
          season?: string;
          team_id?: number;
          wins?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'team_season_stats_competition_id_fkey';
            columns: ['competition_id'];
            isOneToOne: false;
            referencedRelation: 'competitions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_season_stats_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          country: string | null;
          founded: number | null;
          id: number;
          last_updated_at: string;
          logo_url: string | null;
          name: string;
          short_name: string | null;
          tla: string | null;
          venue: string | null;
        };
        Insert: {
          country?: string | null;
          founded?: number | null;
          id: number;
          last_updated_at?: string;
          logo_url?: string | null;
          name: string;
          short_name?: string | null;
          tla?: string | null;
          venue?: string | null;
        };
        Update: {
          country?: string | null;
          founded?: number | null;
          id?: number;
          last_updated_at?: string;
          logo_url?: string | null;
          name?: string;
          short_name?: string | null;
          tla?: string | null;
          venue?: string | null;
        };
        Relationships: [];
      };
      user_favorites: {
        Row: {
          created_at: string;
          entity_id: number;
          entity_type: string;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          entity_id: number;
          entity_type: string;
          id?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: number;
          entity_type?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
