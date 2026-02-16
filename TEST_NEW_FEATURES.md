# New Features Testing Guide

## Prerequisites
1. Backend running on http://localhost:5000
2. Frontend running on http://localhost:5174 (or 5173)
3. Test accounts:
   - Participant: Any registered participant
   - Organizer: Any registered organizer
   - Admin: admin@felicity.iiit.ac.in / Admin@123

## Feature 1: Team Registration

### Test Steps:

1. **Login as Participant 1**
   - Navigate to a team-based event
   - Click "Create Team" button
   - Enter team name: "Test Team Alpha"
   - Set team size: 3
   - Submit

2. **Verify Team Creation**
   - Check team appears in "My Teams" page
   - Copy the 8-character invite code
   - Verify team status shows "Incomplete"

3. **Login as Participant 2 (different browser/incognito)**
   - Go to "My Teams" page
   - Paste invite code in "Join Team" input
   - Click "Join"
   - Verify success message

4. **Login as Participant 3**
   - Repeat step 3
   - After joining, team should show "Complete"
   - Verify registration is automatically created
   - Check that all 3 members have tickets with QR codes

5. **Test Restrictions**
   - Try joining with full team → Should fail
   - Try joining same event with multiple teams → Should fail
   - Try leaving completed team → Should fail

### API Testing:
```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"participant@test.com","password":"Test@123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create team (replace EVENT_ID with actual team event ID)
curl -X POST http://localhost:5000/api/teams/event/EVENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamName":"API Test Team","teamSize":2}'

# Get my teams
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/teams/my-teams

# Join team (replace INVITE_CODE)
curl -X POST http://localhost:5000/api/teams/join/INVITE_CODE \
  -H "Authorization: Bearer $TOKEN"
```

## Feature 2: Calendar Export

### Test Steps:

1. **Login as Participant**
   - Go to Dashboard
   - Click on any registered event ticket
   - On ticket page, look for "Add to Calendar" section

2. **Test .ics Download**
   - Click "Download .ics file" button
   - File should download with event name
   - Open with your calendar app (Google Calendar, Outlook, Apple Calendar)
   - Verify event details are correct:
     - Name
     - Date/Time
     - Location
     - Description
     - 1-hour reminder

3. **Test Google Calendar Link**
   - Click "Add to Google Calendar" button
   - Should open Google Calendar with pre-filled event
   - Click "Save" to add to calendar

4. **Test Outlook Link**
   - Click "Add to Outlook" button
   - Should open Outlook web with pre-filled event

5. **Test Batch Export**
   - Go to Dashboard
   - Select multiple registered events
   - Click "Export All to Calendar"
   - Download should contain all events in single .ics file

### API Testing:
```bash
# Get registration ID from dashboard or tickets
REGISTRATION_ID="your_registration_id_here"

# Get calendar links
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/registrations/$REGISTRATION_ID/calendar-links

# Download .ics file
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/registrations/$REGISTRATION_ID/calendar \
  -o event.ics

# Open event.ics with text editor to verify format

# Batch export (replace with your registration IDs)
curl -X POST http://localhost:5000/api/registrations/calendar/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"registrationIds":["REG_ID_1","REG_ID_2"]}' \
  -o events.ics
```

## Feature 3: Purchase/Register Fix

### Test Steps:

1. **Test Normal Event Registration**
   - Navigate to published normal event
   - Fill custom registration form (if any)
   - Click "Register"
   - Verify success message
   - Check ticket is generated with QR code

2. **Test Merchandise Purchase**
   - Navigate to merchandise event
   - Select variant (size/color)
   - Set quantity
   - Click "Purchase"
   - Upload payment proof image
   - Verify order status shows "Pending Approval"

3. **Test Payment Approval (as Organizer)**
   - Navigate to event registrations page
   - Go to "Payment Approvals" tab
   - View uploaded payment proof
   - Click "Approve"
   - Verify QR code is generated
   - Check stock is decremented

4. **Test CSV Export (as Organizer)**
   - Go to event registrations page
   - Click "Export CSV" button
   - Verify CSV downloads with all registration data
   - Open in Excel/Google Sheets to verify format

