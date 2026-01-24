import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Helper to create date slots
  const createSlots = () => {
    const now = new Date();
    return JSON.stringify([
      new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    ]);
  };

  // Create sample clinics
  const clinics = await Promise.all([
    prisma.clinic.upsert({
      where: { id: 'clinic-1' },
      update: {},
      create: {
        id: 'clinic-1',
        name: 'Pediatric Urgent Care - Main St',
        address: '123 Main St, Boston, MA 02108',
        phone: '(617) 555-0123',
        latitude: 42.3601,
        longitude: -71.0589,
        openTime: '08:00',
        closeTime: '20:00',
        specialties: JSON.stringify(['Pediatrics', 'Urgent Care']),
        rating: 4.8,
        availableSlots: createSlots(),
      },
    }),
    prisma.clinic.upsert({
      where: { id: 'clinic-2' },
      update: {},
      create: {
        id: 'clinic-2',
        name: 'Kids First Medical Center',
        address: '456 Oak Ave, Boston, MA 02116',
        phone: '(617) 555-0456',
        latitude: 42.3505,
        longitude: -71.0776,
        openTime: '07:00',
        closeTime: '19:00',
        specialties: JSON.stringify(['Pediatrics', 'Family Medicine']),
        rating: 4.6,
        availableSlots: createSlots(),
      },
    }),
    prisma.clinic.upsert({
      where: { id: 'clinic-3' },
      update: {},
      create: {
        id: 'clinic-3',
        name: 'Community Health Pediatrics',
        address: '789 Elm Blvd, Cambridge, MA 02139',
        phone: '(617) 555-0789',
        latitude: 42.3736,
        longitude: -71.1097,
        openTime: '09:00',
        closeTime: '18:00',
        specialties: JSON.stringify(['Pediatrics']),
        rating: 4.4,
        availableSlots: createSlots(),
      },
    }),
  ]);

  console.log(`Created ${clinics.length} clinics`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
