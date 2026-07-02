import {
  Bike,
  CheckCircle2,
  Clock,
  Flame,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Utensils,
} from 'lucide-react';
import type {
  DietaryProfileCard,
  MealCarouselCard,
  OrderConfirmationCard,
  OrderLineItem,
  OrderStatusCard,
  OrderSummaryCard,
  OrderTrackingCard,
  PrimoCard,
  RefundCard,
  RestaurantsCard,
} from '@/api/primoCards';
import { cn } from '@/lib/utils';

/**
 * PrimoCards — Controlled Generative UI renderer for the Primo chat.
 *
 * The agent picks WHICH card to show (control); the data is produced server-side by the
 * Apex/Flow actions (never invented by the LLM). Each card is compact to fit the chat panel
 * and uses the Pronto brand tokens so it reads as part of the same experience.
 */
export function PrimoCards({ cards }: { cards: PrimoCard[] }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {cards.map((card, i) => (
        <PrimoCardView key={i} card={card} />
      ))}
    </div>
  );
}

function PrimoCardView({ card }: { card: PrimoCard }) {
  switch (card.type) {
    case 'mealCarousel':
      return <MealCarouselView card={card} />;
    case 'restaurants':
      return <RestaurantsCardView card={card} />;
    case 'orderTracking':
      return <OrderTrackingCardView card={card} />;
    case 'orderStatus':
      return <OrderStatusCardView card={card} />;
    case 'orderSummary':
      return <OrderSummaryCardView card={card} />;
    case 'orderConfirmation':
      return <OrderConfirmationCardView card={card} />;
    case 'refund':
      return <RefundCardView card={card} />;
    case 'dietaryProfile':
      return <DietaryProfileCardView card={card} />;
    default:
      return null;
  }
}

/* ---- shared shells ------------------------------------------------------- */

function CardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-pronto-ink/10 bg-white shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-pronto-ink/70">
      {children}
    </span>
  );
}

/* ---- meal carousel (rich, from build_meal_details) ----------------------- */

