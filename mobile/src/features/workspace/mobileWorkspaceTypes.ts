export type MobileGuildSummary = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  member_count?: number | null;
  is_public?: number | boolean | null;
};

export type MobileGuildDetail = MobileGuildSummary & {
  members?: MobileGuildMember[];
  ranks?: unknown[];
  selfRank?: unknown;
};

export type MobileGuildMember = {
  id: string;
  username?: string;
  avatar_color?: string | null;
  profile_picture?: string | null;
  npub?: string | null;
};

export type MobileRoom = {
  id: string;
  name: string;
  guild_id?: string | null;
  created_by?: string | null;
};

export type MobileDmConversation = {
  id?: string;
  other_user_id: string;
  other_username?: string | null;
  other_avatar_color?: string | null;
  other_profile_picture?: string | null;
  other_npub?: string | null;
  created_at?: string | null;
};

export type MobileMessage = {
  id: string;
  content?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_color?: string | null;
  sender_picture?: string | null;
  room_id?: string | null;
  dm_partner_id?: string | null;
  created_at?: string | null;
  encrypted?: number | boolean | null;
  attachments?: Array<{ id?: string; original_name?: string | null; file_url?: string | null }>;
};

export type MobileConversation =
  | { id: string; type: 'room'; title: string }
  | { id: string; type: 'dm'; title: string };
