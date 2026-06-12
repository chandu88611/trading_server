type PlanStrategyLike = {
  id?: number | string | null;
  strategyId?: number | string | null;
  createdAt?: Date | string | null;
  strategy?: any;
};

const MAX_SORT_VALUE = Number.MAX_SAFE_INTEGER;

function toSortableNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : MAX_SORT_VALUE;
}

function toSortableTimestamp(value: Date | string | null | undefined) {
  if (!value) return MAX_SORT_VALUE;

  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(String(value));

  return Number.isFinite(parsed) ? parsed : MAX_SORT_VALUE;
}

export function normalizePlanStrategies<T extends PlanStrategyLike>(
  planStrategies?: T[] | null
): T[] {
  if (!Array.isArray(planStrategies)) {
    return [];
  }

  return [...planStrategies].sort((left, right) => {
    return (
      toSortableTimestamp(left.createdAt) - toSortableTimestamp(right.createdAt) ||
      toSortableNumber(left.id) - toSortableNumber(right.id) ||
      toSortableNumber(left.strategyId) - toSortableNumber(right.strategyId)
    );
  });
}

export function selectPrimaryPlanStrategy<T extends PlanStrategyLike>(
  planStrategies?: T[] | null
): T | null {
  return normalizePlanStrategies(planStrategies)[0] ?? null;
}

export function isStrategyAvailableForNewSubscription(strategy?: any | null) {
  if (!strategy) return true;
  return strategy.isActive !== false && strategy.isDeprecated !== true;
}

export function selectUnavailablePlanStrategyForNewSubscription<
  T extends PlanStrategyLike
>(planStrategies?: T[] | null): T | null {
  const planStrategy = selectPrimaryPlanStrategy(planStrategies);
  if (!planStrategy?.strategy) return null;
  return isStrategyAvailableForNewSubscription(planStrategy.strategy)
    ? null
    : planStrategy;
}