### Expected CSV Format:
```
Ticket ID,Name,Email,Status,Registered At,Attended
FEL-ABC12345,John Doe,john@example.com,confirmed,2026-02-08T10:30:00Z,false
```

## Feature 4: Discussion Forum

### Test Steps:

1. **Post Message (as Participant)**
   - Navigate to registered event details
   - Go to "Discussion" tab
   - Type message: "Looking forward to this event!"
   - Click "Send"
   - Verify message appears with your name

2. **Moderate Messages (as Organizer)**
   - Navigate to your event details
   - Go to "Discussion" tab
   - Click "Pin" on important message
   - Verify pinned badge appears
   - Click "Delete" on spam message
   - Verify message is removed

3. **Test Access Control**
   - Logout and view event as guest
   - Discussion tab should show "Login to view"
   - OR messages visible but no post button

## Feature 5: Export CSV

### Test Steps:

1. **Login as Organizer**
   - Navigate to your event
   - Click "View Registrations"
   - Click "Export CSV" button at top

2. **Verify CSV Contents**
   - Should include all registrations
   - Columns: Ticket ID, Name, Email, Phone, Status, Registered Date, Attended
   - For merchandise: Also include Variant, Quantity, Total Amount
   - For team events: Include Team Name

3. **Test Filters**
   - Apply status filter (e.g., only "confirmed")
   - Export CSV
   - Verify only filtered results in CSV

## Troubleshooting

### Team Registration Issues
- **Error: "Event not found"** → Check event ID is correct
- **Error: "This event does not support teams"** → Event must have `isTeamEvent: true`
- **Error: "Team size must be between X and Y"** → Check event's min/max team size
- **Error: "You already have a team"** → Leave/delete existing team first

### Calendar Export Issues
- **Download fails** → Check authorization token
- **Event not showing in calendar** → Verify .ics file format
- **Wrong timezone** → Currently hardcoded to Asia/Kolkata
- **Batch export empty** → Ensure registration IDs are valid and belong to user

### Purchase/Register Issues
- **"Registration is closed"** → Check deadline and status
- **"Event is fully booked"** → Check registration limit
- **"No next button"** → Fixed in latest update, refresh page
- **Payment proof upload fails** → Check file size (<5MB) and type (images only)

### CSV Export Issues
- **Empty CSV** → Check event has registrations
- **Missing columns** → Verify backend response includes all fields
- **Encoding issues** → Open with UTF-8 encoding

## Success Criteria

### Team Registration ✅
- [ ] Can create team with valid size
- [ ] Invite code is generated and shareable
- [ ] Team members can join via code
- [ ] Team completion triggers automatic registration
- [ ] All team members get QR tickets
- [ ] Can't join multiple teams for same event
- [ ] Can't exceed team size limit

### Calendar Export ✅
- [ ] .ics file downloads correctly
- [ ] File can be imported to Google Calendar
- [ ] File can be imported to Outlook
- [ ] Direct links work
- [ ] Batch export includes all events
- [ ] Event details are accurate
- [ ] Reminders are set correctly

### Purchase Fix ✅
- [ ] Normal registration works
- [ ] Merchandise purchase works
- [ ] Payment proof upload works
- [ ] Organizer can approve/reject
- [ ] QR generated only on approval
- [ ] Stock decrements correctly

### CSV Export ✅
- [ ] CSV downloads with correct data
- [ ] All columns present
- [ ] Data is properly formatted
- [ ] Excel/Google Sheets can open it
- [ ] Filters work correctly

## Performance Benchmarks

- Team creation: <500ms
- Join team: <300ms
- Calendar export: <200ms
- CSV export (100 records): <1s
- Discussion message post: <400ms

## Security Checks

- [ ] Can only create teams for events you're registered for
- [ ] Can only view your own teams
- [ ] Can only export your own registrations' calendars
- [ ] Can only moderate discussions for your events
- [ ] Can only export registrations for your events
- [ ] Payment proofs only visible to organizer/admin
