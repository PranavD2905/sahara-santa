import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables. Field keys must match Better Auth's model
// (node_modules/@better-auth/core/dist/db/get-tables.mjs).
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  /** Display name (required). */
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  /** Profile Picture URL (Vercel Blob), null = initials. */
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Profile fields owned by the app, never set through sign-up.
  bio: varchar("bio", { length: 150 }),
  songTrackId: text("song_track_id"),
  songTitle: text("song_title"),
  songArtist: text("song_artist"),
  songArtworkUrl: text("song_artwork_url"),
  songExplicit: boolean("song_explicit"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    /** Password hash (Better Auth hashes; we never see plaintext). */
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Rate-limit counters in the DB, because serverless instances share no memory. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// App tables. Vocabulary: see GLOSSARY.md.
// ---------------------------------------------------------------------------

export const currencyEnum = pgEnum("currency", ["INR", "USD", "EUR", "GBP"]);

/**
 * Stored lifecycle. "Archived" is derived (30 days after the Exchange Date),
 * not stored, so it can never drift from the date.
 */
export const groupStatusEnum = pgEnum("group_status", [
  "open",
  "joining_closed",
  "drawn",
]);

export const group = pgTable(
  "group",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: groupStatusEnum("status").notNull().default("open"),
    /** Short code used in the Invite Link; reset by replacing it. */
    inviteCode: varchar("invite_code", { length: 16 }).notNull().unique(),
    currency: currencyEnum("currency").notNull().default("INR"),
    /** Whole currency units. Informational only. */
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    /** Optional until the Draw, required before it. */
    exchangeDate: date("exchange_date", { mode: "string" }),
    drawnAt: timestamp("drawn_at"),
    /**
     * Set when a Member left and the Patch would have broken an Exclusion:
     * their Santa has no receiver until the Organizer runs a Re-draw.
     */
    needsRedraw: boolean("needs_redraw").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("group_organizer_id_idx").on(t.organizerId)],
);

export const groupMember = pgTable(
  "group_member",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** False only for an Organizer who opted out of giving/receiving. */
    participates: boolean("participates").notNull().default(true),
    /** Organizer Override of the Profile Picture inside this Group. */
    pictureOverrideUrl: text("picture_override_url"),
    /** Organizer Override hiding the Bio inside this Group. */
    bioHidden: boolean("bio_hidden").notNull().default(false),
    /** When this Member first opened their Assignment. */
    revealedAt: timestamp("revealed_at"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_member_user_id_idx").on(t.userId),
  ],
);

/** Symmetric pair; stored once with memberA < memberB. */
export const exclusion = pgTable(
  "exclusion",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    memberA: text("member_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    memberB: text("member_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.memberA, t.memberB] })],
);

/**
 * Who draws whom. Only ever read filtered by the signed-in Santa
 * (ADR 0002); no Organizer-facing query touches this table.
 */
export const assignment = pgTable(
  "assignment",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    santaId: text("santa_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.santaId] }),
    unique("assignment_group_receiver_uq").on(t.groupId, t.receiverId),
  ],
);
