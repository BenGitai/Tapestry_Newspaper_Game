// Zod schemas for everything in data/. Loading validates against these so a typo
// in the JSON fails loudly at startup instead of silently breaking the simulation.
import { z } from 'zod';

export const CATEGORIES = ['politics', 'economy', 'social', 'sports', 'culture', 'world'] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const ANGLES = ['puff', 'straight', 'hard'] as const;
export type Angle = (typeof ANGLES)[number];

export const DESKS = ['city_hall', 'business', 'neighborhoods', 'sports', 'culture'] as const;
export const deskSchema = z.enum(DESKS);
export type Desk = z.infer<typeof deskSchema>;

export const storySchema = z.object({
  id: z.string(),
  day: z.number().int().min(1),
  filed_at: z.string().regex(/^\d\d:\d\d$/),
  wire_source: z.string(),
  category: categorySchema,
  scope: z.enum(['local', 'national', 'world']),
  districts: z.array(z.string()),
  wire_headline: z.string(),
  wire_text: z.string(),
  facts: z.array(z.string()).min(1),
  importance: z.number().int().min(1).max(5),
  base_column_inches: z.number().positive(),
  sensitivity: z.enum(['normal', 'high']),
  hard_hitting_lean: z.number().min(-1).max(1),
  targets: z.array(z.string()),
  tags: z.array(z.string()),
  storyline: z.string().optional(),
  storyline_step: z.number().int().optional(),
  photo: z.string().optional(),
  real_story_url: z.string(),
});
export type Story = z.infer<typeof storySchema>;

export const wireSourceSchema = z.object({ id: z.string(), name: z.string(), fictional: z.boolean() });
export type WireSource = z.infer<typeof wireSourceSchema>;

export const storyFileSchema = z.object({
  wire_sources: z.array(wireSourceSchema),
  stories: z.array(storySchema),
});

const categoryWeights = z.record(categorySchema, z.number().min(0).max(1));

export const readerGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  interests: categoryWeights,
  hard_news_pref: z.number().min(0).max(1),
  price_sensitivity: z.number().min(0).max(1),
});
export type ReaderGroup = z.infer<typeof readerGroupSchema>;

const point = z.tuple([z.number(), z.number()]);

export const districtSchema = z.object({
  id: z.string(),
  name: z.string(),
  example_neighborhoods: z.array(z.string()),
  population_share: z.number().min(0).max(1),
  income_tier: z.number().int().min(1).max(5),
  group_mix: z.record(z.string(), z.number().min(0).max(1)),
  lean_mix: z.object({ left: z.number(), center: z.number(), right: z.number() }),
  rival_strength: z.number().min(0).max(1),
  polygon: z.array(point).min(3),
});
export type District = z.infer<typeof districtSchema>;

export const entitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['government', 'advertiser']),
  sector: z.string().optional(),
  ad_revenue_per_issue: z.number().nonnegative(),
  note: z.string().optional(),
});
export type Entity = z.infer<typeof entitySchema>;

export const attributesSchema = z.object({
  speed: z.number().int().min(1).max(20),
  accuracy: z.number().int().min(1).max(20),
  impact: z.number().int().min(1).max(20),
  charge: z.number().int().min(1).max(20),
  flair: z.number().int().min(1).max(20),
  tact: z.number().int().min(1).max(20),
});
export type Attributes = z.infer<typeof attributesSchema>;
export const ATTRIBUTE_KEYS = Object.keys(attributesSchema.shape) as (keyof Attributes)[];

export const reporterSchema = z.object({
  id: z.string(),
  name: z.string(),
  desk: deskSchema,
  skill: z.number().int().min(1).max(5),
  salary_per_issue: z.number().nonnegative(),
  attributes: attributesSchema,
  voice: z.string(),
  starting_candidate: z.boolean(),
});
export type Reporter = z.infer<typeof reporterSchema>;

export const originSchema = z.object({
  name: z.string(),
  cash: z.number(),
  debt: z.number(),
  starting_readers: z.number().int().nonnegative(),
  trust: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  cost_multiplier: z.number().positive(),
  reader_age_skew: z.enum(['young', 'old']),
  readership_decline_per_issue: z.number().optional(),
});
export type Origin = z.infer<typeof originSchema>;

export const ORIGIN_IDS = ['founded', 'inherited', 'bought'] as const;
export type OriginId = (typeof ORIGIN_IDS)[number];

export const cityWorldSchema = z.object({
  city: z.object({
    id: z.string(),
    name: z.string(),
    nickname: z.string(),
    print_reader_pool: z.number().int().positive(),
    map_viewbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    rivers: z.record(z.string(), z.array(point)),
  }),
  reader_groups: z.array(readerGroupSchema),
  districts: z.array(districtSchema),
  entities: z.array(entitySchema),
  staff_pool: z.array(reporterSchema),
  desk_categories: z.record(z.string(), z.union([z.array(categorySchema), z.string()])),
  rival: z.object({
    id: z.string(),
    name: z.string(),
    fictional: z.boolean(),
    stance: z.enum(['left', 'center', 'right']),
    price: z.number(),
    strong_districts: z.array(z.string()),
    front_page_rule: z.string(),
    starting_share: z.number(),
  }),
  origins: z.object({ founded: originSchema, inherited: originSchema, bought: originSchema }),
  pricing: z.object({
    cover_price: z.number(),
    print_cost_per_copy: z.number(),
    distribution_cost_per_district_per_issue: z.number(),
    newsstand_cost: z.number(),
    bureau_cost: z.number(),
  }),
});
export type CityWorld = z.infer<typeof cityWorldSchema>;

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  difficulty: z.string(),
  enabled: z.boolean(),
  blurb: z.string().optional(),
});
export type City = z.infer<typeof citySchema>;
export const cityListSchema = z.object({ cities: z.array(citySchema) });
