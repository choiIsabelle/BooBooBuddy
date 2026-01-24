import { ToolCall } from '../schemas/llm-response';
import prisma from '../db';
import { parseJsonArray } from '../types';

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Tool executor - routes tool calls to appropriate handlers
export async function executeTool(
  toolCall: ToolCall,
  conversationId: string
): Promise<ToolResult> {
  // Log the tool call
  const toolCallRecord = await prisma.toolCall.create({
    data: {
      conversationId,
      toolName: toolCall.tool,
      toolInput: JSON.stringify(toolCall.params),
      status: 'PENDING',
    },
  });
  
  try {
    let result: ToolResult;
    
    switch (toolCall.tool) {
      case 'clinic_search':
        result = await executeClinicSearch(toolCall.params);
        break;
      case 'schedule_call':
        result = await executeScheduleCall(toolCall.params, conversationId);
        break;
      case 'escalate':
        result = await executeEscalate(toolCall.params, conversationId);
        break;
      default:
        result = { success: false, error: 'Unknown tool' };
    }
    
    // Update tool call record
    await prisma.toolCall.update({
      where: { id: toolCallRecord.id },
      data: {
        toolOutput: JSON.stringify(result),
        status: result.success ? 'SUCCESS' : 'FAILED',
      },
    });
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await prisma.toolCall.update({
      where: { id: toolCallRecord.id },
      data: {
        toolOutput: JSON.stringify({ error: errorMessage }),
        status: 'FAILED',
      },
    });
    
    return { success: false, error: errorMessage };
  }
}

// Clinic search tool
interface ClinicSearchParams {
  location: string;
  specialty?: string;
  urgency?: 'low' | 'medium' | 'high';
}

async function executeClinicSearch(params: ClinicSearchParams): Promise<ToolResult> {
  const { location, specialty, urgency } = params;
  
  // Query local database for clinics
  const clinics = await prisma.clinic.findMany({
    take: 5,
    orderBy: { rating: 'desc' },
  });
  
  // If no clinics in DB, return mock data for testing
  if (clinics.length === 0) {
    return {
      success: true,
      data: {
        clinics: getMockClinics(location, urgency),
        searchLocation: location,
      },
    };
  }
  
  // Parse specialties and filter
  const filteredClinics = specialty
    ? clinics.filter((c) => {
        const specialties = parseJsonArray<string>(c.specialties);
        return specialties.some((s) => s.toLowerCase().includes(specialty.toLowerCase()));
      })
    : clinics;
  
  return {
    success: true,
    data: {
      clinics: (filteredClinics.length > 0 ? filteredClinics : clinics).map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        rating: c.rating,
        specialties: parseJsonArray<string>(c.specialties),
        availableSlots: parseJsonArray<string>(c.availableSlots).slice(0, 3),
        distance: calculateMockDistance(),
      })),
      searchLocation: location,
    },
  };
}

// Schedule call tool
interface ScheduleCallParams {
  clinicId: string;
  preferredTime?: string;
  reason: string;
}

async function executeScheduleCall(
  params: ScheduleCallParams,
  conversationId: string
): Promise<ToolResult> {
  const { clinicId, preferredTime, reason } = params;
  
  // Simulate scheduling
  const appointmentTime = preferredTime
    ? new Date(preferredTime)
    : getNextAvailableSlot();
  
  // Update conversation with appointment
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      selectedClinicId: clinicId,
      appointmentTime,
    },
  });
  
  return {
    success: true,
    data: {
      confirmed: true,
      appointmentTime: appointmentTime.toISOString(),
      clinicId,
      reason,
      confirmationCode: generateConfirmationCode(),
      message: `Your call has been scheduled for ${appointmentTime.toLocaleString()}`,
    },
  };
}

// Escalate tool
interface EscalateParams {
  reason: string;
  urgency: 'immediate' | 'soon' | 'routine';
}

async function executeEscalate(
  params: EscalateParams,
  conversationId: string
): Promise<ToolResult> {
  const { reason, urgency } = params;
  
  // Update conversation state
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { state: 'ESCALATED' },
  });
  
  // Log escalation
  console.log(`[ESCALATION] Conversation ${conversationId}`);
  console.log(`  Urgency: ${urgency}`);
  console.log(`  Reason: ${reason}`);
  
  if (urgency === 'immediate') {
    console.log('  ACTION: Paging on-call nurse');
  }
  
  return {
    success: true,
    data: {
      escalated: true,
      urgency,
      reason,
      ticketId: `ESC-${Date.now()}`,
      message: urgency === 'immediate'
        ? 'A nurse will call you within 5 minutes. If this is a life-threatening emergency, please call 911.'
        : 'Your case has been escalated. A team member will reach out shortly.',
    },
  };
}

// Helper functions
function getMockClinics(location: string, _urgency?: string) {
  const baseTime = new Date();
  const slots = [
    new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    new Date(baseTime.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  ];
  
  return [
    {
      id: 'clinic-1',
      name: 'Pediatric Urgent Care - Main St',
      address: `123 Main St, ${location}`,
      phone: '(555) 123-4567',
      rating: 4.8,
      specialties: ['Pediatrics', 'Urgent Care'],
      availableSlots: slots,
      distance: 1.2,
    },
    {
      id: 'clinic-2',
      name: 'Kids First Medical Center',
      address: `456 Oak Ave, ${location}`,
      phone: '(555) 234-5678',
      rating: 4.6,
      specialties: ['Pediatrics', 'Family Medicine'],
      availableSlots: slots.slice(1),
      distance: 2.5,
    },
    {
      id: 'clinic-3',
      name: 'Community Health Pediatrics',
      address: `789 Elm Blvd, ${location}`,
      phone: '(555) 345-6789',
      rating: 4.4,
      specialties: ['Pediatrics'],
      availableSlots: [slots[2]],
      distance: 3.8,
    },
  ];
}

function calculateMockDistance(): number {
  return Math.round((Math.random() * 5 + 0.5) * 10) / 10;
}

function getNextAvailableSlot(): Date {
  const now = new Date();
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

function generateConfirmationCode(): string {
  return `BB${Date.now().toString(36).toUpperCase()}`;
}
