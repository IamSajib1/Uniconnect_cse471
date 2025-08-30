import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Alert,
    Fab,
    Menu,
    ListItemIcon,
    ListItemText,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    PushPin as PinIcon,
    MoreVert as MoreVertIcon,
    Campaign as AnnouncementIcon,
    Schedule as ScheduleIcon,
    PriorityHigh as PriorityIcon
} from '@mui/icons-material';
import { useAuth } from '../../../auth/context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';

const AnnouncementsTab = ({ clubs, refreshData }) => {
    const { token } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createDialog, setCreateDialog] = useState(false);
    const [editDialog, setEditDialog] = useState({ open: false, announcement: null });
    const [selectedClub, setSelectedClub] = useState(clubs.length > 0 ? clubs[0]._id : '');
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

    const [formData, setFormData] = useState({
        club: '',
        title: '',
        content: '',
        type: 'General',
        priority: 'Normal',
        isPinned: false,
        scheduledFor: '',
        tags: []
    });

    const [errors, setErrors] = useState({});

    const announcementTypes = ['General', 'Event', 'Important', 'Urgent', 'Achievement'];
    const priorities = ['Low', 'Normal', 'High', 'Urgent'];

    // Fetch announcements for all clubs
    const fetchAllAnnouncements = useCallback(async () => {
        if (!clubs || clubs.length === 0 || !token) return;
        setLoading(true);
        try {
            let allAnnouncements = [];
            for (const club of clubs) {
                const response = await axios.get(`/api/announcements/club/${club._id}?page=1&limit=20`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.announcements) {
                    allAnnouncements = allAnnouncements.concat(response.data.announcements);
                }
            }
            // Optionally sort by createdAt descending
            allAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setAnnouncements(allAnnouncements);
        } catch (error) {
            console.error('Error fetching announcements:', error);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    }, [clubs, token]);

    useEffect(() => {
        fetchAllAnnouncements();
    }, [clubs, fetchAllAnnouncements]);

    // Handle form submission
    const handleSubmit = async () => {
        try {
            const payload = {
                ...formData,
                club: formData.club || selectedClub,
                tags: formData.tags.filter(tag => tag.trim() !== '')
            };

            if (editDialog.open) {
                await axios.put(`/api/announcements/${editDialog.announcement._id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`/api/announcements/club/${payload.club}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            resetForm();
            setCreateDialog(false);
            setEditDialog({ open: false, announcement: null });
            fetchAllAnnouncements();
            if (refreshData) refreshData();
        } catch (error) {
            console.error('Error saving announcement:', error);
            setErrors({ submit: error.response?.data?.message || 'Failed to save announcement' });
        }
    };

    // Handle delete
    const handleDelete = async (announcementId) => {
        if (!window.confirm('Are you sure you want to delete this announcement?')) return;

        try {
            await axios.delete(`/api/announcements/${announcementId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAllAnnouncements();
            if (refreshData) refreshData();
        } catch (error) {
            console.error('Error deleting announcement:', error);
        }
        setMenuAnchor(null);
    };

    // Handle pin/unpin
    const handleTogglePin = async (announcement) => {
        try {
            await axios.put(`/api/announcements/${announcement._id}`,
                { isPinned: !announcement.isPinned },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchAllAnnouncements();
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
        setMenuAnchor(null);
    };

    const resetForm = () => {
        setFormData({
            club: '',
            title: '',
            content: '',
            type: 'General',
            priority: 'Normal',
            isPinned: false,
            scheduledFor: '',
            tags: []
        });
        setErrors({});
    };

    const openCreateDialog = () => {
        resetForm();
        setFormData(prev => ({ ...prev, club: selectedClub }));
        setCreateDialog(true);
    };

    const openEditDialog = (announcement) => {
        setFormData({
            club: announcement.club._id || announcement.club,
            title: announcement.title,
            content: announcement.content,
            type: announcement.type,
            priority: announcement.priority,
            isPinned: announcement.isPinned,
            scheduledFor: announcement.scheduledFor ? announcement.scheduledFor.split('T')[0] : '',
            tags: announcement.tags || []
        });
        setEditDialog({ open: true, announcement });
        setMenuAnchor(null);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Urgent': return 'error';
            case 'High': return 'warning';
            case 'Normal': return 'primary';
            case 'Low': return 'default';
            default: return 'default';
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'Urgent': return 'error';
            case 'Important': return 'warning';
            case 'Event': return 'info';
            case 'Achievement': return 'success';
            default: return 'default';
        }
    };

    return (
        <Box>
            {/* Header with Club Selection */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                    📢 Club Announcements
                </Typography>
                {clubs.length > 1 && (
                    <FormControl variant="outlined" style={{ minWidth: 200 }}>
                        <InputLabel>Select Club</InputLabel>
                        <Select
                            value={selectedClub}
                            onChange={(e) => setSelectedClub(e.target.value)}
                            label="Select Club"
                        >
                            {clubs.map((club) => (
                                <MenuItem key={club._id} value={club._id}>
                                    {club.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}
            </Box>

            {/* Announcements Grid */}
            <Grid container spacing={3}>
                {announcements.map((announcement) => (
                    <Grid item xs={12} sm={6} md={4} key={announcement._id}>
                        <Card
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                border: announcement.isPinned ? '2px solid #1976d2' : '1px solid #e0e0e0'
                            }}
                        >
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box display="flex" justifyContent="between" alignItems="flex-start" mb={1}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        {announcement.isPinned && (
                                            <PinIcon color="primary" fontSize="small" />
                                        )}
                                        <Typography variant="h6" component="h3" noWrap>
                                            {announcement.title}
                                        </Typography>
                                    </Box>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            setMenuAnchor(e.currentTarget);
                                            setSelectedAnnouncement(announcement);
                                        }}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </Box>

                                <Typography variant="body2" color="text.secondary" paragraph>
                                    {announcement.content.length > 150
                                        ? `${announcement.content.substring(0, 150)}...`
                                        : announcement.content
                                    }
                                </Typography>

                                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                                    <Chip
                                        label={announcement.type}
                                        size="small"
                                        color={getTypeColor(announcement.type)}
                                    />
                                    <Chip
                                        label={announcement.priority}
                                        size="small"
                                        color={getPriorityColor(announcement.priority)}
                                        icon={<PriorityIcon />}
                                    />
                                    {announcement.scheduledFor && (
                                        <Chip
                                            label="Scheduled"
                                            size="small"
                                            icon={<ScheduleIcon />}
                                        />
                                    )}
                                </Box>

                                {announcement.tags && announcement.tags.length > 0 && (
                                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
                                        {announcement.tags.map((tag, index) => (
                                            <Chip key={index} label={`#${tag}`} size="small" variant="outlined" />
                                        ))}
                                    </Box>
                                )}

                                <Typography variant="caption" color="text.secondary">
                                    Created: {format(new Date(announcement.createdAt), 'MMM dd, yyyy')}
                                    {announcement.author && ` by ${announcement.author.name}`}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}

                {announcements.length === 0 && !loading && (
                    <Grid item xs={12}>
                        <Box textAlign="center" py={4}>
                            <AnnouncementIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No announcements found
                            </Typography>
                            <Typography color="text.secondary">
                                Create your first announcement to engage with club members
                            </Typography>
                        </Box>
                    </Grid>
                )}
            </Grid>

            {/* Floating Action Button */}
            <Fab
                color="primary"
                aria-label="add announcement"
                sx={{ position: 'fixed', bottom: 16, right: 16 }}
                onClick={openCreateDialog}
            >
                <AddIcon />
            </Fab>

            {/* Context Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
            >
                <MenuItem onClick={() => openEditDialog(selectedAnnouncement)}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleTogglePin(selectedAnnouncement)}>
                    <ListItemIcon><PinIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{selectedAnnouncement?.isPinned ? 'Unpin' : 'Pin'}</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={() => handleDelete(selectedAnnouncement?._id)}
                    sx={{ color: 'error.main' }}
                >
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                </MenuItem>
            </Menu>

            {/* Create/Edit Dialog */}
            <Dialog
                open={createDialog || editDialog.open}
                onClose={() => {
                    setCreateDialog(false);
                    setEditDialog({ open: false, announcement: null });
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {editDialog.open ? 'Edit Announcement' : 'Create New Announcement'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        {errors.submit && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {errors.submit}
                            </Alert>
                        )}

                        <TextField
                            label="Title"
                            fullWidth
                            margin="normal"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            error={!!errors.title}
                            helperText={errors.title}
                        />

                        <TextField
                            label="Content"
                            fullWidth
                            multiline
                            rows={4}
                            margin="normal"
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            error={!!errors.content}
                            helperText={errors.content}
                        />

                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        label="Type"
                                    >
                                        {announcementTypes.map((type) => (
                                            <MenuItem key={type} value={type}>{type}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        label="Priority"
                                    >
                                        {priorities.map((priority) => (
                                            <MenuItem key={priority} value={priority}>{priority}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        <TextField
                            label="Schedule for (Optional)"
                            type="date"
                            fullWidth
                            margin="normal"
                            value={formData.scheduledFor}
                            onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                        />

                        <TextField
                            label="Tags (comma-separated)"
                            fullWidth
                            margin="normal"
                            value={formData.tags.join(', ')}
                            onChange={(e) => setFormData({
                                ...formData,
                                tags: e.target.value.split(',').map(tag => tag.trim())
                            })}
                            helperText="Example: important, event, deadline"
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.isPinned}
                                    onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                                />
                            }
                            label="Pin this announcement"
                            sx={{ mt: 2 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setCreateDialog(false);
                            setEditDialog({ open: false, announcement: null });
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={!formData.title || !formData.content}
                    >
                        {editDialog.open ? 'Update' : 'Create'} Announcement
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AnnouncementsTab;
