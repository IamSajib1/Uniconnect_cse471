import React, { useEffect, useState } from 'react';
import {
    Container,
    Typography,
    Box,
    CircularProgress
} from '@mui/material';
import { useAuth } from '../../auth/context/AuthContext';

// Custom hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useDialogStates } from './hooks/useDialogStates';
import { useFormStates } from './hooks/useFormStates';
import { useMemberManagement } from './hooks/useMemberManagement';

// Components
import StatsCards from './components/StatsCards';
import DashboardTabs from './components/DashboardTabs';

// Tab components
import ClubRequestsTab from './tabs/ClubRequestsTab';
import ClubsTab from './tabs/ClubsTab';
import EventsTab from './tabs/EventsTab';
import MembersTab from './tabs/MembersTab';
import AnnouncementsTab from './tabs/AnnouncementsTab';
// Priority 3 Advanced Features
import AnalyticsTab from './tabs/AnalyticsTab';
import NotificationsTab from './tabs/NotificationsTab';
import AchievementsTab from './tabs/AchievementsTab';
import TemplatesTab from './tabs/TemplatesTab';
import CommunicationTab from './tabs/CommunicationTab';
import RolesTab from './tabs/RolesTab';

// Dialog components
import ClubFormDialog from './dialogs/ClubFormDialog';
import EventFormDialog from './dialogs/EventFormDialog';
import MemberManagementDialog from './dialogs/MemberManagementDialog';

// Utility functions
import { validateClubForm, validateEventForm, resetClubForm, resetEventForm } from './utils/validation';
import { clubAPI, eventAPI, memberAPI, universitiesAPI } from './utils/api';

// Tab Panel Component
const TabPanel = ({ children, value, index, ...other }) => (
    <div
        role="tabpanel"
        hidden={value !== index}
        id={`dashboard-tabpanel-${index}`}
        aria-labelledby={`dashboard-tab-${index}`}
        {...other}
    >
        {value === index && <Box>{children}</Box>}
    </div>
);