function MealCarouselView({ card }: { card: MealCarouselCard }) {
  const meals = card.meals ?? [];
  if (meals.length === 0) return null;
  return (
    <div className="space-y-2">
      {(card.title || card.subtitle) && (
        <div className="px-0.5">
          {card.title && (
            <p className="text-sm font-bold text-pronto-ink">{card.title}</p>
          )}
          {card.subtitle && (
            <p className="text-[11px] text-pronto-ink/55">{card.subtitle}</p>
          )}
        </div>
      )}
      {/* Horizontal swipeable carousel */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]">
        {meals.map((m, i) => (
          <div
            key={m.id ?? i}
            className="w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-pronto-ink/10 bg-white shadow-sm"
          >
            <div className="relative h-24 w-full overflow-hidden bg-secondary">
              {m.imageUrl && (
                <img
                  src={m.imageUrl}
                  alt={m.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
              {m.badge && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-pronto-speed px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {m.badge}
                </span>
              )}
            </div>
            <div className="space-y-1.5 p-2.5">
              <div>
                <p className="truncate text-sm font-semibold text-pronto-ink">{m.name}</p>
                {m.category && (
                  <p className="truncate text-[11px] text-pronto-ink/50">{m.category}</p>
                )}
              </div>
              {m.description && (
                <p className="line-clamp-2 text-[11px] leading-snug text-pronto-ink/70">
                  {m.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {typeof m.calories === 'number' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-pronto-ink/60">
                    <Flame className="size-3 text-pronto-speed" aria-hidden="true" />
                    {m.calories} kcal
                  </span>
                )}
                {(m.tags ?? []).slice(0, 2).map(t => (
                  <span
                    key={t}
                    className="rounded-full bg-pronto-fresh/12 px-1.5 py-0.5 text-[10px] font-semibold text-pronto-fresh"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- restaurants --------------------------------------------------------- */

function RestaurantsCardView({ card }: { card: RestaurantsCard }) {
  const items = card.items ?? [];
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((r, i) => (
        <CardShell key={i} className="flex items-center gap-3 p-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pronto-speed/10 text-pronto-speed">
            <Utensils className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-pronto-ink">{r.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-pronto-ink/60">
              {r.cuisine && <span>{r.cuisine}</span>}
              {r.city && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="size-3" aria-hidden="true" />
                  {r.city}
                </span>
              )}
            </div>
          </div>
          {r.rating && r.rating !== 'n/a' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pronto-saffron/15 px-2 py-0.5 text-xs font-bold text-pronto-ink">
              <Star className="size-3 fill-pronto-saffron text-pronto-saffron" aria-hidden="true" />
              {r.rating}
            </span>
          )}
        </CardShell>
      ))}
    </div>
  );
}

/* ---- order tracking (live: GetDeliveryTracking) -------------------------- */

function OrderTrackingCardView({ card }: { card: OrderTrackingCard }) {
  const items = (card.items ?? '')
    .split(/[;,\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  const late = card.isLate === true;
  const enRoute = late || typeof card.etaMinutes === 'number';
  return (
    <CardShell>
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3.5 py-2.5 text-white',
          late
            ? 'bg-gradient-to-br from-pronto-saffron to-pronto-speed'
            : 'bg-gradient-to-br from-pronto-fresh to-emerald-600'
        )}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/75">
            {enRoute && (
              <span className="inline-flex size-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
            )}
            {card.restaurant || 'Your order'}
          </p>
          <p className="truncate text-sm font-bold">{card.status || (late ? 'On the way' : 'Delivered')}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
          {late && typeof card.etaMinutes === 'number' ? `~${card.etaMinutes} min` : (late ? 'Late' : 'Delivered')}
        </span>
      </div>
      <div className="space-y-2.5 p-3.5">
        {enRoute && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {card.driver && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-pronto-ink">
                  <Bike className="size-4 text-pronto-speed" aria-hidden="true" />
                  {card.driver}
                  {card.distanceKm ? (
                    <span className="text-pronto-ink/60">· {card.distanceKm} km away</span>
                  ) : ''}
                </span>
              )}
              {late && typeof card.minutesLate === 'number' && card.minutesLate > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-pronto-saffron/20 px-2 py-0.5 text-[11px] font-bold text-pronto-ink">
                  <Clock className="size-3 text-pronto-saffron" aria-hidden="true" />
                  running ~{card.minutesLate} min late
                </span>
              )}
            </div>
            {/* Subtle live-progress hint */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full w-2/3 rounded-full',
                  late ? 'bg-pronto-saffron' : 'bg-pronto-fresh'
                )}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
        {items.length > 0 && (
          <ul className="space-y-1 border-t border-pronto-ink/[0.06] pt-2 text-sm text-pronto-ink/80">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-pronto-speed" aria-hidden="true" />
                {it}
              </li>
            ))}
          </ul>
        )}
        {card.total && (
          <div className="flex items-center justify-between border-t border-pronto-ink/[0.06] pt-2 text-sm">
            <span className="text-pronto-ink/60">Order total</span>
            <span className="font-bold text-pronto-ink">€{card.total}</span>
          </div>
        )}
      </div>
    </CardShell>
  );
}

/* ---- order status -------------------------------------------------------- */

function OrderStatusCardView({ card }: { card: OrderStatusCard }) {
  const items = (card.lineItems ?? '')
    .split(/[;\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  const eta = card.etaMinutes;
  const etaLabel =
    eta && eta !== 'Delivered' && eta !== 'Calculating' && eta !== '' ? `${eta} min` : eta || '—';

  return (
    <CardShell>
      <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-pronto-speed to-pronto-speed-dark px-3.5 py-2.5 text-white">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Order</p>
          <p className="truncate text-sm font-bold">{card.orderId || card.restaurantName || 'Your order'}</p>
        </div>
        {card.status && (
          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
            {card.status}
          </span>
        )}
      </div>
      <div className="space-y-2.5 p-3.5">
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-pronto-ink">
            <Clock className="size-4 text-pronto-speed" aria-hidden="true" />
            {etaLabel}
          </span>
          {card.restaurantName && (
            <span className="inline-flex items-center gap-1.5 text-pronto-ink/70">
              <Utensils className="size-4" aria-hidden="true" />
              {card.restaurantName}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <ul className="space-y-1 border-t border-pronto-ink/[0.06] pt-2 text-sm text-pronto-ink/80">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-pronto-speed" aria-hidden="true" />
                {it}
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardShell>
  );
}

/* ---- order summary (pre-confirmation) + order confirmation --------------- */

function OrderItemRows({ items }: { items: OrderLineItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-pronto-ink/80">{it.name}</span>
          {it.price != null && it.price !== '' && (
            <span className="shrink-0 font-semibold text-pronto-ink">€{it.price}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function OrderMetaRows({
  deliveryAddress,
  eta,
}: {
  deliveryAddress?: string;
  eta?: string;
}) {
  if (!deliveryAddress && !eta) return null;
  return (
    <div className="space-y-1.5 text-sm">
      {deliveryAddress && (
        <div className="flex items-start gap-1.5 text-pronto-ink/70">
          <MapPin className="mt-0.5 size-4 shrink-0 text-pronto-speed" aria-hidden="true" />
          <span className="min-w-0">{deliveryAddress}</span>
        </div>
      )}
      {eta && (
        <div className="flex items-center gap-1.5 text-pronto-ink/70">
          <Clock className="size-4 shrink-0 text-pronto-speed" aria-hidden="true" />
          <span>{eta}</span>
        </div>
      )}
    </div>
  );
}

function OrderSummaryCardView({ card }: { card: OrderSummaryCard }) {
  const items = card.items ?? [];
  return (
    <CardShell>
      <div className="flex items-center gap-2 bg-gradient-to-br from-pronto-speed to-pronto-speed-dark px-3.5 py-2.5 text-white">
        <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
        <p className="font-display text-sm font-bold">Confirm your order</p>
      </div>
      <div className="space-y-2.5 p-3.5">
        {items.length > 0 && <OrderItemRows items={items} />}
        {card.total && (
          <div className="flex items-center justify-between border-t border-pronto-ink/[0.06] pt-2 text-sm">
            <span className="font-bold text-pronto-ink">Total</span>
            <span className="font-bold text-pronto-ink">€{card.total}</span>
          </div>
        )}
        {(card.deliveryAddress || card.eta) && (
          <div className="border-t border-pronto-ink/[0.06] pt-2">
            <OrderMetaRows deliveryAddress={card.deliveryAddress} eta={card.eta} />
          </div>
        )}
        <p className="flex items-center gap-1 rounded-lg bg-pronto-sky/40 px-2.5 py-1.5 text-[11px] font-semibold text-pronto-ink/70">
          <Sparkles className="size-3.5 text-pronto-speed" aria-hidden="true" />
          Confirm to place your order
        </p>
      </div>
    </CardShell>
  );
}

function OrderConfirmationCardView({ card }: { card: OrderConfirmationCard }) {
  const items = card.items ?? [];
  return (
    <CardShell>
      <div className="flex items-center gap-2.5 bg-gradient-to-br from-pronto-fresh to-emerald-600 px-3.5 py-2.5 text-white">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-display text-sm font-bold">Order placed</p>
          {card.orderId && (
            <p className="truncate text-[11px] font-semibold text-white/80">{card.orderId}</p>
          )}
        </div>
      </div>
      <div className="space-y-2.5 p-3.5">
        {items.length > 0 && <OrderItemRows items={items} />}
        {card.total && (
          <div className="flex items-center justify-between border-t border-pronto-ink/[0.06] pt-2 text-sm">
            <span className="font-bold text-pronto-ink">Total</span>
            <span className="font-bold text-pronto-fresh">€{card.total}</span>
          </div>
        )}
        {(card.deliveryAddress || card.eta) && (
          <div className="border-t border-pronto-ink/[0.06] pt-2">
            <OrderMetaRows deliveryAddress={card.deliveryAddress} eta={card.eta} />
          </div>
        )}
      </div>
    </CardShell>
  );
}

/* ---- refund -------------------------------------------------------------- */

const REFUND_META: Record<
  RefundCard['decision'],
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  approved: { label: 'Refund approved', className: 'text-pronto-fresh', icon: CheckCircle2 },
  escalated: { label: 'Sent for manual review', className: 'text-pronto-saffron', icon: ShieldCheck },
  failed: { label: 'Refund not processed', className: 'text-muted-foreground', icon: ShieldCheck },
};

function RefundCardView({ card }: { card: RefundCard }) {
  const meta = REFUND_META[card.decision] ?? REFUND_META.failed;
  const Icon = meta.icon;
  const isPartial = card.kind === 'partial';
  return (
    <CardShell className="p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex size-9 items-center justify-center rounded-full bg-secondary', meta.className)}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-bold', meta.className)}>{meta.label}</p>
          <p className="text-[11px] text-pronto-ink/60">
            {isPartial ? 'Partial (30%)' : 'Full refund'}
            {card.orderId ? ` · ${card.orderId}` : ''}
          </p>
        </div>
        {card.decision === 'approved' && card.amount && (
          <span className="shrink-0 text-lg font-bold text-pronto-fresh">€{card.amount}</span>
        )}
      </div>

      {card.decision === 'approved' && isPartial && card.orderTotal && (
        <p className="mt-2 border-t border-pronto-ink/[0.06] pt-2 text-[11px] text-pronto-ink/60">
          30% of the €{card.orderTotal} order.
        </p>
      )}
      {card.decision === 'approved' && card.voucher && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-pronto-saffron/12 px-2.5 py-1.5 text-xs font-semibold text-pronto-ink">
          <Ticket className="size-3.5 text-pronto-saffron" aria-hidden="true" />
          €{card.voucher} voucher added to your next order
        </div>
      )}
      {card.decision === 'escalated' && card.orderTotal && card.limit && (
        <p className="mt-2 border-t border-pronto-ink/[0.06] pt-2 text-[11px] text-pronto-ink/60">
          €{card.orderTotal} is above the €{card.limit} auto-refund limit.
        </p>
      )}
    </CardShell>
  );
}

/* ---- dietary profile ----------------------------------------------------- */

function DietaryProfileCardView({ card }: { card: DietaryProfileCard }) {
  const allergens = card.allergens ?? [];
  const diet = card.dietFlags ?? [];
  const cuisines = card.favoriteCuisines ?? [];
  return (
    <CardShell className="p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-pronto-speed/10 text-pronto-speed">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-bold text-pronto-ink">Your taste profile</p>
        {card.loyaltyTier && (
          <span className="ml-auto rounded-full bg-pronto-saffron/15 px-2 py-0.5 text-[11px] font-bold text-pronto-ink">
            {card.loyaltyTier}
          </span>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {allergens.length > 0 && (
          <ProfileRow label="Avoids">
            {allergens.map(a => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
              >
                <ShieldCheck className="size-3" aria-hidden="true" />
                {a}
              </span>
            ))}
          </ProfileRow>
        )}
        {diet.length > 0 && (
          <ProfileRow label="Diet">
            {diet.map(d => (
              <Chip key={d}>{d}</Chip>
            ))}
          </ProfileRow>
        )}
        {cuisines.length > 0 && (
          <ProfileRow label="Loves">
            {cuisines.map(c => (
              <Chip key={c}>{c}</Chip>
            ))}
          </ProfileRow>
        )}
        {card.spiceLevel && (
          <ProfileRow label="Spice">
            <Chip>{card.spiceLevel}</Chip>
          </ProfileRow>
        )}
      </div>
    </CardShell>
  );
}

function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 pt-0.5 text-[11px] font-bold uppercase tracking-wide text-pronto-ink/40">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
