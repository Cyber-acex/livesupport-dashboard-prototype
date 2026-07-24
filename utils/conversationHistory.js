export function mergeConversationMessagesForDisplay(rows = []) {
  return [...rows]
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left?.created_at || 0).getTime();
      const rightTime = new Date(right?.created_at || 0).getTime();
      if (leftTime === rightTime) {
        return Number(left?.id || 0) - Number(right?.id || 0);
      }
      return leftTime - rightTime;
    })
    .map((row) => ({ ...row }));
}
