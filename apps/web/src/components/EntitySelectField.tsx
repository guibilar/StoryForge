import { useMemo } from "react";
import { useQuery } from "urql";
import { FormField, Select } from "@storyforge/ui";

import { EntitiesDocument } from "../gql/graphql";
import type { EntityCategory } from "../gql/graphql";

export interface EntitySelectFieldProps {
  campaignId: string;
  name: string;
  id: string;
  label?: string;
  defaultValue?: string | null;
  // Restricts the picker to entities in one of these categories (e.g.
  // Marker->LOCATION, KAN-121; Territory->{ORGANIZATION, LOCATION},
  // KAN-122). Filtered client-side rather than via EntityFilter.category
  // (a single value server-side) since this component already loads the
  // whole campaign up front and a category allowlist is a small, static
  // set — no need for a second round trip or a list-valued filter arg.
  categories?: EntityCategory[];
  // Omits the "None" option and marks the native select required, for a
  // link that can't be unset (e.g. Relationship.sourceEntityId/targetEntityId,
  // KAN-123) as opposed to Marker/Territory's optional entityId.
  required?: boolean;
  // Uncontrolled by design (see defaultValue below) — this only lets a
  // caller observe the current selection (e.g. to look up the selected
  // entity's category for a dependent suggestion, KAN-123) without owning
  // the select's value itself.
  onChange?: (entityId: string) => void;
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
  categories,
  required,
  onChange,
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
      if (categories && !categories.includes(entity.category)) {
        continue;
      }
      const list = byType.get(entity.type) ?? [];
      list.push({ id: entity.id, name: entity.name });
      byType.set(entity.type, list);
    }
    return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, categories]);

  return (
    <FormField label={label} htmlFor={id}>
      <Select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={fetching}
        required={required}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      >
        {/* Unlinked is a normal state, not a prompt to fix something —
            except when required, where there's no valid "no selection". */}
        {required ? null : <option value="">None</option>}
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
