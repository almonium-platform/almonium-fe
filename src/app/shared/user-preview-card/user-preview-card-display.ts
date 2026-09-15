export function sharedItemsFirst<T>(items: readonly T[], isShared: (item: T) => boolean): T[] {
  return items
    .map((item, index) => ({item, index, shared: isShared(item)}))
    .sort((left, right) => Number(right.shared) - Number(left.shared) || left.index - right.index)
    .map(({item}) => item);
}
