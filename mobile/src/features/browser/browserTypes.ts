export type GuildListEntry = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
  accent_color?: string | null;
  bg_color?: string | null;
  created_by?: string;
  is_public?: number;
  invite_code?: string | null;
  rank_id?: string | null;
  rank_name?: string | null;
  rank_order?: number | null;
  permissions?: string | null;
  memberCount?: number;
  motd?: string | null;
};

export type GuildDetail = GuildListEntry & {
  ranks?: Array<{
    id: string;
    name: string;
    rank_order?: number | null;
    permissions?: string | null;
  }>;
  capabilities?: Record<string, unknown> | null;
  myRank?: {
    id?: string | null;
    name?: string | null;
    rank_order?: number | null;
    permissions?: string | null;
  } | null;
};

export type Room = {
  id: string;
  name: string;
  guild_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

export type Attachment = {
  id?: string;
  stored_name?: string;
  original_name?: string;
  mime_type?: string;
  size_bytes?: number;
};

export type Message = {
  id: string;
  content?: string | null;
  sender_id: string;
  sender_name?: string | null;
  sender_color?: string | null;
  sender_npub?: string | null;
  sender_picture?: string | null;
  room_id?: string | null;
  dm_partner_id?: string | null;
  created_at?: string | null;
  encrypted?: number;
  attachments?: Attachment[];
};

export type DmConversation = {
  id?: string;
  user_a_id?: string;
  user_b_id?: string;
  other_user_id: string;
  other_username?: string | null;
  other_avatar_color?: string | null;
  other_profile_picture?: string | null;
  other_last_seen?: string | null;
  other_npub?: string | null;
  created_at?: string | null;
};
