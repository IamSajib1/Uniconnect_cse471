const express = require('express');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const Club = require('../models/Club');
const User = require('../models/User');
const { verifyToken, optionalAuth, requireRole } = require('./auth');

const router = express.Router();// @route   GET /api/events
// @desc    Get all events (with public/private access control)
// @access  Public (enhanced with optional authentication)
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            search,
            type,
            club,
            upcoming = 'true',
            page = 1,
            limit = 12,
            university
        } = req.query;

        let query = {};

        // Implement public/private event access control
        if (req.user) {
            // For authenticated users: show public events + private events from their university
            const userUniversityId = req.user.university?._id || req.user.university;
            query.$or = [
                { isPublic: true }, // All public events
                { isPublic: false, university: userUniversityId } // Private events from user's university
            ];
        } else {
            // For non-authenticated users: only show public events
            query.isPublic = true;
        }

        // Filter by university if specified
        if (university) {
            if (query.$or) {
                // Modify the existing $or condition to include university filter
                query.$or = query.$or.map(condition => ({
                    ...condition,
                    university: university
                }));
            } else {
                query.university = university;
            }
        }

        // Filter by event type
        if (type && type !== 'All') {
            query.eventType = type;
        }

        // Filter by club
        if (club) {
            query.club = club;
        }

        // Search functionality
        if (search) {
            const searchCondition = {
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };

            // Combine with existing query
            query = { $and: [query, searchCondition] };
        }

        // Filter upcoming events
        if (upcoming === 'true') {
            query.startDate = { $gte: new Date() };
        }

        const eventsRaw = await Event.find(query)
            .populate('club', 'name category university')
            .populate('university', 'name code location')
            .populate('attendees.user', 'name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ startDate: 1 });

        // Map isRegistrationRequired to registrationRequired for frontend compatibility
        const events = eventsRaw.map(event => {
            const obj = event.toObject();
            obj.registrationRequired = obj.isRegistrationRequired;
            return obj;
        });

        const total = await Event.countDocuments(query);

        res.json({
            events,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/events/managed
// @desc    Get events for clubs managed by the current user
// @access  Private
router.get('/managed', verifyToken, async (req, res) => {
    try {
        // First find clubs where user is president
        const Club = require('../models/Club');
        const managedClubs = await Club.find({ president: req.user._id });
        const clubIds = managedClubs.map(club => club._id);

        // Find events for those clubs
        const events = await Event.find({ club: { $in: clubIds } })
            .populate('club', 'name')
            .populate('attendees.user', 'name email')
            .populate('organizers', 'name email')
            .sort({ startDate: -1 });

        res.json({ events });
    } catch (error) {
        console.error('Get managed events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('club', 'name category description president university')
            .populate('university', 'name code location')
            .populate('attendees.user', 'name email profilePicture major year');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private (Club members only)
router.post('/', verifyToken, async (req, res) => {
    try {
        console.log('Incoming event creation request:', req.body);
        const {
            title,
            description,
            type,
            organizer,
            startDate,
            endDate,
            startTime,
            endTime,
            venue,
            capacity,
            registrationRequired,
            registrationDeadline,
            entryFee,
            requirements,
            contactInfo,
            tags,
            isPublic = true
        } = req.body;

        // Robustly map contactInfo to contactPerson
        let contactPerson = {};
        if (typeof contactInfo === 'string') {
            // If contactInfo is a string, use as name only
            contactPerson = { name: contactInfo };
        } else if (contactInfo && typeof contactInfo === 'object') {
            contactPerson = {
                name: contactInfo.name || '',
                email: contactInfo.email || '',
                phone: contactInfo.phone || ''
            };
        }

        // Check if user is authorized to create events for this club
        const club = await Club.findById(organizer).populate('university');
        console.log('Club found for organizer:', club);
        if (!club) {
            console.log('Club not found for organizer:', organizer);
            return res.status(404).json({ message: 'Club not found' });
        }

        // Verify club belongs to user's university
        const userUniversityId = req.user.university?._id || req.user.university;
        console.log('User university:', userUniversityId, 'Club university:', club.university._id);
        if (club.university._id.toString() !== userUniversityId.toString()) {
            console.log('Club university mismatch. User:', userUniversityId, 'Club:', club.university._id);
            return res.status(403).json({ message: 'You can only create events for clubs at your university' });
        }

        // Check authorization based on user role
        let authorized = false;

        if (req.user.role === 'Administrator') {
            authorized = true;
        } else if (req.user.role === 'Club Admin') {
            if (club.president && club.president.toString() === req.user._id.toString()) {
                authorized = true;
            }
        } else {
            const isMember = club.members.some(
                member => member.user.toString() === req.user._id.toString()
            );
            authorized = isMember;
        }

        console.log('Authorization result:', authorized, 'User role:', req.user.role);
        if (!authorized) {
            const roleMessage = req.user.role === 'Club Admin'
                ? 'You can only create events for clubs where you are the president'
                : 'You must be a member of the club to create events';
            console.log('Authorization failed:', roleMessage);
            return res.status(403).json({ message: roleMessage });
        }

        console.log('Creating event with data:', {
            title,
            description,
            eventType: type,
            club: organizer,
            university: club.university._id,
            startDate,
            endDate,
            startTime: startTime || '09:00',
            endTime: endTime || '17:00',
            venue: venue || 'TBD',
            maxAttendees: capacity,
            isRegistrationRequired: registrationRequired,
            registrationDeadline,
            registrationFee: entryFee || 0,
            requirements,
            contactPerson,
            tags,
            isPublic: isPublic,
            status: 'Published'
        });
        const event = new Event({
            title,
            description,
            eventType: type,
            club: organizer,
            university: club.university._id, // Associate event with university
            startDate,
            endDate,
            startTime: startTime || '09:00',
            endTime: endTime || '17:00',
            venue: venue || 'TBD',
            maxAttendees: capacity,
            isRegistrationRequired: registrationRequired,
            registrationDeadline,
            registrationFee: entryFee || 0,
            requirements,
            contactPerson,
            tags,
            isPublic: isPublic,
            status: 'Published' // Default to Published, not upcoming
        });

        try {
            await event.save();
            console.log('Event created and stored:', event);
        } catch (saveError) {
            console.error('Error saving event to DB:', saveError);
            return res.status(500).json({ message: 'Error saving event', error: saveError });
        }

        const populatedEvent = await Event.findById(event._id)
            .populate('club', 'name category')
            .populate('university', 'name code location')
            .populate('attendees.user', 'name email');

        res.status(201).json({
            message: 'Event created successfully',
            event: populatedEvent
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/events/:id/register
// @desc    Register for an event
// @access  Private
router.post('/:id/register', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('university', 'name code');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

    // University restriction removed: allow any user to register for any event

        // Check if registration is required
        if (!event.isRegistrationRequired) {
            return res.status(400).json({ message: 'Registration is not required for this event' });
        }

        // Check if registration deadline has passed
        if (event.registrationDeadline && new Date() > event.registrationDeadline) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        // Check if event is at capacity
        if (event.capacity && event.attendees.length >= event.capacity) {
            return res.status(400).json({ message: 'Event is at full capacity' });
        }

        // Check if user is already registered
        const isRegistered = event.attendees.some(
            attendee => attendee.user && attendee.user.toString() === req.user._id.toString()
        );

        if (isRegistered) {
            return res.status(400).json({ message: 'You are already registered for this event' });
        }

        // Add user to event attendees
        event.attendees.push({ user: req.user._id });
        await event.save();

        // Add event to user's attended events
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                eventsAttended: {
                    event: event._id,
                    attendedDate: new Date()
                }
            }
        });

        // Store registration in eventregistrations table with all required fields
        const EventRegistration = require('../models/EventRegistration');
        const user = await User.findById(req.user._id).populate('university', 'name');
        const eventTitle = event.title || 'Unknown Event';
        let universityName = (event.university && event.university.name) || (user.university && user.university.name);
        if (!universityName) {
            const University = require('../models/University');
            const uniDoc = await University.findById(event.university._id || event.university);
            universityName = uniDoc ? uniDoc.name : 'Unknown University';
        }
        // Check for duplicate registration in eventregistrations table
        const existingRegistration = await EventRegistration.findOne({ event: event._id, user: req.user._id });
        if (existingRegistration) {
            return res.status(400).json({ message: 'You are already registered for this event (eventregistrations).' });
        }
        try {
            const registration = new EventRegistration({
                event: event._id,
                eventTitle,
                user: req.user._id,
                studentName: user.name,
                university: user.university._id,
                universityName,
                registeredAt: new Date()
            });
            await registration.save();
        } catch (err) {
            console.error('Error saving to eventregistrations:', err);
            return res.status(500).json({ message: 'Failed to save registration.' });
        }

        return res.status(201).json({ message: 'Registered successfully', registration });
    } catch (error) {
        console.error('Register event error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Invalid registration data.' });
        }
        return res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
});

// @route   POST /api/events/:id/unregister
// @desc    Unregister from an event
// @access  Private
router.post('/:id/unregister', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if event has already started
        if (new Date() >= event.startDate) {
            return res.status(400).json({ message: 'Cannot unregister from an event that has already started' });
        }

        // Remove user from event attendees
        event.attendees = event.attendees.filter(
            attendee => attendee.toString() !== req.user._id.toString()
        );

        await event.save();

        // Remove event from user's attended events
        await User.findByIdAndUpdate(req.user._id, {
            $pull: {
                eventsAttended: { event: event._id }
            }
        });

        res.json({ message: 'Successfully unregistered from the event' });
    } catch (error) {
        console.error('Unregister event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/events/club/:clubId
// @desc    Get events by club
// @access  Public
router.get('/club/:clubId', async (req, res) => {
    try {
        const { upcoming = true, page = 1, limit = 12 } = req.query;
        let query = { club: req.params.clubId };

        // Filter upcoming events
        if (upcoming === 'true') {
            query.startDate = { $gte: new Date() };
        }

        const events = await Event.find(query)
            .populate('club', 'name category')
            .populate('university', 'name code location')
            .populate('attendees.user', 'name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ startDate: 1 });

        const total = await Event.countDocuments(query);

        res.json({
            events,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get club events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/events/:id
// @desc    Update event details (club president only)
// @access  Private
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('club');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if user is the club president or admin
        if (event.club?.president?.toString() !== req.user._id.toString() && req.user.role !== 'Administrator') {
            return res.status(403).json({ message: 'Not authorized to update this event' });
        }

        const {
            title, description, eventType, startDate, endDate, startTime, endTime,
            venue, maxAttendees, registrationFee, registrationDeadline,
            isRegistrationRequired, tags, poster
        } = req.body;

        // Update event fields
        if (title) event.title = title;
        if (description) event.description = description;
        if (eventType) event.eventType = eventType;
        if (startDate) event.startDate = startDate;
        if (endDate) event.endDate = endDate;
        if (startTime) event.startTime = startTime;
        if (endTime) event.endTime = endTime;
        if (venue) event.venue = venue;
        if (maxAttendees !== undefined) event.maxAttendees = maxAttendees;
        if (registrationFee !== undefined) event.registrationFee = registrationFee;
        if (registrationDeadline) event.registrationDeadline = registrationDeadline;
        if (isRegistrationRequired !== undefined) event.isRegistrationRequired = isRegistrationRequired;
        if (tags) event.tags = tags;
        if (poster) event.poster = poster;

        await event.save();

        const updatedEvent = await Event.findById(event._id)
            .populate('club', 'name')
            .populate('attendees.user', 'name email')
            .populate('organizers', 'name email');

        res.json({ event: updatedEvent });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/events/:id/attendees/:userId/attendance
// @desc    Mark attendee attendance (club president only)
// @access  Private
router.put('/:id/attendees/:userId/attendance', verifyToken, async (req, res) => {
    try {
        const { attended } = req.body;
        const event = await Event.findById(req.params.id).populate('club');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if user is the club president or admin
        if (event.club?.president?.toString() !== req.user._id.toString() && req.user.role !== 'Administrator') {
            return res.status(403).json({ message: 'Not authorized to mark attendance for this event' });
        }

        // Find attendee
        const attendee = event.attendees?.find(attendee =>
            attendee?.user?.toString() === req.params.userId
        );

        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found in this event' });
        }

        // Update attendance
        attendee.attended = attended;
        await event.save();

        const updatedEvent = await Event.findById(event._id)
            .populate('club', 'name')
            .populate('attendees.user', 'name email')
            .populate('organizers', 'name email');

        res.json({ event: updatedEvent });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/events/:id/attendees/:userId
// @desc    Remove attendee from event (club president only)
// @access  Private
router.delete('/:id/attendees/:userId', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('club');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if user is the club president or admin
        if (event.club?.president?.toString() !== req.user._id.toString() && req.user.role !== 'Administrator') {
            return res.status(403).json({ message: 'Not authorized to remove attendees from this event' });
        }

        // Find and remove attendee
        const attendeeIndex = event.attendees?.findIndex(attendee =>
            attendee?.user?.toString() === req.params.userId
        );

        if (attendeeIndex === -1) {
            return res.status(404).json({ message: 'Attendee not found in this event' });
        }

        event.attendees.splice(attendeeIndex, 1);
        await event.save();

        const updatedEvent = await Event.findById(event._id)
            .populate('club', 'name')
            .populate('attendees.user', 'name email')
            .populate('organizers', 'name email');

        res.json({ event: updatedEvent });
    } catch (error) {
        console.error('Remove attendee error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event (Administrator, Club President, or Event Organizer)
// @access  Private (Administrator, Club President, or Event Organizer)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('club');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if user is Administrator, club president, or event organizer
        const isAdmin = req.user.role === 'Administrator';
        const isClubPresident = event.club?.president?.toString() === req.user._id.toString();
        const isOrganizer = event.organizers && Array.isArray(event.organizers) &&
            event.organizers.some(org => org && org.toString && org.toString() === req.user._id.toString());

        // Debug logging
        console.log('Event delete authorization check:', {
            userId: req.user._id.toString(),
            userRole: req.user.role,
            eventId: event._id.toString(),
            eventTitle: event.title,
            clubId: event.club?._id?.toString(),
            clubPresidentId: event.club?.president?.toString(),
            organizers: event.organizers?.map(org => org.toString()),
            isAdmin,
            isClubPresident,
            isOrganizer
        });

        if (!isAdmin && !isClubPresident && !isOrganizer) {
            console.log('Access denied for event deletion');
            return res.status(403).json({
                message: 'Access denied. Only administrators, club presidents, or event organizers can delete events.'
            });
        }

        await Event.findByIdAndDelete(req.params.id);

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// =================
// REGISTER FOR EVENT
router.post('/:id/register', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('university', 'name code');
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Registration required check
        if (!event.isRegistrationRequired) {
            return res.status(400).json({ message: 'Registration is not required for this event' });
        }
        // Deadline check
        if (event.registrationDeadline && new Date() > event.registrationDeadline) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }
        // Capacity check
        const capacity = event.maxAttendees || event.capacity;
        if (capacity && event.attendees.length >= capacity) {
            return res.status(400).json({ message: 'Event is at full capacity' });
        }
        // Check for duplicate in event attendees
        const alreadyAttending = event.attendees.some(a => a.user.toString() === req.user._id.toString());
        if (alreadyAttending) {
            return res.status(409).json({ message: 'You have already registered for this event.' });
        }
        // Check for duplicate in eventregistrations
        const EventRegistration = require('../models/EventRegistration');
        const existingRegistration = await EventRegistration.findOne({ event: event._id, user: req.user._id });
        if (existingRegistration) {
            return res.status(409).json({ message: 'You have already registered for this event.' });
        }
        // Add user to event attendees
        event.attendees.push({ user: req.user._id });
        await event.save();
        // Store registration in eventregistrations
        const user = await User.findById(req.user._id).populate('university', 'name');
        const eventTitle = event.title || 'Unknown Event';
        let universityName = (event.university && event.university.name) || (user.university && user.university.name);
        if (!universityName) {
            const University = require('../models/University');
            const uniDoc = await University.findById(event.university._id || event.university);
            universityName = uniDoc ? uniDoc.name : 'Unknown University';
        }
        const registration = new EventRegistration({
            event: event._id,
            eventTitle,
            user: req.user._id,
            studentName: user.name,
            university: user.university._id,
            universityName,
            registeredAt: new Date()
        });
        await registration.save();
        return res.status(201).json({ message: 'Registered successfully', registration });
    } catch (error) {
        console.error('Register event error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Invalid registration data.' });
        }
        return res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
});

// ==================
// GET MY REGISTRATIONS
// ==================
router.get('/my-registrations', verifyToken, async (req, res) => {
  try {
    const myEvents = await Event.find({ "attendees.user": req.user._id })
      .populate('club', 'name category')
      .populate('university', 'name code location')
      .sort({ startDate: 1 });

    res.json(myEvents);
  } catch (error) {
    console.error('My registrations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================
// SUBMIT EVENT REVIEW
// ==================
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Only attendees can review
    const attended = event.attendees.some(a => a.user.toString() === req.user._id.toString() && a.attended);
    if (!attended) {
      return res.status(400).json({ message: 'You must attend the event before leaving a review' });
    }

    // Prevent duplicate review
    const alreadyReviewed = event.reviews.find(r => r.user.toString() === req.user._id.toString());
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You already reviewed this event' });
    }

    event.reviews.push({ user: req.user._id, rating, comment });
    await event.save();

    res.json({ message: 'Review added successfully', reviews: event.reviews });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================
// GET EVENT REVIEWS
// ==================
router.get('/:id/reviews', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('reviews.user', 'name profilePicture');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    res.json(event.reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Submit Review
router.post("/:id/review", async (req, res) => {
  const { rating, comment } = req.body;

  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });

    // Check if user attended/registered
    if (!event.registeredStudents.includes(req.user.id)) {
      return res.status(400).json({ msg: "You must register/attend before reviewing" });
    }

    // Prevent duplicate reviews
    const alreadyReviewed = event.reviews.find(r => r.user.toString() === req.user.id);
    if (alreadyReviewed) {
      return res.status(400).json({ msg: "You already reviewed this event" });
    }

    event.reviews.push({ user: req.user.id, rating, comment });
    await event.save();

    res.json({ msg: "Review submitted", reviews: event.reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
