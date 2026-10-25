/** A copy of the list with one item moved to a new position, clamped to the list. */
export function moveListItem<ItemType>(
  listItems: ItemType[],
  fromIndex: number,
  toIndex: number,
): ItemType[] {
  const movedItem = listItems[fromIndex];
  if (movedItem === undefined) {
    return listItems;
  }
  const remainingItems = listItems.filter(
    (_listItem, itemIndex) => itemIndex !== fromIndex,
  );
  const insertAt = Math.min(Math.max(toIndex, 0), remainingItems.length);

  return [
    ...remainingItems.slice(0, insertAt),
    movedItem,
    ...remainingItems.slice(insertAt),
  ];
}
