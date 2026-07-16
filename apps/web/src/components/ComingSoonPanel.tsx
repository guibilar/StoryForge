export interface ComingSoonPanelProps {
  ticket: string;
}

export function ComingSoonPanel({ ticket }: ComingSoonPanelProps) {
  return <p>Coming soon — {ticket}.</p>;
}
