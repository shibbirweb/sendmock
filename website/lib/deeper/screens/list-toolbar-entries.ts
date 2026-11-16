import type { DeeperEntry } from "../deeper-types";

/** One traffic list's toolbar, as its Deeper page describes it (UI-14). */
type ListToolbar = {
  /** What the toolbar calls the items, such as `push notifications`. */
  itemsName: string;
  /** The per-row tick boxes as the inventory names them, such as `Select push to …`. */
  rowCheckboxNames: string[];
  /** Whether rows can be marked read and unread. */
  hasReadState: boolean;
  /** Whether the list is a table, which adds a Select column header. */
  isTable: boolean;
  /** What Delete all keeps besides settings and configuration. */
  keepsNote?: string;
  deleteAllOperationId: string;
};

/** The select-all box, Delete all, the Select column and the row tick boxes of one list. */
export function describeListToolbar(listToolbar: ListToolbar): DeeperEntry[] {
  const checkedActions = listToolbar.hasReadState
    ? "marked read, marked unread or deleted together"
    : "deleted together";
  const keepsSentence =
    listToolbar.keepsNote === undefined ? "" : ` ${listToolbar.keepsNote}`;

  return [
    {
      control: `checkbox: Select all loaded ${listToolbar.itemsName}`,
      does: `Ticks every row loaded in the list, or clears the ticks; it shows a dash when only some are ticked, and the toolbar says how many are selected. Ticked rows can be ${checkedActions}. X ticks the open or focused row.`,
    },
    {
      control: `button: Delete all ${listToolbar.itemsName}`,
      does: `Asks first, naming how many go and what stays, then deletes every row the list shows, in the picked project. While a search or filter is on it reads Delete matching and deletes only what it matches.${keepsSentence}`,
      changes:
        "Publishes one `traffic.cleared` event, so every open tab refreshes; settings and configuration stay.",
      operationIds: [listToolbar.deleteAllOperationId],
    },
    ...(listToolbar.isTable
      ? [
          {
            control: "columnheader: Select",
            does: "The column of tick boxes; it has no visible title.",
          },
        ]
      : []),
    ...listToolbar.rowCheckboxNames.map((rowCheckboxName) => ({
      control: `each item, checkbox: ${rowCheckboxName}`,
      does: `Ticks this row, so the toolbar can act on it. Shown on hover, on focus and while anything is ticked, and always on touch screens.`,
    })),
  ];
}

/** The dot on a row nobody opened yet. */
export function describeUnreadDot(itemName: string): DeeperEntry {
  return {
    control: "each item, img: Unread",
    does: `Marks a ${itemName} nobody opened yet. Opening it marks it read; Mark unread puts the dot back, and the sidebar counts the unread ones.`,
    source: "The item's `is_read` field.",
  };
}

/** The confirmation Delete all opens on lists with their own dialog state. */
export function describeDeleteAllDialog(
  itemsName: string,
  deleteAllOperationId: string,
): DeeperEntry[] {
  return [
    {
      control: `heading: Delete all # ${itemsName}?`,
      does: "The confirmation before deleting every row the list shows; the number is how many go.",
    },
    {
      control: "paragraph: Settings and configuration stay. This cannot be undone.",
      does: "Says what stays.",
    },
    { control: "button: Cancel", does: "Closes the dialog without deleting." },
    {
      control: "button: Delete all",
      state: "Delete all dialog",
      does: "Deletes every row the list shows.",
      operationIds: [deleteAllOperationId],
    },
  ];
}
