import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ViewNotCountedNotice } from "@/features/mail/detail/view-not-counted-notice";

describe("view not counted notice", () => {
  test("EM-27.2 the viewer says a view is not counted and offers Count as an open", () => {
    const countAsOpen = vi.fn();
    render(<ViewNotCountedNotice onCountAsOpen={countAsOpen} />);

    expect(screen.getByRole("note")).toHaveTextContent(
      "Viewing this email is not counted as an open, as a webhook rule would send email.opened to your app.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Count as an open" }));

    expect(countAsOpen).toHaveBeenCalledOnce();
  });
});
