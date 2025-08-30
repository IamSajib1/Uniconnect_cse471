import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    Button,
    Chip,
    Tabs,
    Tab,
    Avatar,
    CardActions,
    Paper,
    CircularProgress
} from '@mui/material';
import { useAuth } from '../../auth/context/AuthContext';
import axios from 'axios';
import GroupsIcon from '@mui/icons-material/Groups';
import EventIcon from '@mui/icons-material/Event';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TeamRecruitmentHub from '../shared/TeamRecruitmentHub';
import EnhancedProfile from '../shared/EnhancedProfile';
import { useNavigate } from 'react-router-dom';

// Student Dashboard Component for Regular Students
const StudentDashboard = () => {
    const { user, refreshUser, token } = useAuth();
    const [clubs, setClubs] = useState([]);
    const [events, setEvents] = useState([]);
    const [registeredEvents, setRegisteredEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    // ...existing code...

    const navigate = useNavigate();

    const fetchClubsAndEvents = useCallback(async () => {
        try {
            const universityId = user?.university?._id || user?.university;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const [clubsRes, eventsRes] = await Promise.all([
                axios.get(`/api/clubs${universityId ? `?university=${universityId}` : ''}`, { headers }),
                axios.get(`/api/events`, { headers })
            ]);

            setClubs(clubsRes.data.clubs || []);
            setEvents(eventsRes.data.events || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            setClubs([]);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [user, token]);

    useEffect(() => {
        if (user && user.clubMemberships !== undefined && user.eventsAttended !== undefined) {
            fetchClubsAndEvents();
            // Fetch registered events from eventregistrations table
            const fetchRegisteredEvents = async () => {
                try {
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    const res = await axios.get('/api/event-registrations', { headers });
                    // Filter for current user
                    const userEvents = res.data.registrations.filter(r => r.studentName === user.name && r.university === user.university?.name);
                    setRegisteredEvents(userEvents.map(r => r.event));
                } catch (error) {
                    console.error('Error fetching registered events:', error);
                    setRegisteredEvents([]);
                }
            };
            fetchRegisteredEvents();
        }
    }, [fetchClubsAndEvents, user, token]);

    useEffect(() => {
        if (user) {
            console.log('Current user data:', user);
            console.log('User club memberships:', user?.clubMemberships);
            console.log('User events attended:', user?.eventsAttended);
            console.log('User data fully loaded:', user.clubMemberships !== undefined && user.eventsAttended !== undefined);
        }
    }, [user]);

    const handleJoinClub = async (clubId) => {
        try {
            const response = await axios.post(`/api/clubs/${clubId}/join`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.message) {
                alert(response.data.message);
                await refreshUser();
                await fetchClubsAndEvents();
            }
        } catch (error) {
            console.error('Error joining club:', error);
            alert(error.response?.data?.message || 'Failed to join club');
        }
    };

    const handleRegisterEvent = async (eventId) => {
        try {
            const response = await axios.post(`/api/events/${eventId}/register`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.message) {
                alert(response.data.message);
                await refreshUser();
                await fetchClubsAndEvents();
                // Immediately update registeredEvents state
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get('/api/event-registrations', { headers });
                const userEvents = res.data.registrations.filter(r => r.studentName === user.name && r.university === user.university?.name);
                setRegisteredEvents(userEvents.map(r => r.event));
            }
        } catch (error) {
            console.error('Error registering for event:', error);
            if (error.response?.status === 400 && error.response?.data?.message) {
                alert(error.response.data.message);
            } else {
                alert('Server error. Please try again later.');
            }
        }
    };

    const handleOpenEvent = (eventId) => {
        navigate(`/events/${eventId}`);
    };

    const handleForceRefresh = async () => {
        setLoading(true);
        try {
            await refreshUser();
            await fetchClubsAndEvents();

            const debugResponse = await axios.get('/api/debug/user', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('=== SERVER DEBUG DATA ===');
            console.log('Debug response:', debugResponse.data);
        } catch (error) {
            console.error('Debug error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const userClubs = useMemo(() => {
        if (!user?.clubMemberships || !clubs.length) {
            console.log('No user memberships or clubs available');
            return [];
        }

        const result = [];
        console.log('=== CLUB MEMBERSHIP DEBUG ===');
        console.log('User club memberships:', user.clubMemberships);
        console.log('Available clubs:', clubs.map(c => ({ id: c._id, name: c.name })));

        user.clubMemberships.forEach(membership => {
            const membershipClubId = membership.club?._id || membership.club;
            console.log('Looking for club with ID:', membershipClubId);

            const foundClub = clubs.find(club => club._id === membershipClubId);
            if (foundClub) {
                console.log('Found matching club:', foundClub.name);
                result.push(foundClub);
            } else {
                console.log('No matching club found for ID:', membershipClubId);
            }
        });

        console.log('Final userClubs result:', result.map(c => c.name));
        return result;
    }, [user?.clubMemberships, clubs]);

    // ...existing code...

    const renderClubs = (clubList) => (
        <Grid container spacing={3}>
            {clubList.length === 0 ? (
                <Grid item xs={12}>
                    <Box textAlign="center" py={4}>
                        <GroupsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            {tabValue === 0 ? 'You haven\'t joined any clubs yet' : 'No clubs found'}
                        </Typography>
                        <Typography color="text.secondary">
                            {tabValue === 0 ? 'Explore clubs to find ones that interest you!' : 'Check back later for new clubs'}
                        </Typography>
                    </Box>
                </Grid>
            ) : (
                clubList.map((club) => (
                    <Grid item xs={12} sm={6} md={4} key={club._id}>
                        <Card
                            sx={{
                                height: '100%',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: 3
                                }
                            }}
                        >
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ width: 56, height: 56, mr: 2, bgcolor: 'primary.main' }}>
                                        <GroupsIcon />
                                    </Avatar>
                                    <Box flexGrow={1}>
                                        <Typography variant="h6" fontWeight="bold" noWrap>
                                            {club.name}
                                        </Typography>
                                        <Chip label={club.category} size="small" color="primary" variant="outlined" />
                                    </Box>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 60 }}>
                                    {club.description?.length > 100 ?
                                        `${club.description.substring(0, 100)}...` :
                                        club.description || 'No description available'
                                    }
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        👥 {club.members?.length || 0} members
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        💰 ${club.membershipFee || 0}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    🎯 President: {club.president?.name || 'TBD'}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                                {!userClubs.find(uc => uc._id === club._id) ? (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<PersonAddIcon />}
                                        onClick={() => handleJoinClub(club._id)}
                                        fullWidth
                                    >
                                        Join Club
                                    </Button>
                                ) : (
                                    <Chip label="Member" color="success" size="small" />
                                )}
                            </CardActions>
                        </Card>
                    </Grid>
                ))
            )}
        </Grid>
    );

    const renderEvents = (eventList) => (
        <Grid container spacing={3}>
            {eventList.length === 0 ? (
                <Grid item xs={12}>
                    <Box textAlign="center" py={4}>
                        <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            No events found
                        </Typography>
                        <Typography color="text.secondary">
                            Check back later for upcoming events
                        </Typography>
                    </Box>
                </Grid>
            ) : (
            eventList.map((event) => (
                    <Grid item xs={12} sm={6} md={4} key={event._id}>
                        <Card
                            sx={{
                                height: '100%',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: 3
                                }
                            }}
                        >
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ width: 56, height: 56, mr: 2, bgcolor: 'secondary.main' }}>
                                        <EventIcon />
                                    </Avatar>
                                    <Box flexGrow={1}>
                                        <Typography variant="h6" fontWeight="bold" noWrap>
                                            {event.title}
                                        </Typography>
                                        <Chip
                                            label={event.eventType || event.type || 'Event'}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                        />
                                    </Box>
                                </Box>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 60 }}>
                                    {event.description?.length > 100 ?
                                        `${event.description.substring(0, 100)}...` :
                                        event.description || 'No description available'
                                    }
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDate(event.startDate)}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <LocationOnIcon sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {event.venue?.name || event.venue || 'TBD'}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        👥 {event.attendees?.length || 0} attendees
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        💰 ${event.registrationFee || 0}
                                    </Typography>
                                </Box>

                                <Typography variant="body2" color="text.secondary">
                                    🏛️ {event.club?.name || 'Unknown Club'}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                                {event.isRegistrationRequired && !registeredEvents.includes(event.event || event.title) ? (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="secondary"
                                        onClick={() => handleRegisterEvent(event._id)}
                                        fullWidth
                                    >
                                        Register
                                    </Button>
                                ) : registeredEvents.includes(event.event || event.title) ? (
                                    <Chip label="Registered" color="success" size="small" />
                                ) : (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="info"
                                        onClick={() => handleOpenEvent(event._id)}
                                        fullWidth
                                    >
                                        Open Event
                                    </Button>
                                )}
                            </CardActions>
                        </Card>
                    </Grid>
                ))
            )}
        </Grid>
    );

    if (loading || !user || user.clubMemberships === undefined || user.eventsAttended === undefined) {
        return (
            <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={60} />
                <Typography variant="h4" sx={{ ml: 2 }}>
                    Loading Your Dashboard...
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Paper sx={{ p: 4, mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h3" fontWeight="bold">
                            Welcome, {user?.name}! 👋
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9 }}>
                            {user?.university?.name || 'University'} • {user?.major || 'Student'} • {user?.year || 'Year N/A'}
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        sx={{
                            color: 'white',
                            borderColor: 'white',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                        }}
                        onClick={handleForceRefresh}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Refresh'}
                    </Button>
                </Box>
            </Paper>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 2 }}>
                                <GroupsIcon />
                            </Avatar>
                            <Typography variant="h4" color="primary" fontWeight="bold">
                                {userClubs.length}
                            </Typography>
                            <Typography color="text.secondary">
                                My Clubs
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 2 }}>
                                <EventIcon />
                            </Avatar>
                            <Typography variant="h4" color="secondary" fontWeight="bold">
                                {registeredEvents.length}
                            </Typography>
                            <Typography color="text.secondary">
                                Registered Events
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 2 }}>
                                <GroupsIcon />
                            </Avatar>
                            <Typography variant="h4" color="success.main" fontWeight="bold">
                                {clubs.length}
                            </Typography>
                            <Typography color="text.secondary">
                                Available Clubs
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 2 }}>
                                <EventIcon />
                            </Avatar>
                            <Typography variant="h4" color="info.main" fontWeight="bold">
                                {events.length}
                            </Typography>
                            <Typography color="text.secondary">
                                Available Events
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                    <Tab icon={<GroupsIcon />} label="My Clubs" />
                    <Tab icon={<GroupsIcon />} label="All Clubs" />
                    <Tab icon={<EventIcon />} label="Events" />
                    <Tab icon={<GroupsIcon />} label="Team Hub" />
                    <Tab icon={<PersonAddIcon />} label="Profile" />
                </Tabs>
            </Box>

            {tabValue === 0 && (
                <Box>
                    <Typography variant="h5" gutterBottom>
                        📚 My Clubs ({userClubs.length})
                    </Typography>
                    {renderClubs(userClubs)}
                </Box>
            )}

            {tabValue === 1 && (
                <Box>
                    <Typography variant="h5" gutterBottom>
                        All Clubs ({clubs.length})
                    </Typography>
                    {renderClubs(clubs)}
                </Box>
            )}

            {tabValue === 2 && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h5" gutterBottom>
                        All Events ({events.length})
                    </Typography>
                    {renderEvents(events)}
                </Box>
            )}

            {tabValue === 3 && (
                <TeamRecruitmentHub />
            )}

            {tabValue === 4 && (
                <EnhancedProfile />
            )}
        </Container>
    );
};

export default StudentDashboard;