const ClubAdminDashboard = () => {
    const { user } = useAuth();

    // Custom hooks for state management
    const dashboardData = useDashboardData();
    const dialogStates = useDialogStates();
    const formStates = useFormStates();
    const memberManagement = useMemberManagement();

    // Members tab specific state
    const [selectedClubForMembers, setSelectedClubForMembers] = useState(null);
    const [clubMembers, setClubMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Initialize dashboard data
    useEffect(() => {
        const initializeDashboard = async () => {
            try {
                dashboardData.setLoading(true);

                // Load all required data in parallel
                const [clubsData, eventsData, universitiesData] = await Promise.all([
                    clubAPI.getMyClubs(),
                    eventAPI.getMyEvents(),
                    universitiesAPI.getAll()
                ]);

                dashboardData.setMyClubs(clubsData.clubs || []);
                dashboardData.setMyEvents(eventsData.events || []);
                dashboardData.setUniversities(universitiesData.universities || []);

                // Calculate stats
                dashboardData.setStats({
                    totalClubs: clubsData.clubs?.length || 0,
                    totalEvents: eventsData.events?.length || 0,
                    totalMembers: clubsData.clubs?.reduce((sum, club) => sum + (club.members?.length || 0), 0) || 0,
                    upcomingEvents: eventsData.events?.filter(event => new Date(event.date) >= new Date()).length || 0
                });
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                dashboardData.setLoading(false);
            }
        };

        if (user) {
            initializeDashboard();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Club management handlers
    const handleAddClub = () => {
        console.log('Add Club clicked'); // Debug log
        formStates.setClubFormData(resetClubForm());
        formStates.setFormErrors({});
        dialogStates.setEditMode(false);
        dialogStates.setClubFormOpen(true);
    };

    const handleEditClub = (club) => {
        console.log('Edit Club clicked:', club); // Debug log
        if (!club) {
            console.error('No club provided to edit');
            alert('Error: No club data available');
            return;
        }

        formStates.setClubFormData({
            ...club,
            university: club.university._id || club.university,
            tags: club.tags || [],
            socialLinks: club.socialLinks || {
                website: '',
                facebook: '',
                twitter: '',
                instagram: '',
                linkedin: ''
            }
        });
        formStates.setFormErrors({});
        dialogStates.setSelectedClub(club);
        dialogStates.setEditMode(true);
        dialogStates.setClubFormOpen(true);
    };

    const handleClubFormSubmit = async () => {
        const errors = validateClubForm(formStates.clubFormData);
        formStates.setFormErrors(errors);

        if (Object.keys(errors).length > 0) return;

        try {
            formStates.setSubmitLoading(true);

            if (dialogStates.editMode) {
                const updatedClub = await clubAPI.updateClub(dialogStates.selectedClub._id, formStates.clubFormData);
                dashboardData.setMyClubs(prev =>
                    prev.map(club => club._id === dialogStates.selectedClub._id ? updatedClub.club : club)
                );
            } else {
                const newClub = await clubAPI.createClub(formStates.clubFormData);
                dashboardData.setMyClubs(prev => [...prev, newClub.club]);
            }

            dialogStates.setClubFormOpen(false);
        } catch (error) {
            console.error('Error saving club:', error);
        } finally {
            formStates.setSubmitLoading(false);
        }
    };

    // Event management handlers
    const handleAddEvent = () => {
        console.log('Add Event clicked'); // Debug log
        formStates.setEventFormData(resetEventForm());
        formStates.setFormErrors({});
        dialogStates.setEditMode(false);
        dialogStates.setEventFormOpen(true);
    };

    const handleEditEvent = (event) => {
        console.log('Edit Event clicked:', event); // Debug log

        if (!event) {
            console.error('No event provided to edit');
            alert('Error: No event data available');
            return;
        }

        // Safe date handling - extract date part or use current date as fallback
        let eventDate = '';
        if (event.date) {
            eventDate = typeof event.date === 'string' ? event.date.split('T')[0] : new Date(event.date).toISOString().split('T')[0];
        } else if (event.startDate) {
            eventDate = typeof event.startDate === 'string' ? event.startDate.split('T')[0] : new Date(event.startDate).toISOString().split('T')[0];
        } else {
            eventDate = new Date().toISOString().split('T')[0];
            console.warn('Event has no date field, using current date as fallback');
        }

        formStates.setEventFormData({
            ...event,
            date: eventDate,
            club: event.club?._id || event.club || ''
        });
        formStates.setFormErrors({});
        dialogStates.setSelectedEvent(event);
        dialogStates.setEditMode(true);
        dialogStates.setEventFormOpen(true);
    }; const handleEventFormSubmit = async () => {
        const errors = validateEventForm(formStates.eventFormData);
        formStates.setFormErrors(errors);

        if (Object.keys(errors).length > 0) return;

        try {
            formStates.setSubmitLoading(true);

            // Map frontend fields to backend expectations
            const clubId = formStates.eventFormData.club || (dashboardData.myClubs[0]?._id) || '';
            const eventData = {
                title: formStates.eventFormData.title,
                description: formStates.eventFormData.description,
                type: formStates.eventFormData.category === 'Sports' ? 'Sports Event' : (formStates.eventFormData.category || 'Meeting'),
                organizer: clubId,
                startDate: formStates.eventFormData.date,
                endDate: formStates.eventFormData.endDate && formStates.eventFormData.endDate !== ''
                    ? formStates.eventFormData.endDate
                    : formStates.eventFormData.date || new Date().toISOString(),
                startTime: formStates.eventFormData.time,
                endTime: formStates.eventFormData.endTime,
                venue: formStates.eventFormData.location,
                capacity: parseInt(formStates.eventFormData.maxAttendees) || 60,
                entryFee: parseFloat(formStates.eventFormData.price) || 0,
                requirements: formStates.eventFormData.requirements || '',
                tags: formStates.eventFormData.tags || [],
                isPublic: !formStates.eventFormData.isPrivate,
                registrationDeadline: formStates.eventFormData.registrationDeadline,
                isRegistrationRequired: true // or set based on your logic
            };

            if (dialogStates.editMode) {
                const updatedEvent = await eventAPI.updateEvent(dialogStates.selectedEvent._id, eventData);
                dashboardData.setMyEvents(prev =>
                    prev.map(event => event._id === dialogStates.selectedEvent._id ? updatedEvent.event : event)
                );
            } else {
                const newEvent = await eventAPI.createEvent(eventData);
                dashboardData.setMyEvents(prev => [...prev, newEvent.event]);
            }

            dialogStates.setEventFormOpen(false);
        } catch (error) {
            console.error('Error saving event:', error);
        } finally {
            formStates.setSubmitLoading(false);
        }
    };

    // Member management handlers
    const handleViewMembers = async (club) => {
        console.log('View Members clicked:', club); // Debug log

        if (!club) {
            console.error('No club provided for member management');
            alert('Error: No club data available');
            return;
        }

        try {
            dialogStates.setSelectedClub(club);
            console.log('Loading members for club:', club._id);
            const membersData = await memberAPI.getClubMembers(club._id);
            memberManagement.setClubMembers(membersData.members || []);
            dialogStates.setMemberManagementOpen(true);
            console.log('Members loaded successfully:', membersData.members?.length || 0);
        } catch (error) {
            console.error('Error loading club members:', error);
            alert(`Error loading members: ${error.response?.data?.message || error.message}`);
        }
    };

    const handleSearchUser = async () => {
        if (!memberManagement.searchEmail.trim()) return;

        try {
            memberManagement.setSearchLoading(true);
            const userData = await memberAPI.searchUser(memberManagement.searchEmail);
            memberManagement.setSearchUser(userData.user);
        } catch (error) {
            console.error('Error searching user:', error);
            memberManagement.setSearchUser(null);
        } finally {
            memberManagement.setSearchLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!memberManagement.searchUser || !dialogStates.selectedClub) return;

        try {
            await memberAPI.addMember(dialogStates.selectedClub._id, memberManagement.searchUser._id);
            // Add the new member to the local state in the correct format
            const newMember = {
                user: memberManagement.searchUser,
                role: 'Member',
                _id: memberManagement.searchUser._id + '_member', // temporary ID
                joinedDate: new Date().toISOString()
            };
            memberManagement.setClubMembers(prev => [...prev, newMember]);
            memberManagement.setSearchUser(null);
            memberManagement.setSearchEmail('');
        } catch (error) {
            console.error('Error adding member:', error);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!dialogStates.selectedClub) return;

        try {
            await memberAPI.removeMember(dialogStates.selectedClub._id, userId);
            memberManagement.setClubMembers(prev => prev.filter(member => member.user._id !== userId));
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    // Members tab handlers
    const handleClubSelectForMembers = async (club) => {
        try {
            setSelectedClubForMembers(club);
            if (club) {
                setMembersLoading(true);
                const membersData = await memberAPI.getClubMembers(club._id);
                setClubMembers(membersData.members || []);
            } else {
                setClubMembers([]);
            }
        } catch (error) {
            console.error('Error loading club members:', error);
            setClubMembers([]);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleSearchUserForMembers = async () => {
        if (!memberManagement.searchEmail.trim()) return;

        try {
            memberManagement.setSearchLoading(true);
            const userData = await memberAPI.searchUser(memberManagement.searchEmail);
            memberManagement.setSearchUser(userData.user);
        } catch (error) {
            console.error('Error searching user:', error);
            memberManagement.setSearchUser(null);
        } finally {
            memberManagement.setSearchLoading(false);
        }
    };

    const handleAddMemberToTab = async () => {
        if (!memberManagement.searchUser || !selectedClubForMembers) return;

        try {
            await memberAPI.addMember(selectedClubForMembers._id, memberManagement.searchUser._id);
            // Add the new member to the local state
            const newMember = {
                user: memberManagement.searchUser,
                role: 'Member',
                _id: memberManagement.searchUser._id + '_member',
                joinedDate: new Date().toISOString()
            };
            setClubMembers(prev => [...prev, newMember]);
            memberManagement.setSearchUser(null);
            memberManagement.setSearchEmail('');
        } catch (error) {
            console.error('Error adding member:', error);
        }
    };

    const handleRemoveMemberFromTab = async (userId) => {
        if (!selectedClubForMembers) return;

        try {
            await memberAPI.removeMember(selectedClubForMembers._id, userId);
            setClubMembers(prev => prev.filter(member => member.user._id !== userId));
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    // Delete handlers
    const handleDeleteClub = async (clubId) => {
        console.log('Delete Club clicked:', clubId); // Debug log

        if (!clubId) {
            console.error('No club ID provided for deletion');
            alert('Error: No club ID available');
            return;
        }

        if (window.confirm('Are you sure you want to delete this club?')) {
            try {
                console.log('Attempting to delete club:', clubId);
                await clubAPI.deleteClub(clubId);
                dashboardData.setMyClubs(prev => prev.filter(club => club._id !== clubId));
                console.log('Club deleted successfully');
                alert('Club deleted successfully!');
            } catch (error) {
                console.error('Error deleting club:', error);
                alert(`Error deleting club: ${error.response?.data?.message || error.message}`);
            }
        }
    };

    const handleDeleteEvent = async (eventId) => {
        console.log('Delete Event clicked:', eventId); // Debug log

        if (!eventId) {
            console.error('No event ID provided for deletion');
            alert('Error: No event ID available');
            return;
        }

        if (window.confirm('Are you sure you want to delete this event?')) {
            try {
                console.log('Attempting to delete event:', eventId);
                await eventAPI.deleteEvent(eventId);
                dashboardData.setMyEvents(prev => prev.filter(event => event._id !== eventId));
                console.log('Event deleted successfully');
                alert('Event deleted successfully!');
            } catch (error) {
                console.error('Error deleting event:', error);
                alert(`Error deleting event: ${error.response?.data?.message || error.message}`);
            }
        }
    };

    // Placeholder handlers for Priority 3 features (to be implemented)
    const handleManageAttendees = (event) => {
        console.log('Manage Attendees clicked:', event); // Debug log

        if (!event) {
            console.error('No event provided for attendee management');
            alert('Error: No event data available');
            return;
        }

        // For now, just show an alert that the feature is working
        // TODO: Implement full attendee management dialog
        alert(`Managing attendees for event: ${event.title}\nCurrent attendees: ${event.attendees?.length || 0}\nFeature working - this will be enhanced in future updates!`);
        // dialogStates.setSelectedEvent(event);
        // dialogStates.setAttendeeManagementOpen(true);
    };

    if (dashboardData.loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Club Admin Dashboard
            </Typography>

            {/* Stats Cards */}
            <StatsCards stats={dashboardData.stats} />

            {/* Dashboard Tabs */}
            <DashboardTabs
                tabValue={dialogStates.tabValue}
                setTabValue={dialogStates.setTabValue}
            />

            {/* Tab Panels */}
            <TabPanel value={dialogStates.tabValue} index={0}>
                <ClubRequestsTab
                    user={user}
                    token={localStorage.getItem('token')}
                />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={1}>
                <ClubsTab
                    myClubs={dashboardData.myClubs}
                    onAddClub={handleAddClub}
                    onEditClub={handleEditClub}
                    onDeleteClub={handleDeleteClub}
                    onViewMembers={handleViewMembers}
                />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={2}>
                <EventsTab
                    myEvents={dashboardData.myEvents}
                    onAddEvent={handleAddEvent}
                    onEditEvent={handleEditEvent}
                    onDeleteEvent={handleDeleteEvent}
                    onManageAttendees={handleManageAttendees}
                />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={3}>
                <MembersTab
                    myClubs={dashboardData.myClubs}
                    selectedClub={selectedClubForMembers}
                    onClubSelect={handleClubSelectForMembers}
                    clubMembers={clubMembers}
                    searchEmail={memberManagement.searchEmail}
                    setSearchEmail={memberManagement.setSearchEmail}
                    searchUser={memberManagement.searchUser}
                    searchLoading={memberManagement.searchLoading}
                    onSearchUser={handleSearchUserForMembers}
                    onAddMember={handleAddMemberToTab}
                    onRemoveMember={handleRemoveMemberFromTab}
                    loading={membersLoading}
                />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={4}>
                <AnnouncementsTab
                    clubs={dashboardData.myClubs}
                    refreshData={dashboardData.refreshData}
                />
            </TabPanel>

            {/* Priority 3 Advanced Features Tab Panels */}
            <TabPanel value={dialogStates.tabValue} index={5}>
                <AnalyticsTab />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={6}>
                <NotificationsTab />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={7}>
                <AchievementsTab />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={8}>
                <TemplatesTab />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={9}>
                <CommunicationTab />
            </TabPanel>

            <TabPanel value={dialogStates.tabValue} index={10}>
                <RolesTab />
            </TabPanel>

            {/* Dialogs */}
            <ClubFormDialog
                open={dialogStates.clubFormOpen}
                onClose={() => dialogStates.setClubFormOpen(false)}
                clubFormData={formStates.clubFormData}
                setClubFormData={formStates.setClubFormData}
                formErrors={formStates.formErrors}
                submitLoading={formStates.submitLoading}
                editMode={dialogStates.editMode}
                universities={dashboardData.universities}
                onSubmit={handleClubFormSubmit}
            />

            <EventFormDialog
                open={dialogStates.eventFormOpen}
                onClose={() => dialogStates.setEventFormOpen(false)}
                eventFormData={formStates.eventFormData}
                setEventFormData={formStates.setEventFormData}
                formErrors={formStates.formErrors}
                submitLoading={formStates.submitLoading}
                editMode={dialogStates.editMode}
                myClubs={dashboardData.myClubs}
                onSubmit={handleEventFormSubmit}
            />

            <MemberManagementDialog
                open={dialogStates.memberManagementOpen}
                onClose={() => dialogStates.setMemberManagementOpen(false)}
                selectedClub={dialogStates.selectedClub}
                clubMembers={memberManagement.clubMembers}
                searchEmail={memberManagement.searchEmail}
                setSearchEmail={memberManagement.setSearchEmail}
                searchUser={memberManagement.searchUser}
                searchLoading={memberManagement.searchLoading}
                onSearchUser={handleSearchUser}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
            />
        </Container>
    );
};

export default ClubAdminDashboard;
