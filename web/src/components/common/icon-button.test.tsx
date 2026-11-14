import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { IconButton } from "@/components/common/icon-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appShortcuts } from "@/features/shortcuts/shortcut-catalog";

function renderIconButton(shortcutKeys?: string[]) {
  return render(
    <TooltipProvider>
      <IconButton label="Delete email" shortcutKeys={shortcutKeys}>
        <svg aria-hidden="true" />
      </IconButton>
    </TooltipProvider>,
  );
}

describe("IconButton", () => {
  test("UI-13.1 its label is the accessible name and shows as a tooltip on keyboard focus", async () => {
    renderIconButton();
    const iconButton = screen.getByRole("button", { name: "Delete email" });

    await userEvent.tab();

    expect(iconButton).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Delete email",
    );
  });

  test("UI-13.1 focus a dialog or menu moves after a click or Enter does not open the tooltip", async () => {
    renderIconButton();
    const iconButton = screen.getByRole("button", { name: "Delete email" });

    await userEvent.click(document.body);
    act(() => {
      iconButton.focus();
    });

    expect(iconButton).toHaveFocus();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("UI-13.2 a shortcut from the catalog shows in the tooltip and as aria-keyshortcuts", async () => {
    renderIconButton(appShortcuts.deleteOpenItem.keys);
    const iconButton = screen.getByRole("button", { name: "Delete email" });

    await userEvent.hover(iconButton);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Delete emailD",
    );
    expect(iconButton).toHaveAttribute("aria-keyshortcuts", "D");
  });
});
