# BooBooBuddy Appointment Booking Flow

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant UI as 💻 Chat Interface
    participant LLM as 🤖 LLM (GPT-4o-mini)
    participant WF as ⚙️ Workflow Engine
    participant GP as 🗺️ Google Places API
    participant TW as 📞 Twilio
    participant C as 🏥 Clinic

    %% Initial Conversation
    Note over U,C: Phase 1: Symptom Collection
    U->>UI: "My throat really hurts and I have a fever"
    UI->>LLM: Process message + conversation history
    LLM->>WF: Update state: COLLECTING_SYMPTOMS
    WF->>LLM: Generate follow-up questions
    LLM-->>UI: "How long have you had these symptoms?"
    UI-->>U: Display response + triage indicator (25%)

    U->>UI: "Since yesterday, getting worse"
    UI->>LLM: Process with symptom context
    LLM->>WF: Update state: ASSESSING_SEVERITY
    WF->>LLM: Evaluate urgency level
    LLM-->>UI: "Any difficulty breathing or swallowing?"
    UI-->>U: Display response + triage indicator (50%)

    U->>UI: "Swallowing is painful but I can breathe fine"
    UI->>LLM: Sufficient symptoms collected
    LLM->>WF: Trigger: SEARCH_CLINICS
    
    %% Location & Clinic Search
    Note over U,C: Phase 2: Clinic Discovery
    WF->>UI: Request user location
    UI->>U: Geolocation prompt
    U-->>UI: Allow location access
    UI->>GP: searchNearbyPlaces(lat, lng, "walk-in clinic")
    GP-->>UI: Return nearby clinics with details
    UI-->>U: Display clinic carousel + triage indicator (75%)

    %% Initial Clinic Call
    Note over U,C: Phase 3: Automated Inquiry Call
    U->>UI: Click "📞 Call with Buddy" on clinic card
    UI->>LLM: Synthesize symptoms for call
    LLM-->>UI: "sore throat with fever and painful swallowing"
    UI->>TW: POST /call-clinic (inquiry)
    TW->>C: Automated call: "Patient experiencing sore throat..."
    
    Note over TW,C: Call in progress...
    C-->>TW: "We require appointments. Available 2-5 PM today"
    TW-->>TW: Record & transcribe response
    
    UI->>TW: Poll for transcript
    TW-->>UI: Return transcription text
    UI->>LLM: Analyze transcript
    LLM-->>UI: {appointmentsOnly: true, availableTimeRange: {start: "2:00 PM", end: "5:00 PM"}}
    
    %% Time Slot Selection
    Note over U,C: Phase 4: Time Slot Selection
    UI->>UI: Generate 30-min slots: [2:00, 2:30, 3:00, 3:30, 4:00, 4:30, 5:00]
    UI-->>U: Display time slot buttons
    U->>UI: Click "3:30 PM"
    
    %% Booking Call
    Note over U,C: Phase 5: Booking Confirmation Call
    UI->>TW: POST /call-clinic (booking, time: "3:30 PM")
    TW->>C: "Calling to book appointment for 3:30 PM..."
    
    Note over TW,C: Booking call in progress...
    C-->>TW: "Confirmed for 3:30 PM. Bring health card."
    TW-->>TW: Record & transcribe response
    
    UI->>TW: Poll for transcript
    TW-->>UI: Return transcription text
    UI->>LLM: Analyze booking response
    LLM-->>UI: {bookingConfirmed: true, confirmedTimeSlot: "3:30 PM"}
    
    %% Confirmation
    Note over U,C: Phase 6: Confirmation Display
    UI-->>U: ✅ "Appointment Booked! 3:30 PM at [Clinic Name]"
    UI-->>U: Display additional info: "Bring health card"
    WF->>WF: Update state: BOOKING_COMPLETE
