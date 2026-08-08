import { unstable_cache } from "next/cache";

import { getActiveXpLevels } from "@/features/xp/services/xp-service";

export const XP_LEVELS_CACHE_TAG = "xp-levels";

const getCachedLevels = unstable_cache(() => getActiveXpLevels(), [XP_LEVELS_CACHE_TAG], {
  revalidate: 300,
  tags: [XP_LEVELS_CACHE_TAG]
});

export function getCachedActiveXpLevels() {
  return process.env.NODE_ENV === "test" ? getActiveXpLevels() : getCachedLevels();
}
