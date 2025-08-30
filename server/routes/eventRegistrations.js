const express = require('express');
const router = express.Router();
const EventRegistration = require('../models/EventRegistration');
const { verifyToken } = require('./auth');

// @route   POST /api/event-registrations
// @desc    Register a user for an event (store registration data)
// @access  Private
router.post('/', verifyToken, async (req, res) => {
    try {
        const { eventId, userId } = req.body;
        if (!eventId || !userId) {
            return res.status(400).json({ message: 'Event ID and User ID are required.' });
        }
        const registration = new EventRegistration({ event: eventId, user: userId });
        await registration.save();
        res.status(201).json({ message: 'Registration saved successfully.', registration });
    } catch (error) {
        console.error('Error saving registration:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/event-registrations
// @desc    Fetch all event registrations
// @access  Private (could be public if needed)
router.get('/', verifyToken, async (req, res) => {
    try {
        const registrations = await EventRegistration.find()
            .populate('event', 'title')
            .populate('user', 'name email')
            .populate('university', 'name');

        // Format output to show studentName, university name, and event title
        const formatted = registrations.map(r => ({
            studentName: r.studentName,
            university: r.university?.name,
            event: r.event?.title,
            registeredAt: r.registeredAt
        }));
        res.json({ registrations: formatted });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
