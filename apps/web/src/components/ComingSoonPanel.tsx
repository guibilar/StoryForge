export interface ComingSoonPanelProps {
  ticket?: string;
}

export function ComingSoonPanel({ ticket }: ComingSoonPanelProps) {
  if (!ticket) {
    return <p>Coming soon.</p>;
  }

  return <p>Coming soon — {ticket}.</p>;
}