```

## State Transitions

```mermaid
stateDiagram-v2
    [*] --> GREETING: User opens chat
    GREETING --> COLLECTING_SYMPTOMS: User describes issue
    COLLECTING_SYMPTOMS --> ASSESSING_SEVERITY: Enough symptoms gathered
    ASSESSING_SEVERITY --> SEARCHING_CLINICS: Non-emergency, needs care
    ASSESSING_SEVERITY --> EMERGENCY: Life-threatening symptoms
    SEARCHING_CLINICS --> PRESENTING_OPTIONS: Clinics found
    PRESENTING_OPTIONS --> CALLING_CLINIC: User clicks "Call with Buddy"
    CALLING_CLINIC --> ANALYZING_RESPONSE: Transcript received
    ANALYZING_RESPONSE --> WALK_IN_AVAILABLE: Clinic accepts walk-ins
    ANALYZING_RESPONSE --> BOOKING_AVAILABLE: Appointments required
    BOOKING_AVAILABLE --> TIME_SLOT_SELECTION: Time slots extracted
    TIME_SLOT_SELECTION --> BOOKING_CALL: User selects time
    BOOKING_CALL --> ANALYZING_BOOKING: Transcript received
    ANALYZING_BOOKING --> BOOKING_COMPLETE: Appointment confirmed
    ANALYZING_BOOKING --> BOOKING_FAILED: Booking declined
    WALK_IN_AVAILABLE --> [*]: User goes to clinic
    BOOKING_COMPLETE --> [*]: Appointment scheduled
    BOOKING_FAILED --> PRESENTING_OPTIONS: Try another clinic
    EMERGENCY --> [*]: User calls 911
```

## Component Interactions

```mermaid
flowchart TB
    subgraph Frontend["💻 Frontend (Next.js)"]
        Chat[Chat Interface]
        Carousel[Clinic Carousel]
        Card[Clinic Card]
        Modal[Call Status Modal]
        Slots[Time Slot Grid]
    end

    subgraph Backend["⚙️ Backend APIs"]
        ChatAPI["/api/chat"]
        CallAPI["/api/twilio/call-clinic"]
        TranscriptAPI["/api/twilio/get-transcript"]
        AnalyzeAPI["/api/twilio/analyze-transcript"]
    end

    subgraph External["🌐 External Services"]
        OpenRouter[OpenRouter LLM]
        GooglePlaces[Google Places API]
        Twilio[Twilio Voice API]
    end

    subgraph Clinic["🏥 Clinic"]
        Phone[Clinic Phone]
    end

    Chat -->|User message| ChatAPI
    ChatAPI -->|Generate response| OpenRouter
    ChatAPI -->|Find clinics| GooglePlaces
    GooglePlaces -->|Clinic data| Carousel
    
    Card -->|Initiate call| CallAPI
    CallAPI -->|Make call| Twilio
    Twilio -->|Outbound call| Phone
    Phone -->|Voice response| Twilio
    
    Modal -->|Poll status| TranscriptAPI
    TranscriptAPI -->|Get recording| Twilio
    TranscriptAPI -->|Transcription| AnalyzeAPI
    AnalyzeAPI -->|Extract info| OpenRouter
    
    AnalyzeAPI -->|Walk-in OK| Modal
    AnalyzeAPI -->|Appointments only| Slots
    Slots -->|User selects time| CallAPI
```

## Data Flow Summary

| Phase | User Action | System Response | State Change |
|-------|------------|-----------------|--------------|
| 1 | Describes symptoms | Follow-up questions | COLLECTING → ASSESSING |
| 2 | Provides details | Clinic search triggered | ASSESSING → SEARCHING |
| 3 | Views clinic options | Carousel displayed | SEARCHING → PRESENTING |
| 4 | Clicks "Call with Buddy" | Twilio inquiry call | PRESENTING → CALLING |
| 5 | Waits for response | Transcript analysis | CALLING → ANALYZING |
| 6 | Sees available times | Time slots displayed | ANALYZING → SLOT_SELECTION |
| 7 | Selects "3:30 PM" | Booking call initiated | SLOT_SELECTION → BOOKING |
| 8 | Waits for confirmation | Booking confirmed | BOOKING → COMPLETE |

## Key API Payloads

### Inquiry Call Request
```json
{
  "clinicPhone": "+16135551234",
  "clinicName": "Wateridge Medical Clinic",
  "symptoms": "sore throat with fever and painful swallowing",
  "isBookingCall": false
}
```

### Transcript Analysis Response (Appointments Required)
```json
{
  "summary": "Clinic requires appointments, available between 2-5 PM today",
  "acceptsWalkIns": false,
  "appointmentsOnly": true,
  "availableTimeRange": {
    "start": "2:00 PM",
    "end": "5:00 PM",
    "date": "today"
  },
  "canBook": true
}
```

### Booking Call Request
```json
{
  "clinicPhone": "+16135551234",
  "clinicName": "Wateridge Medical Clinic",
  "symptoms": "sore throat with fever and painful swallowing",
  "isBookingCall": true,
  "requestedTime": "3:30 PM"
}
```

### Booking Confirmation Response
```json
{
  "summary": "Appointment confirmed for 3:30 PM, bring health card",
  "bookingConfirmed": true,
  "confirmedTimeSlot": "3:30 PM",
  "additionalInfo": "Please bring your health card and arrive 10 minutes early"
}
```
