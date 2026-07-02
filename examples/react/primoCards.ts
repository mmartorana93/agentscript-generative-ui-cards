/**
 * primoCards — the client contract for Controlled Generative UI in the Primo chat.
 *
 * Primo's actions produce a compact structured `cardJson`; the agent appends it to its
 * reply verbatim, wrapped in a marker: [[PRIMO_CARD]]{...}[[/PRIMO_CARD]]. This module
 * parses those markers out of the visible text and validates them into typed cards the
 * chat can render. Anything malformed is dropped silently — the text always survives.
 */

export interface MealCardItem {
  id?: string;
  name: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  calories?: number | null;
  badge?: string;
  tags?: string[];
}

export interface MealCarouselCard {
  type: 'mealCarousel';
  title?: string;
  subtitle?: string;
  meals: MealCardItem[];
}

export interface RestaurantCardItem {
  name: string;
  cuisine?: string;
  rating?: string;
  city?: string | null;
}

export interface RestaurantsCard {
  type: 'restaurants';
  items: RestaurantCardItem[];
}

// Live: emitted by GetDeliveryTracking (Guardian, "where is my order").
export interface OrderTrackingCard {
  type: 'orderTracking';
  orderId?: string;
  restaurant?: string;
  cuisine?: string;
  items?: string;
  status?: string;
  isLate?: boolean;
  etaMinutes?: number | null;
  minutesLate?: number;
  driver?: string;
  distanceKm?: string | null;
  total?: string;
}

// Live: emitted by ProcessFullRefund / ProcessPartialRefund (via RefundService).
export interface RefundCard {
  type: 'refund';
  kind?: 'full' | 'partial';
  decision: 'approved' | 'escalated' | 'failed';
  orderId?: string;
  amount?: string | null;
  orderTotal?: string | null;
  limit?: string;
  voucher?: string | null;
}

// Dormant (legacy GetOrderStatus schema — no action emits this on v39; kept harmless).
export interface OrderStatusCard {
  type: 'orderStatus';
  orderId?: string;
  status?: string;
  etaMinutes?: string;
  restaurantName?: string | null;
  lineItems?: string;
  eligibleRefund?: string;
}

export interface OrderLineItem {
  name: string;
  price?: string | null;
}

// Pre-confirmation: shown before an order is placed ("confirm your order").
export interface OrderSummaryCard {
  type: 'orderSummary';
  items?: OrderLineItem[];
  total?: string;
  deliveryAddress?: string;
  eta?: string;
}

// Post-confirmation: shown after an order is successfully placed.
export interface OrderConfirmationCard {
  type: 'orderConfirmation';
  orderId?: string;
  items?: OrderLineItem[];
  total?: string;
  deliveryAddress?: string;
  eta?: string;
}

export interface DietaryProfileCard {
  type: 'dietaryProfile';
  allergens?: string[];
  dietFlags?: string[];
  favoriteCuisines?: string[];
  spiceLevel?: string;
  loyaltyTier?: string;
}

export type PrimoCard =
  | MealCarouselCard
  | RestaurantsCard
  | OrderTrackingCard
  | RefundCard
  | OrderStatusCard
  | OrderSummaryCard
  | OrderConfirmationCard
  | DietaryProfileCard;

const CARD_MARKER = /\[\[PRIMO_CARD\]\]([\s\S]*?)\[\[\/PRIMO_CARD\]\]/g;

const KNOWN_TYPES = new Set([
  'mealCarousel',
  'restaurants',
  'orderTracking',
  'refund',
  'orderStatus',
  'orderSummary',
  'orderConfirmation',
  'dietaryProfile',
]);

/**
 * Extracts card markers from a raw agent reply.
 * Returns the human text (markers stripped, whitespace tidied) plus any valid cards.
 * A malformed JSON block or unknown type is skipped without affecting the text.
 */
export function parseCards(raw: string): { text: string; cards: PrimoCard[] } {
  if (!raw) return { text: '', cards: [] };

  const cards: PrimoCard[] = [];
  let match: RegExpExecArray | null;
  CARD_MARKER.lastIndex = 0;
  while ((match = CARD_MARKER.exec(raw)) !== null) {
    const card = safeParseCard(match[1]);
    if (card) cards.push(card);
  }

  // Remove every marker block from the visible text, then collapse the blank lines it leaves.
  const text = raw
    .replace(CARD_MARKER, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, cards };
}

function safeParseCard(rawJson: string): PrimoCard | null {
  try {
    const obj = JSON.parse(rawJson.trim()) as { type?: unknown };
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.type !== 'string' || !KNOWN_TYPES.has(obj.type)) return null;
    // The shape is produced server-side from typed Apex/Flow outputs, so a light
    // structural check is enough; individual fields are treated as optional at render time.
    return obj as PrimoCard;
  } catch {
    return null;
  }
}
