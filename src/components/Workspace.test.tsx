import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Workspace, { titleFromPrompt } from "./Workspace";
import { hasMockSocket, takeLatestSocketOffline } from "../test/setup";

describe("Workspace navigation", () => {
  it("adds the Galaxy theme to the Library with edit, toggle, and remove controls", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: /Library/ }));
    const themeCard = screen.getByRole("heading", { name: "Galaxy" }).closest("article");
    expect(themeCard).not.toBeNull();
    expect(within(themeCard!).getByRole("button", { name: "Customize" })).toBeInTheDocument();
    expect(within(themeCard!).getByRole("button", { name: "Disable Galaxy" })).toHaveTextContent("Enabled");
    expect(document.documentElement.dataset.theme).toBe("galaxy");

    await user.click(within(themeCard!).getByRole("button", { name: "Disable Galaxy" }));
    expect(within(themeCard!).getByRole("button", { name: "Enable Galaxy" })).toHaveTextContent("Disabled");

    await user.click(within(themeCard!).getByRole("button", { name: "Remove Galaxy" }));
    expect(screen.queryByRole("heading", { name: "Galaxy" })).not.toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("default");
  });

  it("opens customization as a chat instead of a settings window", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "Customize" }));

    expect(screen.getByRole("heading", { name: "Customize Blackbox in chat" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe your theme, add-on, or mod…")).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: /customize/i })).not.toBeInTheDocument();
  });

  it("opens search in a modal and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    const dialog = screen.getByRole("dialog", { name: "Search Blackbox" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Search chats and Library…")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search Blackbox" })).not.toBeInTheDocument();
  });

  it("installs Marketplace items into the Library and lets users remove them", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "Marketplace" }));
    const paperCard = screen.getByRole("heading", { name: "Paper" }).closest("article");
    expect(paperCard).not.toBeNull();
    await user.click(within(paperCard!).getByRole("button", { name: "Install" }));
    expect(within(paperCard!).getByRole("button", { name: "In Library" })).toBeDisabled();

    await user.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: /Library/ }));
    expect(screen.getByRole("heading", { name: "Paper" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Paper" }));
    expect(screen.queryByRole("heading", { name: "Paper" })).not.toBeInTheDocument();
  });

  it("starts Marketplace publishing through customization chat", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "Marketplace" }));
    await user.click(screen.getAllByRole("button", { name: /Share yours/ })[0]);

    expect(screen.getByRole("heading", { name: "Customize Blackbox in chat" })).toBeInTheDocument();
    expect((screen.getByLabelText("Chat message") as HTMLTextAreaElement).value).toContain("Marketplace");
  });

  it("uses custom dropdowns and remembers composer preferences", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "Thinking: Medium" }));
    const thinkingMenu = screen.getByRole("listbox", { name: "Thinking" });
    await user.click(within(thinkingMenu).getByRole("option", { name: /High/ }));
    await user.click(screen.getByRole("button", { name: "Permissions: Ask when needed" }));
    await user.click(within(screen.getByRole("listbox", { name: "Permissions" })).getByRole("option", { name: /Never ask/ }));
    await user.click(screen.getByRole("button", { name: "Fast mode" }));

    expect(screen.getByRole("button", { name: "Thinking: High" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permissions: Never ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fast mode" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(JSON.parse(localStorage.getItem("blackbox-composer-preferences-v1") ?? "{}")).toMatchObject({ effort: "high", approvalPolicy: "never", fastMode: true }));
  });

  it("offers rename, customization, and remove options from project context menus", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await waitFor(() => expect(hasMockSocket()).toBe(true));
    act(() => takeLatestSocketOffline());
    await screen.findAllByRole("button", { name: "Build the command palette" });
    const project = document.querySelector<HTMLButtonElement>(".project-list .workspace-row");
    expect(project).not.toBeNull();

    fireEvent.contextMenu(project!, { clientX: 80, clientY: 120 });
    const menu = screen.getByRole("menu", { name: "Project options" });
    expect(within(menu).getByRole("menuitem", { name: "Customize project" })).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Rename project" }));

    const input = screen.getByRole("textbox", { name: "project name" });
    await user.clear(input);
    await user.type(input, "Client work");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const renamed = screen.getByText("Client work").closest("button");
    expect(renamed).not.toBeNull();

    fireEvent.contextMenu(renamed!, { clientX: 80, clientY: 120 });
    await user.click(within(screen.getByRole("menu", { name: "Project options" })).getByRole("menuitem", { name: "Remove from sidebar" }));
    expect(screen.queryByText("Client work")).not.toBeInTheDocument();
  });

  it("offers chat options from the right-click menu", async () => {
    render(<Workspace />);
    await waitFor(() => expect(hasMockSocket()).toBe(true));
    act(() => takeLatestSocketOffline());

    const chat = (await screen.findAllByRole("button", { name: "Build the command palette" }))[0];
    fireEvent.contextMenu(chat, { clientX: 96, clientY: 140 });

    const menu = screen.getByRole("menu", { name: "Chat options" });
    expect(within(menu).getByRole("menuitem", { name: "Rename chat" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Archive chat" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Customize chat" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Remove from sidebar" })).not.toBeInTheDocument();
  });

  it("shows five chats at a time and provides custom ordering controls", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await waitFor(() => expect(hasMockSocket()).toBe(true));
    act(() => takeLatestSocketOffline());

    expect(await screen.findByRole("button", { name: "Project chat order: Recently updated" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Persist composer drafts" })).not.toBeInTheDocument();
    const showMoreButtons = screen.getAllByRole("button", { name: /Show 5 more/ });
    await user.click(showMoreButtons[0]);
    expect(screen.getByRole("button", { name: "Persist composer drafts" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Project chat order: Recently updated" }));
    await user.click(within(screen.getByRole("listbox", { name: "Project chat order" })).getByRole("option", { name: /Title A–Z/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("blackbox-workspace-session-v1") ?? "{}")).toMatchObject({ chatSort: "title-asc" }));
  });

  it("restores model, thinking, permissions, and Fast mode after a refresh", async () => {
    localStorage.setItem("blackbox-composer-preferences-v1", JSON.stringify({
      model: "saved-model",
      effort: "high",
      approvalPolicy: "never",
      fastMode: true,
    }));

    render(<Workspace />);

    expect(await screen.findByRole("button", { name: "Model: saved-model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thinking: High" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permissions: Never ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fast mode" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the active view and typed draft after a refresh", async () => {
    localStorage.setItem("blackbox-workspace-session-v1", JSON.stringify({
      view: "chat",
      chatIntent: "customize",
      activeThreadId: null,
      selectedProjectCwd: "Preview",
      prompt: "Keep this unsent theme draft",
      messages: [],
      activity: [],
      expandedProjects: [],
      recentsExpanded: true,
      chatSort: "recent",
      projectVisibleCounts: {},
      recentVisibleCount: 5,
      searchQuery: "",
    }));

    render(<Workspace />);

    expect(await screen.findByRole("heading", { name: "Customize Blackbox in chat" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue("Keep this unsent theme draft");
  });

  it("persists draft input immediately before an instant reload", async () => {
    const user = userEvent.setup();
    const firstRender = render(<Workspace />);
    const composer = screen.getByRole("textbox", { name: "Chat message" });
    await user.type(composer, "Instantly saved draft");
    expect(localStorage.getItem("blackbox-current-draft-v1")).toBe("Instantly saved draft");

    firstRender.unmount();
    render(<Workspace />);

    expect(await screen.findByRole("textbox", { name: "Chat message" })).toHaveValue("Instantly saved draft");
  });

  it("creates concise local titles without spending another model call", () => {
    expect(titleFromPrompt("Please fix theme flickering on refresh. Keep the draft intact.")).toBe("fix theme flickering on refresh");
    expect(titleFromPrompt("Build a very long sidebar improvement that keeps every single chat visible while also making the ordering controls easy to understand for everybody").length).toBeLessThanOrEqual(64);
  });
});
