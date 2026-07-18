import { useMemo } from "react";
import { useQuery } from "urql";
import { FormField, Select } from "@storyforge/ui";

import { EntitiesDocument } from "../gql/graphql";

export interface EntitySelectFieldProps {
  campaignId: string;
  name: string;
  id: string;
  label?: string;
  defaultValue?: string | null;
}

// Picks the world-data Entity a map feature represents (KAN-116). Loads the
// campaign's entities up front rather than searching server-side — the
// existing Entities query already returns the whole campaign for the sidebar,
// so this adds no new server surface. Revisit if campaigns get large enough
// that the sidebar itself needs paging.
export function EntitySelectField({
  campaignId,
  name,
  id,
  label = "Entity",
  defaultValue,
}: EntitySelectFieldProps) {
  const [{ data, fetching }] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId },
    pause: !campaignId,
  });

  // Grouped by type so a long list stays navigable, and because type is what
  // drives marker colour on the map.
  const groups = useMemo(() => {
    const byType = new Map<string, { id: string; name: string }[]>();
    for (const entity of data?.entities ?? []) {
      const list = byType.get(entity.type) ?? [];
      list.push({ id: entity.id, name: entity.name });
      byType.set(entity.type, list);
    }
    return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <FormField label={label} htmlFor={id}>
      <Select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={fetching}
      >
        {/* Unlinked is a normal state, not a prompt to fix something. */}
        <option value="">None</option>
        {groups.map(([type, entities]) => (
          <optgroup key={type} label={type}>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </FormField>
  );
}
