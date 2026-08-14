export type ChatCommand = "jobs" | "help" | "resume" | "unknown";

export function parseCommand(text: string): ChatCommand {
  const normalized = text.trim().toLowerCase().replace(/^\//, "");
  if (["jobs", "job", "my jobs", "next job", "next jobs"].includes(normalized)) return "jobs";
  if (["resume", "continue"].includes(normalized)) return "resume";
  if (["help", "commands", "start"].includes(normalized)) return "help";
  return "unknown";
}
