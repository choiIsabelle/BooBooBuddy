/**
 * User Service - Centralized user database operations
 * Following DRY principles - all user DB operations go through here
 */

import prisma from "../db";

// Type-safe wrapper to work around TypeScript cache issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ============================================================================
// TYPES
// ============================================================================

export interface CreateUserInput {
  email: string;
  password: string; // In production, hash this before passing
  name?: string;
}

export interface UpdateUserInput {
  name?: string;
  isOnboarded?: boolean;
  onboardedAt?: Date;
  allergies?: string[];
  medicalConditions?: string[];
  preferredClinic?: string;
  location?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  isOnboarded: boolean;
  onboardedAt: Date | null;
  allergies: string[];
  medicalConditions: string[];
  preferredClinic: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// USER CRUD OPERATIONS
// ============================================================================

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput) {
  const user = await db.user.create({
    data: {
      email: input.email,
      password: input.password, // TODO: Hash password in production
      name: input.name || null,
    },
  });

  return transformUser(user);
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string) {
  const user = await db.user.findUnique({
    where: { email },
  });

  return user ? transformUser(user) : null;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string) {
  const user = await db.user.findUnique({
    where: { id },
  });

  return user ? transformUser(user) : null;
}

/**
 * Get user with password for authentication (internal use only)
 */
export async function getUserForAuth(email: string) {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      isOnboarded: true,
    },
  });
}

/**
 * Update user profile
 */
export async function updateUser(id: string, input: UpdateUserInput) {
  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.isOnboarded !== undefined) updateData.isOnboarded = input.isOnboarded;
  if (input.onboardedAt !== undefined) updateData.onboardedAt = input.onboardedAt;
  if (input.preferredClinic !== undefined) updateData.preferredClinic = input.preferredClinic;
  if (input.location !== undefined) updateData.location = input.location;
  
  // Store arrays as JSON strings
  if (input.allergies !== undefined) {
    updateData.allergies = JSON.stringify(input.allergies);
  }
  if (input.medicalConditions !== undefined) {
    updateData.medicalConditions = JSON.stringify(input.medicalConditions);
  }

  const user = await db.user.update({
    where: { id },
    data: updateData,
  });

  return transformUser(user);
}

/**
 * Complete user onboarding
 */
export async function completeOnboarding(
  id: string,
  data: {
    allergies?: string[];
    medicalConditions?: string[];
    preferredClinic?: string;
    location?: string;
  }
) {
  return updateUser(id, {
    ...data,
    isOnboarded: true,
    onboardedAt: new Date(),
  });
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers(options?: { 
  limit?: number; 
  offset?: number;
  includeConversations?: boolean;
}) {
  const users = await db.user.findMany({
    take: options?.limit || 50,
    skip: options?.offset || 0,
    orderBy: { createdAt: "desc" },
    include: options?.includeConversations ? {
      conversations: {
        include: {
          conversation: true,
        },
      },
    } : undefined,
  });

  return users.map(transformUser);
}

/**
 * Get user count
 */
export async function getUserCount() {
  return db.user.count();
}

/**
 * Delete user
 */
export async function deleteUser(id: string) {
  await db.user.delete({
    where: { id },
  });
}

/**
 * Check if email exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const count = await db.user.count({
    where: { email },
  });
  return count > 0;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform raw Prisma user to clean UserProfile
 */
function transformUser(user: {
  id: string;
  email: string;
  name: string | null;
  isOnboarded: boolean;
  onboardedAt: Date | null;
  allergies: string | null;
  medicalConditions: string | null;
  preferredClinic: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  password?: string;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isOnboarded: user.isOnboarded,
    onboardedAt: user.onboardedAt,
    allergies: parseJsonArray(user.allergies),
    medicalConditions: parseJsonArray(user.medicalConditions),
    preferredClinic: user.preferredClinic,
    location: user.location,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Parse JSON string to array, return empty array if invalid
 */
function parseJsonArray(jsonString: string | null): string[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
