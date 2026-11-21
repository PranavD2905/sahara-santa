import { Field } from "@/components/ui";
import { CURRENCIES, type GroupSettings } from "@/server/groups";

/** Shared by "New Group" and the Organizer's settings form. */
export function SettingsFields({ initial }: { initial?: Partial<GroupSettings> }) {
  return (
    <>
      <Field label="Group name" name="name" required maxLength={80} defaultValue={initial?.name} />
      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Currency</span>
          <select
            name="currency"
            defaultValue={initial?.currency ?? "INR"}
            className="field-input"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Field label="Budget min" name="budgetMin" type="number" min={1} step={1} inputMode="numeric" defaultValue={initial?.budgetMin ?? ""} />
        <Field label="Budget max" name="budgetMax" type="number" min={1} step={1} inputMode="numeric" defaultValue={initial?.budgetMax ?? ""} />
      </div>
      <Field
        label="Exchange Date"
        name="exchangeDate"
        type="date"
        defaultValue={initial?.exchangeDate ?? ""}
        hint="Optional for now; required before the Draw."
      />
    </>
  );
}
