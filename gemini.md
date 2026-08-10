# Gemini Project Constitution & Data Schema

## Data Schema (Input / Output)

### Tour Package Schema (`/data/packages.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TourPackage",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },
    "category": { "type": "string", "enum": ["group", "bike", "festival", "trek", "women", "offbeat"] },
    "duration": { "type": "string" },
    "startingPrice": { "type": "number" },
    "currency": { "type": "string", "default": "INR" },
    "heroImage": { "type": "string" },
    "gallery": { "type": "array", "items": { "type": "string" } },
    "description": { "type": "string" },
    "itinerary": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "day": { "type": "integer" },
          "title": { "type": "string" },
          "details": { "type": "string" }
        },
        "required": ["day", "title", "details"]
      }
    },
    "inclusions": { "type": "array", "items": { "type": "string" } },
    "exclusions": { "type": "array", "items": { "type": "string" } },
    "upcomingBatches": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "startDate": { "type": "string" },
          "endDate": { "type": "string" },
          "slotsLeft": { "type": "integer" }
        }
      }
    }
  },
  "required": ["id", "title", "category", "duration", "startingPrice", "heroImage"]
}
```

### Booking Payload Schema (`/data/bookings.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BookingRequest",
  "type": "object",
  "properties": {
    "bookingId": { "type": "string" },
    "packageId": { "type": "string" },
    "customerName": { "type": "string" },
    "email": { "type": "string" },
    "phone": { "type": "string" },
    "travelersCount": { "type": "integer" },
    "selectedBatch": { "type": "string" },
    "specialRequests": { "type": "string" },
    "timestamp": { "type": "string" },
    "status": { "type": "string", "enum": ["pending", "confirmed", "cancelled"], "default": "pending" }
  },
  "required": ["bookingId", "packageId", "customerName", "email", "phone", "travelersCount"]
}
```

## Behavioral Rules & Invariants
- Deterministic logic over probabilistic LLM execution for business rules.
- All intermediate workbench operations saved in `.tmp/`.
- SOPs in `architecture/` updated prior to code updates.
- All secrets/keys managed via `.env`.
- Responsive, mobile-first, high-performance UI using vanilla CSS & JS without broken links.
- High visual aesthetics: rich typography, dark accent tones, smooth carousels, and responsive modals.

## Maintenance Log
- Initialized Project Constitution: 2026-07-30
- Defined Data Schema for Tour Packages and Booking Requests: 2026-07-30

