import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { createSchema, deleteSchema, listSchemas } from '@/lib/db/schemas';
import { createEntry } from '@/lib/db/entries';
import type { EntryData, Field } from '@/lib/domain/types';

// Populate a fresh database with realistic, linked demo data so a clone has
// something to look at. Safe to re-run: it clears existing data first, then
// inserts, and it goes through the same typed repositories the app uses.
//
// Run with: npm run seed

/** Reset everything. `deleteSchema` cascades each schema's entries. */
function reset(): number {
  const existing = listSchemas();
  for (const schema of existing) deleteSchema(schema.id);
  return existing.length;
}

// Small field builders — the same discriminated `Field` union the app uses.
const textField = (name: string, required = false): Field => ({
  id: randomUUID(),
  name,
  type: 'text',
  required,
});
const numberField = (name: string): Field => ({
  id: randomUUID(),
  name,
  type: 'number',
  required: false,
});
const booleanField = (name: string): Field => ({
  id: randomUUID(),
  name,
  type: 'boolean',
  required: false,
});
const dateField = (name: string): Field => ({
  id: randomUUID(),
  name,
  type: 'date',
  required: false,
});
const referenceField = (name: string, targetSchemaId: string): Field => ({
  id: randomUUID(),
  name,
  type: 'reference',
  required: false,
  targetSchemaId,
});

function main() {
  const cleared = reset();

  // --- Person: text (required) + date + boolean ---
  const person = createSchema({
    name: 'Person',
    fields: [textField('name', true), dateField('birthday'), booleanField('isVerified')],
  });

  const peopleData: EntryData[] = [
    { name: 'Ada Lovelace', birthday: '1815-12-10', isVerified: true },
    { name: 'Alan Turing', birthday: '1912-06-23', isVerified: true },
    { name: 'Grace Hopper', birthday: '1906-12-09', isVerified: false },
    { name: 'Katherine Johnson', birthday: '1918-08-26', isVerified: true },
  ];
  const people = peopleData.map((data) =>
    createEntry({ schemaId: person.id, schemaVersion: person.version, data }),
  );

  // --- Car: text (required) + number + boolean + reference → Person ---
  const car = createSchema({
    name: 'Car',
    fields: [
      textField('brand', true),
      numberField('year'),
      booleanField('isElectric'),
      referenceField('owner', person.id),
    ],
  });

  const [ada, alan, grace] = people;
  const carsData: EntryData[] = [
    { brand: 'Tesla', year: 2022, isElectric: true, owner: ada.id },
    { brand: 'Toyota', year: 2018, isElectric: false, owner: alan.id },
    { brand: 'Rivian', year: 2023, isElectric: true, owner: grace.id },
    // One car with no owner, to show the optional / "None" reference case.
    { brand: 'Ford', year: 2015, isElectric: false, owner: null },
  ];
  const cars = carsData.map((data) =>
    createEntry({ schemaId: car.id, schemaVersion: car.version, data }),
  );

  const ownerless = cars.filter((c) => c.data.owner == null).length;

  console.log('✓ Seed complete.');
  console.log(`  Cleared ${cleared} existing schema(s).`);
  console.log(`  Person — 3 fields, ${people.length} entries`);
  console.log(
    `  Car    — 4 fields, ${cars.length} entries (${ownerless} without an owner)`,
  );

  db.close();
}

main();
