const express = require('express');
const Announcement = require('../models/Announcement');
const Club = require('../models/Club');
const User = require('../models/User');
const { verifyToken } = require('./auth');

const router = express.Router();

// @route   GET /api/announcements/club/:clubId
// @desc    Get all announcements for a club
// @access  Public
router.get('/club/:clubId', async (req, res) => {
    try {
        const { clubId } = req.params;
        const {
            page = 1,
            limit = 10,
            type = 'all',
            priority = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Verify club exists and populate members
        const club = await Club.findById(clubId).populate('members.user', '_id role');
        if (!club) {
            return res.status(404).json({ message: 'Club not found' });
        }

        // If user is authenticated, check membership and role
        if (req.user) {
            const member = club.members.find(m => m.user._id.toString() === req.user._id.toString());
            if (!member || req.user.role !== 'Student') {
                return res.status(403).json({ message: 'Only club members who are students can view announcements.' });
            }
        }

        const announcements = await Announcement.getActiveAnnouncements(clubId, {
            page: parseInt(page),
            limit: parseInt(limit),
            type,
            priority,
            sortBy,
            sortOrder
        });

        const total = await Announcement.countDocuments({
            club: clubId,
            isActive: true,
            $or: [
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: new Date() } }
            ]
        });

        res.json({
            announcements,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total,
            hasMore: page * limit < total
        });
    } catch (error) {
        console.error('Get club announcements error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/announcements/club/:clubId
// @desc    Create new announcement for a club
// @access  Private (Club members with appropriate permissions)
router.post('/club/:clubId', verifyToken, async (req, res) => {
    try {
        const { clubId } = req.params;
        const {
            title,
            content,
            type = 'General',
            priority = 'Normal',
            isPinned = false,
            tags = [],
            attachments = [],
            scheduledFor,
            expiresAt
        } = req.body;

        // Verify club exists
        const club = await Club.findById(clubId).populate('members.user', '_id name email');
        if (!club) {
            return res.status(404).json({ message: 'Club not found' });
        }

        // Check if user has permission to create announcements
        // Priority: Club President > Club Officers > System Admin > Specific Club Admin
        const isClubPresident = club.president && club.president.toString() === req.user._id.toString();
        const isSystemAdmin = req.user.role === 'Administrator';

        // Check if user is a club member with officer privileges
        const userMembership = club.members.find(member =>
            member.user._id.toString() === req.user._id.toString()
        );

        const isClubOfficer = userMembership &&
            ['President', 'Vice President', 'Officer', 'Secretary'].includes(userMembership.role);

        // Check if user is a Club Admin who manages this specific club (is the president)
        const isSpecificClubAdmin = req.user.role === 'Club Admin' && isClubPresident;

        const canCreateAnnouncements = isClubPresident || isSystemAdmin || isClubOfficer || isSpecificClubAdmin; if (!canCreateAnnouncements) {
            return res.status(403).json({ message: 'Insufficient permissions to create announcements' });
        }

        // Create announcement
        const announcement = new Announcement({
            club: clubId,
            author: req.user._id,
            title,
            content,
            type,
            priority,
            isPinned,
            tags,
            attachments,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined
        });

        await announcement.save();

        const populatedAnnouncement = await Announcement.findById(announcement._id)
            .populate('author', 'name email major year')
            .populate('comments.author', 'name email')
            .populate('likes.user', 'name');

        res.status(201).json({
            message: 'Announcement created successfully',
            announcement: populatedAnnouncement
        });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/announcements/:id
// @desc    Get specific announcement details
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('author', 'name email major year')
            .populate('club', 'name')
            .populate('comments.author', 'name email')
            .populate('likes.user', 'name');

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Increment view count
        announcement.views += 1;
        await announcement.save();

        res.json({ announcement });
    } catch (error) {
        console.error('Get announcement error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private (Author or admins only)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Check permissions
        const canModify = await announcement.canUserModify(req.user._id, req.user.role);
        if (!canModify) {
            return res.status(403).json({ message: 'Not authorized to update this announcement' });
        }

        const {
            title,
            content,
            type,
            priority,
            isPinned,
            tags,
            attachments,
            scheduledFor,
            expiresAt,
            isActive
        } = req.body;

        // Update fields
        if (title !== undefined) announcement.title = title;
        if (content !== undefined) announcement.content = content;
        if (type !== undefined) announcement.type = type;
        if (priority !== undefined) announcement.priority = priority;
        if (isPinned !== undefined) announcement.isPinned = isPinned;
        if (tags !== undefined) announcement.tags = tags;
        if (attachments !== undefined) announcement.attachments = attachments;
        if (scheduledFor !== undefined) announcement.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
        if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
        if (isActive !== undefined) announcement.isActive = isActive;

        await announcement.save();

        const updatedAnnouncement = await Announcement.findById(announcement._id)
            .populate('author', 'name email major year')
            .populate('comments.author', 'name email')
            .populate('likes.user', 'name');

        res.json({
            message: 'Announcement updated successfully',
            announcement: updatedAnnouncement
        });
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private (Author or admins only)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Check permissions
        const canModify = await announcement.canUserModify(req.user._id, req.user.role);
        if (!canModify) {
            return res.status(403).json({ message: 'Not authorized to delete this announcement' });
        }

        await Announcement.findByIdAndDelete(req.params.id);

        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/announcements/:id/like
// @desc    Like/Unlike announcement
// @access  Private
router.post('/:id/like', verifyToken, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        const isLiked = announcement.toggleLike(req.user._id);
        await announcement.save();

        res.json({
            message: isLiked ? 'Announcement liked' : 'Announcement unliked',
            isLiked,
            likeCount: announcement.likeCount
        });
    } catch (error) {
        console.error('Toggle like error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/announcements/:id/comment
// @desc    Add comment to announcement
// @access  Private
router.post('/:id/comment', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Comment content is required' });
        }

        announcement.addComment(req.user._id, content.trim());
        await announcement.save();

        const updatedAnnouncement = await Announcement.findById(announcement._id)
            .populate('comments.author', 'name email');

        const newComment = updatedAnnouncement.comments[updatedAnnouncement.comments.length - 1];

        res.status(201).json({
            message: 'Comment added successfully',
            comment: newComment
        });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/announcements/:id/comments/:commentId
// @desc    Edit comment
// @access  Private (Comment author only)
router.put('/:id/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        const comment = announcement.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user is the comment author
        if (comment.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to edit this comment' });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Comment content is required' });
        }

        comment.content = content.trim();
        comment.isEdited = true;
        comment.editedAt = new Date();

        await announcement.save();

        res.json({
            message: 'Comment updated successfully',
            comment
        });
    } catch (error) {
        console.error('Edit comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/announcements/:id/comments/:commentId
// @desc    Delete comment
// @access  Private (Comment author or announcement author or admins)
router.delete('/:id/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        const comment = announcement.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check permissions (comment author, announcement author, or authorized admin)
        const isCommentAuthor = comment.author.toString() === req.user._id.toString();
        const isAnnouncementAuthor = announcement.author.toString() === req.user._id.toString();
        const isSystemAdmin = req.user.role === 'Administrator';

        // Check if user is Club Admin and manages this specific club
        let isAuthorizedClubAdmin = false;
        if (req.user.role === 'Club Admin') {
            const club = await Club.findById(announcement.club);
            isAuthorizedClubAdmin = club && club.president && club.president.toString() === req.user._id.toString();
        }

        const canDelete = isCommentAuthor || isAnnouncementAuthor || isSystemAdmin || isAuthorizedClubAdmin;

        if (!canDelete) {
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }

        announcement.comments.pull(req.params.commentId);
        await announcement.save();

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/announcements/user/feed
// @desc    Get user's personalized announcement feed (from joined clubs)
// @access  Private
router.get('/user/feed', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        // Get user's clubs
        const userClubs = await Club.find({
            'members.user': req.user._id
        }).select('_id');

        const clubIds = userClubs.map(club => club._id);

        const announcements = await Announcement.find({
            club: { $in: clubIds },
            isActive: true,
            $or: [
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: new Date() } }
            ]
        })
            .populate('author', 'name email')
            .populate('club', 'name')
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Announcement.countDocuments({
            club: { $in: clubIds },
            isActive: true,
            $or: [
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: new Date() } }
            ]
        });

        res.json({
            announcements,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total,
            hasMore: page * limit < total
        });
    } catch (error) {
        console.error('Get user feed error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
